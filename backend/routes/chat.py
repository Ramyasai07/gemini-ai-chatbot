"""
Chat Routes - Handles messaging, streaming, and conversation management.
"""

from flask import Blueprint, request, jsonify, Response
from backend.models.database import db, Conversation, Message, Attachment
from backend.services.gemini_service import GeminiService
from backend.services.search_service import SearchService
from backend.services.file_service import FileService
from backend.utils.streaming import stream_response, format_error_response
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

chat_bp = Blueprint('chat', __name__, url_prefix='/api/v1')


@chat_bp.route('/chat', methods=['POST'])
def send_message():
    """
    Send a message and get AI response with streaming.
    
    Request JSON:
        {
            "conversation_id": int,
            "message": str,
            "model": str (optional)
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Message required'}), 400
        
        conversation_id = data.get('conversation_id')
        user_message = data.get('message', '').strip()
        model = data.get('model', 'gemini-pro')
        
        if not user_message:
            return jsonify({'error': 'Empty message'}), 400
        
        # Get or create conversation
        if conversation_id:
            conversation = Conversation.query.get(conversation_id)
            if not conversation:
                return jsonify({'error': 'Conversation not found'}), 404
        else:
            # Create new conversation
            conversation = Conversation(
                user_id=1,  # In production, use current_user.id
                title=user_message[:100],
                model_used=model
            )
            db.session.add(conversation)
            db.session.flush()
        
        # Save user message
        user_msg = Message(
            conversation_id=conversation.id,
            role='user',
            content=user_message
        )
        db.session.add(user_msg)
        db.session.commit()
        
        # Build conversation history for context
        history = [
            {
                'role': msg.role,
                'content': msg.content
            }
            for msg in conversation.messages[:-1]  # Exclude current message
        ]
        
        # Initialize services
        try:
            gemini = GeminiService()
            search = SearchService()
        except Exception as e:
            logger.error(f"Service initialization error: {str(e)}")
            return jsonify({'error': 'Service unavailable'}), 503
        
        # Check if search is needed
        search_results = None
        if search.should_search(user_message):
            search_results = search.search(user_message)
        
        # Build prompt with search results if available
        if search_results:
            search_text = search.format_for_response(search_results)
            enhanced_prompt = f"{user_message}\n\n[Live Search Results]\n{search_text}"
        else:
            enhanced_prompt = user_message
        
        # Stream response
        def generate():
            try:
                for chunk in gemini.chat_with_streaming(enhanced_prompt, history, model):
                    if chunk:
                        yield f"data: {{\"response\": {json.dumps(chunk)} }}\n\n"
                # Send completion event
                yield "data: {\"done\": true}\n\n"
            except Exception as e:
                logger.error(f"Streaming error: {str(e)}")
                yield f"data: {{\"error\": {json.dumps(str(e))} }}\n\n"
        return Response(generate(), mimetype='text/event-stream')
        
    except Exception as e:
        logger.error(f"Error in send_message: {str(e)}")
        return jsonify({'error': str(e)}), 500


@chat_bp.route('/chat/save-response', methods=['POST'])
def save_response():
    """Save AI response to database after streaming completes."""
    try:
        data = request.get_json()
        
        conversation_id = data.get('conversation_id')
        response_text = data.get('response', '').strip()
        tokens_used = data.get('tokens_used', 0)
        
        if not conversation_id or not response_text:
            return jsonify({'error': 'Missing required fields'}), 400
        
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Save assistant message
        ai_msg = Message(
            conversation_id=conversation.id,
            role='assistant',
            content=response_text,
            tokens_used=tokens_used
        )
        
        # Update conversation
        conversation.total_tokens += tokens_used
        
        db.session.add(ai_msg)
        db.session.commit()
        
        logger.info(f"✓ Response saved for conversation {conversation_id}")
        
        return jsonify({
            'message_id': ai_msg.id,
            'conversation_id': conversation.id
        }), 201
        
    except Exception as e:
        logger.error(f"Error in save_response: {str(e)}")
        return jsonify({'error': str(e)}), 500


@chat_bp.route('/chat/<int:message_id>', methods=['PUT'])
def edit_message(message_id):
    """Edit a user message and regenerate response."""
    try:
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        data = request.get_json()
        new_content = data.get('content', '').strip()
        
        if not new_content:
            return jsonify({'error': 'Content required'}), 400
        
        message.content = new_content
        message.is_edited = True
        message.updated_at = datetime.utcnow()
        
        # Delete subsequent messages (need to regenerate)
        Message.query.filter(
            Message.conversation_id == message.conversation_id,
            Message.id > message_id
        ).delete()
        
        db.session.commit()
        
        return jsonify({
            'id': message.id,
            'content': message.content,
            'is_edited': message.is_edited
        }), 200
        
    except Exception as e:
        logger.error(f"Error in edit_message: {str(e)}")
        return jsonify({'error': str(e)}), 500


@chat_bp.route('/chat/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    """Delete a message from conversation."""
    try:
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        conversation_id = message.conversation_id
        
        # Delete message and all subsequent messages
        Message.query.filter(
            Message.conversation_id == conversation_id,
            Message.id >= message_id
        ).delete()
        
        db.session.commit()
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        logger.error(f"Error in delete_message: {str(e)}")
        return jsonify({'error': str(e)}), 500


@chat_bp.route('/models', methods=['GET'])
def get_models():
    """Get available AI models."""
    try:
        gemini = GeminiService()
        models = gemini.get_available_models()
        
        return jsonify({
            'models': models,
            'default_model': 'gemini-pro'
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_models: {str(e)}")
        return jsonify({'error': str(e)}), 500


@chat_bp.route('/tokens/count', methods=['POST'])
def count_tokens():
    """Count tokens for a text."""
    try:
        data = request.get_json()
        text = data.get('text', '')
        model = data.get('model', 'gemini-pro')
        
        if not text:
            return jsonify({'error': 'Text required'}), 400
        
        gemini = GeminiService()
        token_count = gemini.count_tokens(text, model)
        estimated_cost = gemini.estimate_cost(token_count, 0, model)
        
        return jsonify({
            'tokens': token_count,
            'estimated_cost': estimated_cost
        }), 200
        
    except Exception as e:
        logger.error(f"Error in count_tokens: {str(e)}")
        return jsonify({'error': str(e)}), 500
