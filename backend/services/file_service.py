"""
File Service - Handles file uploads, processing, and extraction.
Supports PDF, TXT, DOCX, and image files.
"""

import os
import logging
from typing import Optional, Tuple
import json
from datetime import datetime
from werkzeug.utils import secure_filename
import mimetypes

logger = logging.getLogger(__name__)


class FileService:
    """Service for handling file uploads and processing."""
    
    # Allowed file types
    ALLOWED_EXTENSIONS = {
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc': 'application/msword',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'md': 'text/markdown',
        'json': 'application/json'
    }
    
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
    def __init__(self, upload_folder: str = 'uploads'):
        """Initialize file service."""
        self.upload_folder = upload_folder
        os.makedirs(upload_folder, exist_ok=True)
        logger.info(f"✓ File service initialized with upload folder: {upload_folder}")
    
    def is_allowed_file(self, filename: str) -> bool:
        """Check if file type is allowed."""
        if '.' not in filename:
            return False
        
        ext = filename.rsplit('.', 1)[1].lower()
        return ext in self.ALLOWED_EXTENSIONS
    
    def validate_file(self, filename: str, file_size: int) -> Tuple[bool, str]:
        """
        Validate file before upload.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not filename:
            return False, "No filename provided"
        
        if file_size > self.MAX_FILE_SIZE:
            return False, f"File too large. Maximum size: {self.MAX_FILE_SIZE / 1024 / 1024}MB"
        
        if not self.is_allowed_file(filename):
            return False, f"File type not allowed. Allowed: {', '.join(self.ALLOWED_EXTENSIONS.keys())}"
        
        return True, ""
    
    def save_file(self, file_obj, original_filename: str) -> Tuple[str, str]:
        """
        Save uploaded file securely.
        
        Args:
            file_obj: File object from request
            original_filename: Original filename
            
        Returns:
            Tuple of (saved_filename, file_path)
        """
        # Generate secure filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        filename = secure_filename(original_filename)
        filename = timestamp + filename
        
        filepath = os.path.join(self.upload_folder, filename)
        
        try:
            file_obj.save(filepath)
            logger.info(f"✓ File saved: {filename}")
            return filename, filepath
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise
    
    def delete_file(self, filename: str) -> bool:
        """Delete a file from uploads."""
        try:
            filepath = os.path.join(self.upload_folder, secure_filename(filename))
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.info(f"✓ File deleted: {filename}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return False
    
    def extract_text_from_file(self, filepath: str) -> Optional[str]:
        """Extract text content from various file types."""
        try:
            ext = filepath.rsplit('.', 1)[1].lower()
            
            if ext == 'txt':
                return self._extract_txt(filepath)
            elif ext == 'pdf':
                return self._extract_pdf(filepath)
            elif ext == 'docx':
                return self._extract_docx(filepath)
            elif ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
                return self._extract_image_text(filepath)
            elif ext == 'json':
                return self._extract_json(filepath)
            elif ext == 'md':
                return self._extract_txt(filepath)
            
            return None
        except Exception as e:
            logger.error(f"Error extracting text: {str(e)}")
            return None
    
    @staticmethod
    def _extract_txt(filepath: str) -> str:
        """Extract text from plain text file."""
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    
    @staticmethod
    def _extract_pdf(filepath: str) -> Optional[str]:
        """Extract text from PDF using PyPDF2."""
        try:
            from PyPDF2 import PdfReader
            
            text = ""
            with open(filepath, 'rb') as f:
                reader = PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() + "\n"
            
            return text if text.strip() else None
        except ImportError:
            logger.warning("PyPDF2 not installed - PDF extraction unavailable")
            return None
    
    @staticmethod
    def _extract_docx(filepath: str) -> Optional[str]:
        """Extract text from DOCX using python-docx."""
        try:
            from docx import Document
            
            doc = Document(filepath)
            text = "\n".join([para.text for para in doc.paragraphs])
            return text if text.strip() else None
        except ImportError:
            logger.warning("python-docx not installed - DOCX extraction unavailable")
            return None
    
    @staticmethod
    def _extract_image_text(filepath: str) -> Optional[str]:
        """Extract text from images using OCR."""
        try:
            from PIL import Image
            import pytesseract
            
            image = Image.open(filepath)
            text = pytesseract.image_to_string(image)
            return text if text.strip() else None
        except ImportError:
            logger.warning("pytesseract/PIL not installed - OCR unavailable")
            return "[Image file - OCR not available]"
    
    @staticmethod
    def _extract_json(filepath: str) -> str:
        """Extract and format JSON file."""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return json.dumps(data, indent=2)
    
    def get_file_preview(self, filepath: str, max_chars: int = 500) -> Optional[str]:
        """Get preview of file content."""
        try:
            text = self.extract_text_from_file(filepath)
            if text:
                return text[:max_chars] + ("..." if len(text) > max_chars else "")
            return None
        except Exception as e:
            logger.error(f"Error generating preview: {str(e)}")
            return None
    
    def get_file_info(self, filepath: str, original_filename: str) -> dict:
        """Get file information."""
        try:
            file_size = os.path.getsize(filepath)
            ext = filepath.rsplit('.', 1)[1].lower()
            mime_type = self.ALLOWED_EXTENSIONS.get(ext, 'application/octet-stream')
            
            return {
                'filename': original_filename,
                'size': file_size,
                'size_readable': self._format_size(file_size),
                'type': ext,
                'mime_type': mime_type,
                'uploaded_at': datetime.fromtimestamp(os.path.getctime(filepath)).isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting file info: {str(e)}")
            return {}
    
    @staticmethod
    def _format_size(size_bytes: int) -> str:
        """Format file size in human-readable format."""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.2f} TB"
