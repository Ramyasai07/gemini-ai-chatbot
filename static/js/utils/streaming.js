/**
 * Socket.IO-based Streaming Manager
 * Provides reliable message delivery with reconnection, exponential backoff,
 * heartbeat via Socket.IO ping/pong, and saves unsent messages locally.
 */

class SocketManager {
    constructor() {
        this.socket = null;
        this.url = window.location.origin;
        this.eventHandlers = new Map();
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 6;
        this.baseBackoff = 500; // ms
        this.pendingMessagesKey = 'pending_messages';
        this._initLocalQueue();
    }

    _initLocalQueue() {
        try {
            const raw = localStorage.getItem(this.pendingMessagesKey) || '[]';
            this.localQueue = JSON.parse(raw);
        } catch (e) {
            this.localQueue = [];
        }
    }

    _persistLocalQueue() {
        localStorage.setItem(this.pendingMessagesKey, JSON.stringify(this.localQueue));
    }

    connect() {
        if (this.socket && this.connected) {
            console.log('[SocketIO] Already connected, returning');
            return;
        }

        console.log('[SocketIO] Attempting to connect to:', this.url);

        // Create socket using global io (socket.io client included in page)
        try {
            this.socket = io(this.url, {
                transports: ['websocket', 'polling'],
                reconnectionAttempts: this.maxReconnectAttempts,
                autoConnect: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000
            });

            console.log('[SocketIO] Socket created:', !!this.socket);

            this.socket.on('connect', () => {
                console.log('[SocketIO] ✓ Connected! SID:', this.socket.id);
                this.connected = true;
                this.reconnectAttempts = 0;
                this._emitEvent('connection', {status: 'connected'});
                // flush local queue
                this._flushLocalQueue();
            });

            this.socket.on('disconnect', (reason) => {
                console.log('[SocketIO] ✗ Disconnected:', reason);
                this.connected = false;
                this._emitEvent('connection', {status: 'disconnected', reason});
            });

            this.socket.on('connect_error', (err) => {
                console.error('[SocketIO] ✗ Connection error:', err);
                this._emitEvent('connection', {status: 'error', error: err});
            });

            this.socket.on('new_message', (data) => {
                console.log('[SocketIO] ✓ Received new_message:', data);
                this._emitEvent('new_message', data);
            });

            this.socket.on('message_error', (data) => {
                console.log('[SocketIO] ✓ Received message_error:', data);
                this._emitEvent('message_error', data);
            });

            this.socket.on('did_you_mean', (data) => {
                console.log('[SocketIO] ✓ Received did_you_mean:', data);
                this._emitEvent('did_you_mean', data);
            });

            // Generic event forwarder for debugging
            this.socket.onAny((event, payload) => {
                console.log('[SocketIO] Event:', event, payload);
                // forward other events
                this._emitEvent(event, payload);
            });

        } catch (e) {
            console.error('[SocketIO] Failed to create socket:', e);
        }
    }

    disconnect() {
        if (!this.socket) return;
        this.socket.disconnect();
        this.connected = false;
    }

    on(event, cb) {
        if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
        this.eventHandlers.get(event).push(cb);
    }

    off(event, cb) {
        if (!this.eventHandlers.has(event)) return;
        const arr = this.eventHandlers.get(event).filter(fn => fn !== cb);
        this.eventHandlers.set(event, arr);
    }

    _emitEvent(event, payload) {
        const handlers = this.eventHandlers.get(event) || [];
        handlers.forEach(fn => {
            try { fn(payload); } catch (e) { console.error(e); }
        });
    }

    sendMessage(message, meta = {}) {
        const payload = Object.assign({message}, meta);

        console.log('[SocketIO] Attempting to send message:', {
            message: message.substring(0, 50) + '...',
            connected: this.connected,
            socketReady: !!this.socket,
            socketConnected: this.socket && this.socket.connected
        });

        if (this.connected && this.socket && this.socket.connected) {
            try {
                console.log('[SocketIO] Emitting "send_message" with payload:', payload);
                this.socket.emit('send_message', payload);
                console.log('[SocketIO] ✓ Message emitted successfully');
                return true;
            } catch (e) {
                console.error('[SocketIO] ✗ Emit failed:', e);
                console.warn('Emit failed, queueing message', e);
            }
        } else {
            console.warn('[SocketIO] Not connected. Connected:', this.connected, 'Socket:', !!this.socket);
        }

        // Queue locally for retry
        console.log('[SocketIO] Queueing message for later delivery');
        this.localQueue.push(payload);
        this._persistLocalQueue();
        return false;
    }

    _flushLocalQueue() {
        if (!this.connected || !this.socket) return;
        while (this.localQueue.length > 0) {
            const item = this.localQueue.shift();
            try {
                this.socket.emit('send_message', item);
            } catch (e) {
                console.warn('Failed to flush queued message', e);
                // Put it back and abort
                this.localQueue.unshift(item);
                break;
            }
        }
        this._persistLocalQueue();
    }
}

// Create and export a singleton
const streaming = new SocketManager();

/**
 * Utility to create typing indicator
 */
function createTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    return div;
}

/**
 * Utility to format message with markdown
 */
function formatMessageText(text) {
    // Basic markdown support
    let formatted = text
        // Code blocks
        .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Headings
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        // Line breaks
        .replace(/\n/g, '<br>')
        // Lists
        .replace(/^\* (.*?)$/gm, '<li>$1</li>')
        .replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');

    return formatted;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Debounce function for API calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
