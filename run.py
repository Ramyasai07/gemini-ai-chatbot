"""
Gemini Chatbot Server - HTTP server (avoids Flask/Werkzeug crash on Windows)
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Expose the Flask app instance for Flask CLI
from backend import create_app
app = create_app()

if __name__ == '__main__':
    import logging
    # Enable ALL logging to see errors
    logging.basicConfig(level=logging.DEBUG)
    
    # Validate API key
    if not os.getenv('GEMINI_API_KEY'):
        print("⚠️  Warning: GEMINI_API_KEY not found in .env")
    
    port = int(os.getenv('PORT', 5000))
    
    print(f"\n[START] Gemini AI Chatbot")
    print(f"[OK] http://localhost:{port}\n")
    
    try:
        
        print("[IMPORT] Backend loaded")
        
        print("[CREATE] Flask app created\n")
        
        print(f"[LISTEN] Server starting on http://0.0.0.0:{port}")
        print("[OK] Ready to receive requests\n")
        
        # Use Flask's development server with special Windows configuration
        # Disable reloader and debugger which cause signal/threading issues on Windows
        app.run(
            host='0.0.0.0',
            port=port,
            debug=False,
            use_reloader=False,
            threaded=True  # Enable threading for handling concurrent requests
        )
        
    except KeyboardInterrupt:
        print("\n[STOP] Server stopped")
        sys.exit(0)
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    except KeyboardInterrupt:
        print("\n[STOP] Server stopped")
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)







