/**
 * Chat Module
 * Handles all chat functionality and message management
 */

class ChatManager {
    constructor() {
        this.currentConversationId = null;
        this.messageHistory = [];
        this.isLoading = false;
        this.currentStreamId = null;
        this.uploadedFiles = [];
        this.init();
    }

    init() {
        this.setupDOM();
        this.setupEventListeners();
        this.loadConversations();
        // Initialize socket streaming connection
        if (typeof streaming !== 'undefined' && streaming.connect) {
            streaming.connect();

            // Connection status updates
            streaming.on('connection', (status) => {
                const indicator = this.connectionIndicator || document.getElementById('connection-indicator');
                if (!indicator) return;
                if (status.status === 'connected') {
                    indicator.classList.remove('offline');
                    indicator.classList.add('online');
                    indicator.title = 'Connected';
                } else {
                    indicator.classList.remove('online');
                    indicator.classList.add('offline');
                    indicator.title = 'Disconnected';
                }
            });

            // AI reply handler
            streaming.on('new_message', (data) => {
                // Remove any typing indicator
                const typing = document.querySelector('.typing-indicator');
                if (typing && typing.closest('.message')) typing.closest('.message').remove();
                this.addMessage(data.content, 'assistant');
                this.scrollToBottom();
            });

            streaming.on('message_error', (err) => {
                const typing = document.querySelector('.typing-indicator');
                if (typing && typing.closest('.message')) typing.closest('.message').remove();
                this.addMessage('Error: ' + (err.message || 'Unknown error'), 'error');
            });

            streaming.on('did_you_mean', (data) => {
                // Show suggestion to user
                this.showNotification(`Did you mean: ${data.suggested}?`, 'info');
            });
        }
    }

    /**
     * Setup DOM references
     */
    setupDOM() {
        this.messagesContainer = document.getElementById('messages-container');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.fileInput = document.getElementById('file-input');
        this.uploadBtn = document.getElementById('upload-btn');
        this.voiceBtn = document.getElementById('voice-btn');
        this.newChatBtn = document.getElementById('new-chat');
        this.conversationsList = document.getElementById('conversations-list');
        this.chatTitle = document.getElementById('chat-title');
        this.connectionIndicator = document.getElementById('connection-indicator');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // File upload
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadedFilesDiv.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadedFilesDiv.addEventListener('drop', (e) => this.handleFileDrop(e));

        // New chat
        this.newChatBtn.addEventListener('click', () => this.createNewConversation());

        // Message input tracking for token count
        this.messageInput.addEventListener('input', debounce(() => this.updateTokenCount(), 500));

        // Clear chat
        if (this.clearChatBtn) {
            this.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
        }

        // Message input enable/disable
        this.messageInput.addEventListener('input', () => this.updateSendButtonState());

        // Send button null check and event listener
        const sendButton = document.getElementById('send-button');
        if (!sendButton) {
            console.error('[ChatManager] Send button not found in DOM.');
            return;
        }
        sendButton.addEventListener('click', () => {
            console.log('[ChatManager] Send button clicked.');
            this.handleSendMessage();
        });
    }

    /**
     * Enhanced debugging for API requests
     */
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isLoading) return;

        this.isLoading = true;
        this.sendBtn.disabled = true;

        try {
            // Validate API key
            const apiKey = this.getApiKey();
            if (!apiKey) {
                throw new Error('Missing API key. Please configure your API settings.');
            }

            // If no conversation, create one
            if (!this.currentConversationId) {
                await this.createNewConversation();
            }

            // Add user message to UI
            this.addMessage(message, 'user');
            this.messageInput.value = '';
            this.messageInput.focus();

            // Show typing indicator
            const typingBubble = this.addMessage('', 'assistant', true);

            // Prepare headers and payload
            const headers = {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2026-01-16',
            };

            const payload = {
                message,
                conversation: this.messageHistory,
                conversation_id: this.currentConversationId,
                model: this.modelBadge ? this.modelBadge.textContent : 'gemini-pro',
            };

            console.log('[sendMessage] Sending payload:', payload);

            // Send message with retry logic
            const maxRetries = 3;
            let attempt = 0;
            let success = false;

            while (attempt < maxRetries && !success) {
                try {
                    console.log(`[sendMessage] Attempt ${attempt + 1}: Sending message`);
                    const response = await fetch('/api/v1/chat', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(payload),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error('[sendMessage] API Error Response:', errorData);
                        throw new Error(`API Error: ${response.status} ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('[sendMessage] API Response:', data);

                    // Replace typing indicator with AI response
                    typingBubble.remove();
                    this.addMessage(data.content, 'assistant');
                    success = true;
                } catch (error) {
                    attempt++;
                    console.error(`[sendMessage] Attempt ${attempt} failed:`, error);
                    if (attempt >= maxRetries) {
                        this.showError('Failed to send message after multiple attempts. Please check your network or API settings.');
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.error('[sendMessage] Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
        } finally {
            this.isLoading = false;
            this.updateSendButtonState();
        }
    }

    /**
     * Retrieve API key from configuration
     */
    getApiKey() {
        // Replace with actual logic to retrieve API key
        return 'your-api-key';
    }

    /**
     * Add message to chat
     */
    addMessage(content, role = 'user', isLoading = false) {
        // Clear welcome screen if this is the first message
        if (this.messagesContainer.children.length === 1 && !this.messageHistory.length) {
            this.messagesContainer.innerHTML = '';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${role}`;

        let html = '';

        if (isLoading) {
            html = '<div class="message-bubble">' + createTypingIndicator().outerHTML + '</div>';
        } else {
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            bubble.innerHTML = formatMessageText(escapeHTML(content));
            
            html = bubble.outerHTML;

            // Add message actions for non-error messages
            if (role !== 'error') {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'message-actions';
                actionsDiv.innerHTML = `
                    <button class="message-action-btn copy-btn" title="Copy">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                            <path d="M3 6v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3M3 6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2" stroke-width="2"/>
                        </svg>
                    </button>
                    ${role === 'user' ? '<button class="message-action-btn edit-btn" title="Edit"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' : ''}
                    ${role === 'user' ? '<button class="message-action-btn delete-btn" title="Delete"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' : ''}
                `;
                html += actionsDiv.outerHTML;
            }
        }

        messageDiv.innerHTML = html;

        // Add event listeners
        const copyBtn = messageDiv.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyMessage(content));
        }

        const editBtn = messageDiv.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.editMessage(messageDiv, content));
        }

        const deleteBtn = messageDiv.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => messageDiv.remove());
        }

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        return messageDiv;
    }

    /**
     * Copy message to clipboard
     */
    copyMessage(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Copied to clipboard!', 'success');
        });
    }

    /**
     * Edit message
     */
    editMessage(messageElement, originalText) {
        // TODO: Implement edit functionality
        console.log('Edit message:', originalText);
    }

    /**
     * Scroll to bottom of messages
     */
    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 0);
    }

    /**
     * Create new conversation
     */
    async createNewConversation() {
        try {
            const response = await api.createConversation();
            this.currentConversationId = response.id;
            this.messageHistory = [];
            this.uploadedFiles = [];
            this.messagesContainer.innerHTML = '<div class="welcome-screen"><div class="welcome-icon"></div><h2>New Conversation</h2><p>Start a conversation, ask questions, or upload files.</p></div>';
            this.chatTitle.textContent = response.title;
            await this.loadConversations();
        } catch (error) {
            console.error('Error creating conversation:', error);
            this.showError('Failed to create conversation');
        }
    }

    /**
     * Load conversations
     */
    async loadConversations() {
        try {
            const data = await api.getConversations();
            this.renderConversations(data.conversations);
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    }

    /**
     * Render conversations list
     */
    renderConversations(conversations) {
        this.conversationsList.innerHTML = '';

        if (conversations.length === 0) {
            this.conversationsList.innerHTML = '<div style="color: var(--text-tertiary); padding: var(--space-lg); text-align: center;">No conversations yet</div>';
            return;
        }

        conversations.forEach(conv => {
            const item = document.createElement('div');
            item.className = `conversation-item ${conv.id === this.currentConversationId ? 'active' : ''}`;
            item.innerHTML = `
                <div class="conversation-item-content">
                    <div class="conversation-info">
                        <div class="conversation-title">${escapeHTML(conv.title)}</div>
                        <div class="conversation-preview">${conv.preview || 'No messages'}</div>
                    </div>
                    <div class="conversation-actions">
                        <button class="conversation-btn favorite-btn" title="Favorite">
                            ${conv.is_favorite ? '⭐' : '☆'}
                        </button>
                        <button class="conversation-btn delete-btn" title="Delete">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            `;

            // Load conversation on click
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.conversation-actions')) {
                    this.loadConversation(conv.id);
                }
            });

            // Favorite button
            const favoriteBtn = item.querySelector('.favorite-btn');
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(conv.id, !conv.is_favorite);
            });

            // Delete button
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this conversation?')) {
                    this.deleteConversation(conv.id);
                }
            });

            this.conversationsList.appendChild(item);
        });
    }

    /**
     * Load conversation
     */
    async loadConversation(conversationId) {
        try {
            const response = await api.getConversation(conversationId);
            this.currentConversationId = conversationId;
            this.chatTitle.textContent = response.title;
            this.messageHistory = response.messages;

            // Render messages
            this.messagesContainer.innerHTML = '';
            response.messages.forEach(msg => {
                this.addMessage(msg.content, msg.role);
            });

            this.scrollToBottom();
            this.loadConversations(); // Update sidebar
        } catch (error) {
            console.error('Error loading conversation:', error);
            this.showError('Failed to load conversation');
        }
    }

    /**
     * Delete conversation
     */
    async deleteConversation(conversationId) {
        try {
            await api.deleteConversation(conversationId);
            if (this.currentConversationId === conversationId) {
                this.currentConversationId = null;
                this.messagesContainer.innerHTML = '<div class="welcome-screen"><div class="welcome-icon"></div><h2>Welcome</h2></div>';
            }
            await this.loadConversations();
        } catch (error) {
            console.error('Error deleting conversation:', error);
            this.showError('Failed to delete conversation');
        }
    }

    /**
     * Toggle favorite conversation
     */
    async toggleFavorite(conversationId, isFavorite) {
        try {
            await api.updateConversation(conversationId, { is_favorite: isFavorite });
            await this.loadConversations();
        } catch (error) {
            console.error('Error updating favorite:', error);
        }
    }

    /**
     * Clear current chat
     */
    clearCurrentChat() {
        if (confirm('Clear all messages in this conversation?')) {
            this.messagesContainer.innerHTML = '<div class="welcome-screen"><div class="welcome-icon"></div><h2>Conversation Cleared</h2></div>';
        }
    }

    /**
     * Update token count
     */
    async updateTokenCount() {
        const text = this.messageInput.value;
        if (!text) {
            this.tokenInfo.style.display = 'none';
            return;
        }

        try {
            const response = await api.countTokens(text);
            this.tokenCount.textContent = response.tokens;
            this.tokenInfo.style.display = 'block';
        } catch (error) {
            console.error('Error counting tokens:', error);
        }
    }

    /**
     * Update send button state
     */
    updateSendButtonState() {
        const hasMessage = this.messageInput.value.trim().length > 0;
        this.sendBtn.disabled = !hasMessage || this.isLoading;
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }

    /**
     * Show error
     */
    showError(message) {
        this.showNotification(message, 'error');
        this.addMessage(message, 'error');
    }

    /**
     * Handle file selection
     */
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => this.uploadFile(file));
        this.fileInput.value = '';
    }

    /**
     * Handle drag and drop
     */
    handleDragOver(event) {
        event.preventDefault();
        event.target.classList.add('drag-over');
    }

    /**
     * Handle file drop
     */
    handleFileDrop(event) {
        event.preventDefault();
        event.target.classList.remove('drag-over');
        const files = Array.from(event.dataTransfer.files);
        files.forEach(file => this.uploadFile(file));
    }

    /**
     * Upload file
     */
    async uploadFile(file) {
        try {
            const response = await api.uploadFile(file);
            this.uploadedFiles.push(response);
            this.renderUploadedFiles();
            this.showNotification(`Uploaded: ${file.name}`, 'success');
        } catch (error) {
            console.error('Upload error:', error);
            this.showError(`Failed to upload: ${file.name}`);
        }
    }

    /**
     * Render uploaded files
     */
    renderUploadedFiles() {
        if (this.uploadedFiles.length === 0) {
            this.uploadedFilesDiv.style.display = 'none';
            return;
        }

        this.uploadedFilesDiv.style.display = 'flex';
        this.uploadedFilesDiv.innerHTML = '';

        this.uploadedFiles.forEach(file => {
            const fileTag = document.createElement('div');
            fileTag.className = 'uploaded-file';
            fileTag.innerHTML = `
                <div class="uploaded-file-icon">📄</div>
                <span>${escapeHTML(file.filename)}</span>
                <span class="uploaded-file-remove">×</span>
            `;

            fileTag.querySelector('.uploaded-file-remove').addEventListener('click', () => {
                this.uploadedFiles = this.uploadedFiles.filter(f => f.attachment_id !== file.attachment_id);
                this.renderUploadedFiles();
            });

            this.uploadedFilesDiv.appendChild(fileTag);
        });
    }
}

// Initialize chat manager
const chatManager = new ChatManager();
