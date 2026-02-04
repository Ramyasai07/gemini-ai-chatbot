connect() {
    if (typeof window.io !== "function") {
        console.warn("[SocketIO] Socket.IO not available, skipping connection");
        this.socket = null;
        return;
    }

    try {
        this.socket = window.io(this.serverUrl);
        console.log(`[SocketIO] Connected to: ${this.serverUrl}`);
    } catch (error) {
        console.error("[SocketIO] Socket connection failed:", error);
        this.socket = null;
    }
}
