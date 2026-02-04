/**
 * Files Module
 * Handles file management and processing
 */

class FileManager {
    constructor() {
        this.uploadedFiles = new Map();
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Handled by ChatManager
    }

    /**
     * Validate file
     */
    validateFile(file) {
        // Check file size
        if (file.size > this.maxFileSize) {
            return {
                valid: false,
                error: `File too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB`
            };
        }

        // Check file type
        const allowedTypes = [
            'application/pdf',
            'text/plain',
            'text/markdown',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png',
            'image/jpeg',
            'image/gif',
            'image/webp',
            'application/json'
        ];

        if (!allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: 'File type not supported'
            };
        }

        return { valid: true };
    }

    /**
     * Get file icon based on type
     */
    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType === 'application/pdf') return '📕';
        if (mimeType === 'text/plain') return '📄';
        if (mimeType.includes('word')) return '📘';
        if (mimeType === 'application/json') return '📊';
        return '📎';
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Process file and extract text
     */
    async processFile(attachmentId) {
        try {
            const response = await api.processFile(attachmentId);
            return response;
        } catch (error) {
            console.error('Error processing file:', error);
            return null;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(attachmentId) {
        try {
            await api.deleteFile(attachmentId);
            this.uploadedFiles.delete(attachmentId);
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }

    /**
     * Get file list for conversation
     */
    async getFilesForConversation(conversationId) {
        try {
            const response = await api.listFiles(conversationId);
            return response.files || [];
        } catch (error) {
            console.error('Error getting files:', error);
            return [];
        }
    }
}

// Initialize file manager
const fileManager = new FileManager();
