/**
 * API Utility Functions
 * Handles all API communication with the backend
 */

class API {
    constructor(baseURL = '/api/v1') {
        this.baseURL = baseURL;
        this.headers = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                headers: this.headers,
                ...options
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error.message);
            throw error;
        }
    }

    /**
     * Chat endpoint
     */
    async sendMessage(message, conversationId = null, model = 'gemini-pro') {
        return this.request('/chat', {
            method: 'POST',
            body: JSON.stringify({
                message,
                conversation_id: conversationId,
                model
            })
        });
    }

    /**
     * Save AI response after streaming
     */
    async saveResponse(conversationId, responseText, tokensUsed = 0) {
        return this.request('/chat/save-response', {
            method: 'POST',
            body: JSON.stringify({
                conversation_id: conversationId,
                response: responseText,
                tokens_used: tokensUsed
            })
        });
    }

    /**
     * Get all conversations
     */
    async getConversations(sortBy = 'updated_at', order = 'desc', favoriteOnly = false) {
        const params = new URLSearchParams({
            sort_by: sortBy,
            order: order,
            favorite: favoriteOnly
        });
        return this.request(`/conversations?${params}`);
    }

    /**
     * Get specific conversation
     */
    async getConversation(conversationId) {
        return this.request(`/conversations/${conversationId}`);
    }

    /**
     * Create new conversation
     */
    async createConversation(title = 'New Conversation', model = 'gemini-pro') {
        return this.request('/conversations', {
            method: 'POST',
            body: JSON.stringify({
                title,
                model
            })
        });
    }

    /**
     * Update conversation
     */
    async updateConversation(conversationId, data) {
        return this.request(`/conversations/${conversationId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * Delete conversation
     */
    async deleteConversation(conversationId) {
        return this.request(`/conversations/${conversationId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Search conversations
     */
    async searchConversations(query) {
        const params = new URLSearchParams({ q: query });
        return this.request(`/conversations/search?${params}`);
    }

    /**
     * Export conversation
     */
    async exportConversation(conversationId, format = 'json') {
        const params = new URLSearchParams({ format });
        return this.request(`/conversations/${conversationId}/export?${params}`);
    }

    /**
     * Upload file
     */
    async uploadFile(file, messageId = null) {
        const formData = new FormData();
        formData.append('file', file);
        if (messageId) formData.append('message_id', messageId);

        const response = await fetch(`${this.baseURL}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        return response.json();
    }

    /**
     * Get file info
     */
    async getFile(attachmentId) {
        return this.request(`/files/${attachmentId}`);
    }

    /**
     * Delete file
     */
    async deleteFile(attachmentId) {
        return this.request(`/files/${attachmentId}`, {
            method: 'DELETE'
        });
    }

    /**
     * List files for conversation
     */
    async listFiles(conversationId) {
        const params = new URLSearchParams({ conversation_id: conversationId });
        return this.request(`/files?${params}`);
    }

    /**
     * Process file to extract text
     */
    async processFile(attachmentId) {
        return this.request('/files/process', {
            method: 'POST',
            body: JSON.stringify({
                attachment_id: attachmentId
            })
        });
    }

    /**
     * Get available models
     */
    async getModels() {
        return this.request('/models');
    }

    /**
     * Count tokens for text
     */
    async countTokens(text, model = 'gemini-pro') {
        return this.request('/tokens/count', {
            method: 'POST',
            body: JSON.stringify({
                text,
                model
            })
        });
    }

    /**
     * Edit message
     */
    async editMessage(messageId, newContent) {
        return this.request(`/chat/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify({
                content: newContent
            })
        });
    }

    /**
     * Delete message
     */
    async deleteMessage(messageId) {
        return this.request(`/chat/${messageId}`, {
            method: 'DELETE'
        });
    }
}

// Create global API instance
const api = new API();
