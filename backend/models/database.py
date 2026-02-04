"""
Database initialization and models using SQLAlchemy with SQLite.
Handles all data persistence for conversations, messages, and attachments.
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()


class User(db.Model):
    """User model for storing user preferences and settings."""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    api_key = db.Column(db.String(500), nullable=True)  # User's Gemini API key
    theme_preference = db.Column(db.String(20), default='dark')  # dark or light
    preferred_model = db.Column(db.String(50), default='gemini-pro')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    conversations = db.relationship('Conversation', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'theme_preference': self.theme_preference,
            'preferred_model': self.preferred_model,
            'created_at': self.created_at.isoformat()
        }


class Conversation(db.Model):
    """Conversation model for storing chat sessions."""
    __tablename__ = 'conversations'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), default='New Conversation')
    description = db.Column(db.Text, nullable=True)
    model_used = db.Column(db.String(50), default='gemini-pro')
    is_favorite = db.Column(db.Boolean, default=False)
    is_archived = db.Column(db.Boolean, default=False)
    total_tokens = db.Column(db.Integer, default=0)
    total_cost = db.Column(db.Float, default=0.0)  # Estimated API cost
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    messages = db.relationship('Message', backref='conversation', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_messages=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'model_used': self.model_used,
            'is_favorite': self.is_favorite,
            'is_archived': self.is_archived,
            'total_tokens': self.total_tokens,
            'total_cost': self.total_cost,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'message_count': len(self.messages)
        }
        if include_messages:
            data['messages'] = [msg.to_dict(include_attachments=True) for msg in self.messages]
        return data


class Message(db.Model):
    """Message model for storing individual chat messages."""
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    tokens_used = db.Column(db.Integer, default=0)
    is_edited = db.Column(db.Boolean, default=False)
    has_search = db.Column(db.Boolean, default=False)  # Used live search
    search_query = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    attachments = db.relationship('Attachment', backref='message', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, include_attachments=False):
        data = {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'tokens_used': self.tokens_used,
            'is_edited': self.is_edited,
            'has_search': self.has_search,
            'search_query': self.search_query,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_attachments:
            data['attachments'] = [att.to_dict() for att in self.attachments]
        return data


class Attachment(db.Model):
    """Attachment model for storing file uploads with messages."""
    __tablename__ = 'attachments'
    
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)  # 'pdf', 'txt', 'image', 'docx'
    file_size = db.Column(db.Integer, default=0)  # in bytes
    file_path = db.Column(db.String(500), nullable=False)  # Relative path to file
    content_preview = db.Column(db.Text, nullable=True)  # First 500 chars of text
    mime_type = db.Column(db.String(100), nullable=False)
    upload_status = db.Column(db.String(20), default='completed')  # 'uploading', 'completed', 'failed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'content_preview': self.content_preview,
            'upload_status': self.upload_status,
            'created_at': self.created_at.isoformat()
        }


class SearchResult(db.Model):
    """Cache for search results to reduce API calls."""
    __tablename__ = 'search_results'
    
    id = db.Column(db.Integer, primary_key=True)
    query = db.Column(db.String(500), nullable=False)
    result_data = db.Column(db.JSON, nullable=False)  # Store JSON search results
    source = db.Column(db.String(50), default='serp')  # serp, google, etc.
    cached_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)  # When cache expires
    
    def to_dict(self):
        return {
            'id': self.id,
            'query': self.query,
            'result_data': self.result_data,
            'source': self.source,
            'cached_at': self.cached_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None
        }


def init_db(backend):
    """Initialize database with Flask backend."""
    db.init_app(backend)
    with backend.app_context():
        db.create_all()
        print("[OK] Database initialized successfully")
