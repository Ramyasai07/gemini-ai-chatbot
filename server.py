#!/usr/bin/env python3
"""
Simple WSGI HTTP Server - pure Python, no Werkzeug
This avoids the signal/threading issues with Flask/Werkzeug on Windows
"""
import os
import sys
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == '__main__':
    # Setup logging
    logging.basicConfig(
        level=logging.WARNING,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Validate API key
    if not os.getenv('GEMINI_API_KEY'):
        print("⚠️  Warning: GEMINI_API_KEY not found in .env")
    
    port = int(os.getenv('PORT', 5000))
    
    print(f"\n[START] Gemini AI Chatbot")
    print(f"[PORT] http://localhost:{port}\n")
    
    try:
        from backend import create_app
        
        print("[LOAD] Backend loaded")
        
        app = create_app()
        print("[CREATE] Flask app created\n")
        
        print(f"[LISTEN] Server starting on 0.0.0.0:{port}")
        print("[READY] Ready to receive requests\n")
        
        # Use Python's built-in HTTP server with WSGI adapter
        from wsgiref.simple_server import make_server
        
        # Create server
        server = make_server('0.0.0.0', port, app)
        
        # Start serving - continue even on errors
        print(f"[INFO] Serving WSGI application on 0.0.0.0:{port}")
        try:
            while True:
                try:
                    server.handle_request()  # Handle one request at a time
                except Exception as e:
                    print(f"[ERROR] Request handler error: {e}")
                    import traceback
                    traceback.print_exc()
        except KeyboardInterrupt:
            print(f"\n[STOP] Shutting down server...")
            sys.exit(0)
        
    except Exception as e:
        print(f"\n[ERROR] {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    except KeyboardInterrupt:
        print(f"\n[STOP] Shutting down server...")
        sys.exit(0)
