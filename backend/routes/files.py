"""
File Routes - Handle file uploads, processing, and management.
"""

from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from backend.models.database import db, Message, Attachment
from backend.services.file_service import FileService
import logging
import os

logger = logging.getLogger(__name__)

files_bp = Blueprint('files', __name__, url_prefix='/api/v1')

# Initialize file service
file_service = FileService('uploads')


@files_bp.route('/upload', methods=['POST'])
def upload_file():
    """Upload and process a file."""
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        message_id = request.form.get('message_id')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file
        is_valid, error_msg = file_service.validate_file(
            file.filename,
            len(file.read())
        )
        file.seek(0)  # Reset file pointer
        
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Save file
        filename, filepath = file_service.save_file(file, file.filename)
        
        # Get file info
        file_info = file_service.get_file_info(filepath, file.filename)
        
        # Extract text preview
        preview = file_service.get_file_preview(filepath, max_chars=200)
        
        # Create attachment record
        attachment = Attachment(
            message_id=message_id if message_id else None,
            filename=filename,
            original_filename=file.filename,
            file_type=file_info.get('type', 'unknown'),
            file_size=file_info.get('size', 0),
            file_path=f"uploads/{filename}",
            content_preview=preview,
            mime_type=file_info.get('mime_type', 'application/octet-stream'),
            upload_status='completed'
        )
        
        db.session.add(attachment)
        db.session.commit()
        
        logger.info(f"✓ File uploaded: {file.filename} ({file_info.get('size_readable')})")
        
        return jsonify({
            'attachment_id': attachment.id,
            'filename': attachment.original_filename,
            'file_type': attachment.file_type,
            'file_size': attachment.file_size,
            'size_readable': file_info.get('size_readable'),
            'preview': preview,
            'mime_type': attachment.mime_type
        }), 201
        
    except Exception as e:
        logger.error(f"Error in upload_file: {str(e)}")
        return jsonify({'error': str(e)}), 500


@files_bp.route('/files/<int:attachment_id>', methods=['GET'])
def get_file(attachment_id):
    """Get file information."""
    try:
        attachment = Attachment.query.get(attachment_id)
        
        if not attachment:
            return jsonify({'error': 'File not found'}), 404
        
        return jsonify(attachment.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Error in get_file: {str(e)}")
        return jsonify({'error': str(e)}), 500


@files_bp.route('/files/<int:attachment_id>', methods=['DELETE'])
def delete_file(attachment_id):
    """Delete an uploaded file."""
    try:
        attachment = Attachment.query.get(attachment_id)
        
        if not attachment:
            return jsonify({'error': 'File not found'}), 404
        
        # Delete physical file
        file_service.delete_file(attachment.filename)
        
        # Delete database record
        db.session.delete(attachment)
        db.session.commit()
        
        logger.info(f"✓ File deleted: {attachment.original_filename}")
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        logger.error(f"Error in delete_file: {str(e)}")
        return jsonify({'error': str(e)}), 500


@files_bp.route('/files/download/<int:attachment_id>', methods=['GET'])
def download_file(attachment_id):
    """Download a file."""
    try:
        attachment = Attachment.query.get(attachment_id)
        
        if not attachment:
            return jsonify({'error': 'File not found'}), 404
        
        filepath = attachment.file_path
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found on disk'}), 404
        
        return send_file(
            filepath,
            as_attachment=True,
            download_name=attachment.original_filename
        )
        
    except Exception as e:
        logger.error(f"Error in download_file: {str(e)}")
        return jsonify({'error': str(e)}), 500


@files_bp.route('/files', methods=['GET'])
def list_files():
    """List all files for a conversation or message."""
    try:
        message_id = request.args.get('message_id', type=int)
        conversation_id = request.args.get('conversation_id', type=int)
        
        query = Attachment.query
        
        if message_id:
            query = query.filter_by(message_id=message_id)
        elif conversation_id:
            # Get all attachments for messages in conversation
            from app.models.database import Message as MessageModel
            message_ids = db.session.query(MessageModel.id).filter_by(
                conversation_id=conversation_id
            ).all()
            message_ids = [m[0] for m in message_ids]
            query = query.filter(Attachment.message_id.in_(message_ids))
        
        attachments = query.all()
        
        return jsonify({
            'files': [att.to_dict() for att in attachments]
        }), 200
        
    except Exception as e:
        logger.error(f"Error in list_files: {str(e)}")
        return jsonify({'error': str(e)}), 500


@files_bp.route('/files/process', methods=['POST'])
def process_file():
    """Process a file and extract text for AI context."""
    try:
        data = request.get_json()
        attachment_id = data.get('attachment_id')
        
        attachment = Attachment.query.get(attachment_id)
        if not attachment:
            return jsonify({'error': 'File not found'}), 404
        
        # Extract text
        text_content = file_service.extract_text_from_file(attachment.file_path)
        
        if not text_content:
            return jsonify({
                'error': 'Could not extract text from file',
                'file_type': attachment.file_type
            }), 400
        
        return jsonify({
            'attachment_id': attachment_id,
            'filename': attachment.original_filename,
            'file_type': attachment.file_type,
            'content': text_content[:2000],  # First 2000 chars for preview
            'content_length': len(text_content),
            'has_more': len(text_content) > 2000
        }), 200
        
    except Exception as e:
        logger.error(f"Error in process_file: {str(e)}")
        return jsonify({'error': str(e)}), 500
