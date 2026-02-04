"""
Voice Service - Handles speech-to-text and text-to-speech using Web APIs.
Uses browser's Web Speech API for STT and Web Audio API for TTS.
"""

import os
import logging
from typing import Optional
import json

logger = logging.getLogger(__name__)


class VoiceService:
    """Service for voice input and output features.
    
    Note: This service is primarily for backend coordination.
    Actual voice processing happens in the browser using Web Speech API.
    """
    
    SUPPORTED_LANGUAGES = {
        'en-US': 'English (US)',
        'en-GB': 'English (UK)',
        'es-ES': 'Spanish',
        'es-MX': 'Spanish (Mexico)',
        'fr-FR': 'French',
        'de-DE': 'German',
        'it-IT': 'Italian',
        'ja-JP': 'Japanese',
        'zh-CN': 'Chinese (Simplified)',
        'zh-TW': 'Chinese (Traditional)',
        'ko-KR': 'Korean',
        'ru-RU': 'Russian',
        'ar-SA': 'Arabic',
        'hi-IN': 'Hindi',
        'pt-BR': 'Portuguese (Brazil)',
    }
    
    VOICE_MODELS = {
        'natural': {'pitch': 1.0, 'rate': 1.0, 'description': 'Natural speech'},
        'professional': {'pitch': 0.95, 'rate': 0.95, 'description': 'Professional tone'},
        'enthusiastic': {'pitch': 1.1, 'rate': 1.1, 'description': 'Enthusiastic tone'},
        'calm': {'pitch': 0.9, 'rate': 0.85, 'description': 'Calm, measured tone'},
        'fast': {'pitch': 1.0, 'rate': 1.3, 'description': 'Fast speech'},
    }
    
    def __init__(self):
        """Initialize voice service."""
        logger.info("✓ Voice service initialized")
    
    def get_supported_languages(self) -> dict:
        """Get list of supported languages for voice."""
        return self.SUPPORTED_LANGUAGES
    
    def get_voice_models(self) -> dict:
        """Get available voice models/styles."""
        return self.VOICE_MODELS
    
    def validate_language(self, language_code: str) -> bool:
        """Check if language is supported."""
        return language_code in self.SUPPORTED_LANGUAGES
    
    def validate_voice_model(self, model: str) -> bool:
        """Check if voice model is supported."""
        return model in self.VOICE_MODELS
    
    def get_voice_config(self, language: str, voice_model: str) -> Optional[dict]:
        """Get voice configuration for a language and model."""
        if not self.validate_language(language):
            return None
        
        if not self.validate_voice_model(voice_model):
            voice_model = 'natural'
        
        config = self.VOICE_MODELS[voice_model].copy()
        config['language'] = language
        config['language_name'] = self.SUPPORTED_LANGUAGES[language]
        
        return config
    
    @staticmethod
    def get_browser_voice_options() -> dict:
        """Get JavaScript configuration for browser voice features."""
        return {
            'speechRecognition': {
                'enabled': True,
                'continuous': False,
                'interimResults': True,
                'language': 'en-US'
            },
            'speechSynthesis': {
                'enabled': True,
                'rate': 1.0,
                'pitch': 1.0,
                'volume': 1.0
            }
        }
