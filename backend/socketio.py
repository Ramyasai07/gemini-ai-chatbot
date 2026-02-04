from flask_socketio import SocketIO

# Configure SocketIO with CORS allowed for local dev
socketio = SocketIO(
	cors_allowed_origins='*',
	ping_interval=25,
	ping_timeout=60,
	logger=True,
	engineio_logger=True,
	async_mode='threading'
)

# Add an init_app method to integrate with Flask

def init_app(app):
    socketio.init_app(app)
