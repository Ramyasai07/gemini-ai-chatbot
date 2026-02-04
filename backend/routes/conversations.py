"""
Conversation Routes - CRUD operations for conversations.
"""

from flask import Blueprint, request, jsonify
from backend.models.database import db, Conversation, Message
from backend.utils.export import (
    export_conversation_json, 
    export_conversation_markdown,
    export_conversation_pdf,
    get_export_filename
)
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

conversations_bp = Blueprint('conversations', __name__, url_prefix='/api/v1')


@conversations_bp.route('/conversations', methods=['GET'])
def get_conversations():
    """Get all conversations for current user."""
    try:
        # In production, use current_user.id
        user_id = request.args.get('user_id', 1, type=int)
        sort_by = request.args.get('sort_by', 'updated_at')
        order = request.args.get('order', 'desc')
        favorite_only = request.args.get('favorite', False, type=bool)
        
        query = Conversation.query.filter_by(user_id=user_id)
        
        if favorite_only:
            query = query.filter_by(is_favorite=True)
        
        # Sort
        sort_column = getattr(Conversation, sort_by, Conversation.updated_at)
        if order == 'asc':
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
        
        conversations = query.all()
        
        return jsonify({
            'conversations': [
                {
                    **conv.to_dict(),
                    'preview': (conv.messages[-1].content[:100] if conv.messages else '')
                }
                for conv in conversations
            ]
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_conversations: {str(e)}")
        return jsonify({'error': str(e)}), 500


@conversations_bp.route('/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Get specific conversation with all messages."""
    try:
        conversation = Conversation.query.get(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        return jsonify(conversation.to_dict(include_messages=True)), 200
        
    except Exception as e:
        logger.error(f"Error in get_conversation: {str(e)}")
        return jsonify({'error': str(e)}), 500


@conversations_bp.route('/conversations', methods=['POST'])
def create_conversation():
    """Create a new conversation."""
    try:
        data = request.get_json()
        
        conversation = Conversation(
            user_id=data.get('user_id', 1),
            title=data.get('title', 'New Conversation'),
            model_used=data.get('model', 'gemini-pro'),
            description=data.get('description', '')
        )
        
        db.session.add(conversation)
        db.session.commit()
        
        logger.info(f"✓ Conversation created: {conversation.id}")
        
        return jsonify(conversation.to_dict()), 201
        
    except Exception as e:
        logger.error(f"Error in create_conversation: {str(e)}")
        return jsonify({'error': str(e)}), 500


@conversations_bp.route('/conversations/<int:conversation_id>', methods=['PUT'])
def update_conversation(conversation_id):
    """Update conversation metadata."""
    try:
        conversation = Conversation.query.get(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        data = request.get_json()
        
        if 'title' in data:
            conversation.title = data['title']
        if 'description' in data:
            conversation.description = data['description']
        if 'is_favorite' in data:
            conversation.is_favorite = data['is_favorite']
        if 'is_archived' in data:
            conversation.is_archived = data['is_archived']
        
        conversation.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(conversation.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error in update_conversation: {str(e)}")
        return jsonify({'error': str(e)}), 500


@conversations_bp.route('/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation and all messages."""
    try:
        conversation = Conversation.query.get(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Cascade delete is handled by database relationships
        db.session.delete(conversation)
        db.session.commit()
        
        logger.info(f"✓ Conversation deleted: {conversation_id}")
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        logger.error(f"Error in delete_conversation: {str(e)}")
        return jsonify({'error': str(e)}), 500


@conversations_bp.route('/conversations/<int:conversation_id>/export', methods=['POST'])
def export_conversation(conversation_id):
    """Export conversation in various formats."""
    try:
        conversation = Conversation.query.get(conversation_id)
        
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        export_format = request.args.get('format', 'json')  # json, markdown, pdf
        
        # Convert to dict format
        conv_dict = conversation.to_dict()
        messages = [msg.to_dict() for msg in conversation.messages]
        
        if export_format == 'json':
            content = export_conversation_json(conv_dict, messages)
            filename = get_export_filename(conversation.title, 'json')
            return jsonify({
                'filename': filename,
                'content': content,
                'format': 'json'
            }), 200
        
        elif export_format == 'markdown':
            content = export_conversation_markdown(conv_dict, messages)
            filename = get_export_filename(conversation.title, 'markdown')
            return jsonify({
                'filename': filename,
                'content': content,
                'format': 'markdown'
            }), 200
        
        elif export_format == 'pdf':
            success = export_conversation_pdf(conv_dict, messages)
            if success:
                filename = get_export_filename(conversation.title, 'pdf')
                return jsonify({
                    'filename': filename,
                    'format': 'pdf',
                    'message': 'PDF ready for download'
                }), 200
            else:
                return jsonify({'error': 'PDF export not available'}), 503
        
        else:
            return jsonify({'error': 'Invalid format'}), 400
        
    except Exception as e:
        logger.error(f"Error in export_conversation: {str(e)}")
        return jsonify({'error': str(e)}), 500


@conversations_bp.route('/conversations/search', methods=['GET'])
def search_conversations():
    """Search conversations by title or content."""
    try:
        query = request.args.get('q', '').strip()
        user_id = request.args.get('user_id', 1, type=int)
        
        if not query:
            return jsonify({'error': 'Query required'}), 400
        
        # Search in conversation titles
        conversations = Conversation.query.filter(
            Conversation.user_id == user_id,
            Conversation.title.ilike(f'%{query}%')
        ).all()
        
        results = []
        for conv in conversations:
            conv_data = conv.to_dict()
            # Check if query matches any message content
            matching_messages = [
                msg for msg in conv.messages 
                if query.lower() in msg.content.lower()
            ]
            conv_data['matching_messages'] = len(matching_messages)
            results.append(conv_data)
        
        return jsonify({'results': results}), 200
        
    except Exception as e:
        logger.error(f"Error in search_conversations: {str(e)}")
        return jsonify({'error': str(e)}), 500
