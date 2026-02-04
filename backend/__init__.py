"""
Flask application factory and initialization.
"""

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import logging
import os
from config import config
from backend.models.database import init_db


def create_app():
    """Create and configure Flask application."""
    
    # Get the path to parent directory (project root)
    basedir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    app = Flask(__name__, 
                static_folder=os.path.join(basedir, 'static'),
                template_folder=os.path.join(basedir, 'templates'))
    
    # Debug: check type immediately after creating Flask app
    try:
        logging.getLogger(__name__).debug('AFTER Flask(): %s', type(app))
    except Exception:
        pass
    # Load configuration
    app.config.from_object(config)
    
    # Setup logging
    setup_logging(app)
    
    # Initialize database
    init_db(app)
    
    # Enable CORS
    CORS(app, 
         origins=app.config['CORS_ORIGINS'],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'])
    
    # Register blueprints
    register_blueprints(app)
    # Print all registered routes for debugging
    print('Registered routes:', [str(rule) for rule in app.url_map.iter_rules()], flush=True)
    # Add Flask request logging
    @app.before_request
    def log_request():
        print(f'Incoming request: {request.method} {request.path}', flush=True)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Create upload folder
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Register frontend routes
    register_frontend_routes(app)
    
    # Initialize Socket.IO (if available)
    try:
        from backend.socketio import socketio
        # socketio.init_app(app)
        # Import handlers to register events
        # import backend.socket_handlers  # noqa: F401
        logging.getLogger(__name__).info('[OK] Socket.IO initialized (skipped)')
    except Exception as e:
        logging.getLogger(__name__).warning(f'Socket.IO not initialized: {e}')
    
    logger = logging.getLogger(__name__)
    logger.info("[OK] Flask application initialized")
    
    # Debug: verify the local `app` variable before returning
    try:
        logger.debug('DEBUG returning app: %s', type(app))
    except Exception:
        pass

    return app


def register_frontend_routes(app):
    """Register frontend routes."""
    
    @app.route('/')
    def index():
        """Serve main application"""
        return render_template('index-pro.html')
    
    @app.route('/health')
    def health():
        """Health check endpoint"""
        return jsonify({'status': 'healthy', 'version': '1.0.0'}), 200


def register_blueprints(app):
    """Register Flask blueprints."""
    # Only register working blueprints
    from backend.routes.chat import chat_bp
    app.register_blueprint(chat_bp)
    logger = logging.getLogger(__name__)
    logger.info("[OK] Blueprints registered")



def register_error_handlers(app):
    """Register error handlers."""
    
    @app.errorhandler(404)
    def not_found(error):
        return {
            'error': 'Resource not found',
            'message': str(error)
        }, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return {
            'error': 'Internal server error',
            'message': str(error)
        }, 500
    
    @app.errorhandler(403)
    def forbidden(error):
        return {
            'error': 'Forbidden',
            'message': str(error)
        }, 403


def setup_logging(app):
    """Setup application logging."""
    
    logging_level = logging.DEBUG if app.debug else logging.INFO
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging_level)
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(formatter)
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging_level)
    root_logger.addHandler(console_handler)
    
    # Suppress noisy loggers
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
