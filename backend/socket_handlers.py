import logging
from flask import current_app, request
from flask_socketio import emit
from backend.socketio import socketio
from backend.services.gemini_service import GeminiService
from backend.services.spell_service import SpellService
from threading import Thread
import time

logger = logging.getLogger(__name__)

# Initialize local services (will be re-used across events)
_spell = SpellService()
_gemini = None


@socketio.on('connect')
def handle_connect():
    print(f"\n[SOCKET] ✓ Client CONNECTED: {request.sid}\n")
    logger.info(f"Client connected: {request.sid}")
    emit_payload = {'status': 'connected'}
    emit('connection_status', emit_payload)


@socketio.on('disconnect')
def handle_disconnect():
    print(f"\n[SOCKET] ✗ Client DISCONNECTED\n")
    logger.info('Client disconnected')


def _init_gemini_service():
    global _gemini
    if _gemini is None:
        try:
            _gemini = GeminiService()
        except Exception as e:
            logger.exception('Failed to initialize GeminiService: %s', e)


@socketio.on('send_message')
def handle_send_message(data):
    """Handle incoming messages from clients over Socket.IO.

    Accepts data: {message, conversation_id, model}
    Emits:
      - 'new_message' when AI reply is ready
      - 'message_error' on failure
    """
    logger.info(f"[DEBUG] Received send_message event: {data}")

    try:
        _init_gemini_service()
        logger.info(f"[DEBUG] Gemini service initialized: {_gemini is not None}")

        message = data.get('message', '').strip()
        logger.info(f"[DEBUG] Message content: '{message}'")

        if not message:
            logger.warning("[DEBUG] Empty message received")
            emit('message_error', {'message': 'Message cannot be empty'})
            return

        logger.info(f'Processing message: {message[:50]}...')

        # Spell correction suggestion
        corrected, suggestions = _spell.correct_text(message)
        if suggestions and corrected != message:
            # Send a did-you-mean suggestion to client
            logger.info(f"[DEBUG] Sending spell suggestion: {corrected}")
            emit('did_you_mean', {'original': message, 'suggested': corrected})

        # Update prompt to corrected version but include original in context
        prompt = corrected

        # Retry logic: try up to 3 times with exponential backoff
        attempts = 3
        backoff = 1.0
        last_exc = None

        for attempt in range(attempts):
            try:
                logger.info(f'[DEBUG] Attempt {attempt + 1} to get response from Gemini')
                text, tokens = _gemini.get_chat_response(prompt, [], model='gemini-flash-latest')
                logger.info(f'[DEBUG] Got response: {text[:100]}... ({tokens} tokens)')
                # Emit AI response to the connected client
                logger.info(f'[DEBUG] Emitting new_message to client')
                emit('new_message', {'role': 'ai', 'content': text, 'tokens': tokens})
                return
            except Exception as e:
                last_exc = e
                logger.warning('[DEBUG] Attempt %s failed: %s', attempt + 1, e)
                time.sleep(backoff)
                backoff *= 2

        # If all retries failed
        logger.error('[DEBUG] All retry attempts failed for message: %s', message)
        emit('message_error', {'message': str(last_exc)})

    except Exception as e:
        logger.exception('[DEBUG] Unhandled exception in handle_send_message: %s', e)
        emit('message_error', {'message': str(e)})
