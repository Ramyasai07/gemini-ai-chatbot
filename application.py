"""
Application entry point.
Run with: python application.py
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import after env setup
from backend import create_app

# Create Flask app
app = create_app()


if __name__ == '__main__':
    # Verify API keys are configured
    if not os.getenv('GEMINI_API_KEY'):
        print("⚠️  Warning: GEMINI_API_KEY not found in environment")
        print("Please set it in .env file or environment variables")
    
    # Run development server
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    print(f"\n🚀 Starting Gemini AI Chatbot...")
    print(f"📍 http://localhost:{port}")
    print(f"🔧 Debug mode: {debug}\n")
    
    # Run with Flask's development server (threaded, no reloader)
    app.run(
        host='0.0.0.0',
        port=port,
        debug=False,
        use_reloader=False,
        threaded=True
    )
