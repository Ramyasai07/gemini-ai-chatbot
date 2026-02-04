/**
 * Main Application Script - Pro Version
 * Handles all UI interactions and REST API communication
 * Fixed: Voice messages, chat history, dark mode, settings, copy button
 */

class GeminiChatApp {
    constructor() {
        // Get DOM elements with null checks
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.messagesContainer = document.getElementById('messages-container');
        this.attachBtn = document.getElementById('attach-btn');
        this.voiceBtn = document.getElementById('voice-btn');
        this.fileInput = document.getElementById('file-input');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.chatsList = document.getElementById('chats-list');
        this.headerTitle = document.getElementById('header-title');
        this.connectionStatus = document.getElementById('connection-status');
        this.themeToggleBtn = document.getElementById('theme-toggle-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        this.inputForm = document.getElementById('input-form');

        if (!this.messageInput || !this.sendBtn || !this.messagesContainer || !this.inputForm) {
            console.error('[APP] Critical DOM elements missing. Check HTML element IDs.');
            return;
        }

        this.currentConversationId = null;
        this.conversationHistory = [];
        this.isWelcomeVisible = true;
        this.chats = [];
        this.fileSelected = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.setupAutoResize();
        this.loadChats();
        this.initializeTooltips();
        
        // Set initial welcome message
        if (this.messagesContainer.children.length === 0) {
            this.showWelcomeMessage();
        }
    }

    setupEventListeners() {
        if (!this.inputForm) {
            console.error('[APP] Input form not found');
            return;
        }
        
        this.inputForm.addEventListener('submit', (e) => this.handleSendMessage(e));
        
        if (!this.messageInput) {
            console.error('[APP] Message input not found');
            return;
        }
        
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage(e);
            }
        });

        // Voice button
        if (this.voiceBtn) {
            this.voiceBtn.addEventListener('click', () => this.handleVoiceMessage());
        }

        // File attachment
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // New chat button
        if (this.newChatBtn) {
            this.newChatBtn.addEventListener('click', () => this.createNewChat());
        }

        // Theme toggle
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Settings button
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => this.openSettings());
        }

        // Quick prompts (event delegation)
        this.messagesContainer.addEventListener('click', (e) => {
            if (e.target.closest('.quick-prompt-btn')) {
                const promptBtn = e.target.closest('.quick-prompt-btn');
                const prompt = promptBtn.dataset.prompt;
                if (prompt) {
                    this.messageInput.value = prompt;
                    this.handleSendMessage(new Event('submit'));
                }
            }
            
            // Also check for regular quick prompts (from welcome screen)
            if (e.target.closest('.quick-prompt')) {
                const promptBtn = e.target.closest('.quick-prompt');
                const prompt = promptBtn.dataset.prompt;
                if (prompt) {
                    this.messageInput.value = prompt;
                    this.handleSendMessage(new Event('submit'));
                }
            }
        });
    }

    async handleSendMessage(e) {
        e.preventDefault();
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        console.log('[APP] Sending message:', message);
        
        if (this.isWelcomeVisible) {
            this.clearWelcomeMessage();
            this.isWelcomeVisible = false;
            if (this.headerTitle) this.headerTitle.textContent = 'Chat';
        }
        
        this.addMessage(message, 'user');
        this.conversationHistory.push({ role: 'user', content: message });
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.sendBtn.disabled = true;
        
        await this.sendMessage(message);
    }

    deleteChat(chatId) {
        if (!confirm('Are you sure you want to delete this chat?')) return;
        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        chats = chats.filter(c => c.id !== chatId);
        localStorage.setItem('chats', JSON.stringify(chats));
        if (this.currentConversationId === chatId) {
            this.createNewChat();
        }
        this.loadChats();
    }

    async sendMessage(message) {
        if (!this.messagesContainer) {
            console.error('[STREAM] Messages container not found - cannot render');
            return;
        }
        
        const payload = {
            message: message || '',
            conversation: Array.isArray(this.conversationHistory) ? this.conversationHistory : []
        };
        
        try {
            const response = await fetch('/api/v1/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const text = await response.text();
                console.error('[STREAM] Error response:', text);
                throw new Error(`API error: ${response.status}`);
            }
            
            await this.streamResponse(response);
        } catch (error) {
            console.error('[STREAM] Fatal error:', error.message);
            this.removeTypingIndicator();
            if (this.sendBtn) this.sendBtn.disabled = false;
            this.addMessage('Error: ' + error.message, 'error');
        }
    }

    async streamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';
        let assistantMessageDiv = null;
        let assistantBubble = null;
        let streamStarted = false;
        
        this.addTypingIndicator();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n');
                buffer = lines.pop();
                
                for (let line of lines) {
                    line = line.trim();
                    if (!line.startsWith('data: ')) continue;
                    
                    const jsonStr = line.substring(6).trim();
                    if (!jsonStr) continue;
                    
                    try {
                        const json = JSON.parse(jsonStr);
                        
                        if (json.response) {
                            fullResponse += json.response;
                            
                            if (!streamStarted) {
                                this.removeTypingIndicator();
                                assistantMessageDiv = document.createElement('div');
                                assistantMessageDiv.className = 'message assistant';
                                assistantBubble = document.createElement('div');
                                assistantBubble.className = 'message-bubble';
                                assistantMessageDiv.appendChild(assistantBubble);
                                this.messagesContainer.appendChild(assistantMessageDiv);
                                streamStarted = true;
                            }
                            
                            if (assistantBubble) {
                                // Format the response as it streams
                                assistantBubble.innerHTML = this.formatMessage(fullResponse);
                                
                                // Add copy button if not already present
                                if (!assistantBubble.querySelector('.copy-btn') && streamStarted) {
                                    const copyBtn = document.createElement('button');
                                    copyBtn.className = 'copy-btn';
                                    copyBtn.setAttribute('aria-label', 'Copy message');
                                    copyBtn.innerHTML = `
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                                        </svg>
                                    `;
                                    copyBtn.addEventListener('click', () => this.copyToClipboard(fullResponse, copyBtn));
                                    assistantBubble.appendChild(copyBtn);
                                }
                                
                                this.scrollToBottom();
                            }
                        } else if (json.done) {
                            if (fullResponse.trim()) {
                                this.conversationHistory.push({
                                    role: 'assistant',
                                    content: fullResponse
                                });
                                this.saveCurrentChat();
                            }
                            this.removeTypingIndicator();
                        } else if (json.error) {
                            this.addMessage('Error: ' + json.error, 'error');
                            this.removeTypingIndicator();
                        }
                    } catch (e) {
                        console.error('[STREAM] Parse error:', e.message, '| Offending string:', jsonStr);
                    }
                }
            }
            
            // Process any remaining buffer
            if (buffer.trim()) {
                try {
                    const json = JSON.parse(buffer.trim());
                    if (json.response) {
                        fullResponse += json.response;
                    }
                } catch (e) {
                    console.error('[STREAM] Final parse error:', e.message);
                }
            }
            
            this.removeTypingIndicator();
            if (this.sendBtn) this.sendBtn.disabled = false;
            if (this.messageInput) this.messageInput.focus();
            
        } catch (error) {
            console.error('[STREAM] Fatal error:', error.message);
            this.removeTypingIndicator();
            if (this.sendBtn) this.sendBtn.disabled = false;
            this.addMessage('Error: ' + error.message, 'error');
        }
    }

    addMessage(content, role = 'user') {
        if (!this.messagesContainer) {
            console.error('[APP] Messages container not found - cannot render message');
            return;
        }
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        // Use comprehensive markdown formatting
        bubble.innerHTML = this.formatMessage(content);
        // Add copy button for assistant messages
        if (role === 'assistant') {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.setAttribute('aria-label', 'Copy message');
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
            `;
            copyBtn.addEventListener('click', () => this.copyToClipboard(content, copyBtn));
            bubble.appendChild(copyBtn);
        }
        messageDiv.appendChild(bubble);
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    // Comprehensive markdown to HTML formatter
    formatMessage(text) {
        if (!text) return '';
        // Escape HTML
        let html = text.replace(/[&<>]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[tag]));
        // Code blocks (```)
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Headers
        html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
        // Bold-italic
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Blockquotes
        html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
        // Horizontal rules
        html = html.replace(/^---$/gm, '<hr>');
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        // Lists (numbered)
        html = html.replace(/^(\d+)\. (.*)$/gm, '<ol><li>$2</li></ol>');
        // Lists (bulleted)
        html = html.replace(/^[-*] (.*)$/gm, '<ul><li>$1</li></ul>');
        // Paragraphs and line breaks
        html = html.replace(/\n{2,}/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = '<p>' + html + '</p>';
        // Merge adjacent <ul> and <ol>
        html = html.replace(/(<\/ul>)(<ul>)/g, '');
        html = html.replace(/(<\/ol>)(<ol>)/g, '');
        return html;
    }

    copyToClipboard(text, button) {
        const originalHTML = button.innerHTML;
        const originalBg = button.style.background;
        const originalColor = button.style.color;
        navigator.clipboard.writeText(text).then(() => {
            button.innerHTML = '<span style="font-size: 12px;">Copied!</span>';
            button.style.background = '#10b981';
            button.style.color = 'white';
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.style.background = originalBg;
                button.style.color = originalColor;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            button.innerHTML = '<span style="font-size: 12px;">Error!</span>';
            button.style.background = '#ef4444';
            button.style.color = 'white';
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.style.background = originalBg;
                button.style.color = originalColor;
            }, 2000);
        });
    }

    addTypingIndicator() {
        if (!this.messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        messageDiv.id = 'typing-indicator';

        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

        messageDiv.appendChild(indicator);
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    scrollToBottom() {
        const wrapper = document.querySelector('.messages-wrapper') || this.messagesContainer;
        if (wrapper) {
            setTimeout(() => {
                wrapper.scrollTop = wrapper.scrollHeight;
            }, 100);
        }
    }

    showWelcomeMessage() {
        if (!this.messagesContainer) return;
        
        this.messagesContainer.innerHTML = `
            <div class="welcome-section">
                <div class="welcome-icon">G</div>
                <h2 class="welcome-title">Hi! I'm Gemini</h2>
                <p class="welcome-subtitle">Your friendly AI assistant. Ask me anything!</p>
                
                <div class="quick-prompts">
                    <button class="quick-prompt-btn" data-prompt="Explain quantum computing in simple terms">
                        <span class="prompt-icon">🧠</span>
                        <span class="prompt-text">Learn something new</span>
                    </button>
                    <button class="quick-prompt-btn" data-prompt="Help me write a creative story about adventure">
                        <span class="prompt-icon">✨</span>
                        <span class="prompt-text">Get creative</span>
                    </button>
                    <button class="quick-prompt-btn" data-prompt="What are the best productivity tips?">
                        <span class="prompt-icon">⚡</span>
                        <span class="prompt-text">Boost productivity</span>
                    </button>
                </div>
            </div>
        `;
        
        this.isWelcomeVisible = true;
    }

    clearWelcomeMessage() {
        const welcomeSection = this.messagesContainer.querySelector('.welcome-section');
        if (welcomeSection) {
            welcomeSection.remove();
        }
    }

    handleFileSelect(e) {
        if (!this.messageInput) {
            console.error('[FILE] Missing message input element');
            return;
        }

        const files = e.target.files;
        if (files.length > 0) {
            const fileName = files[0].name;
            this.fileSelected = fileName;
            
            // Show file preview
            const previewDiv = document.getElementById('file-preview');
            const previewName = document.getElementById('file-preview-name');
            const previewRemove = document.getElementById('file-preview-remove');
            
            if (previewDiv && previewName) {
                previewName.textContent = fileName;
                previewDiv.style.display = 'flex';
                
                if (previewRemove) {
                    previewRemove.addEventListener('click', () => {
                        previewDiv.style.display = 'none';
                        this.fileSelected = null;
                        this.fileInput.value = '';
                    });
                }
            }
            
            this.messageInput.focus();
        }
    }

    handleVoiceMessage() {
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Speech recognition not supported in your browser');
            return;
        }

        if (!this.voiceBtn || !this.messageInput || !this.inputForm) {
            console.error('[VOICE] Missing required DOM elements');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        this.voiceBtn.style.background = 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)';
        this.voiceBtn.style.color = 'white';

        recognition.onstart = () => {
            this.voiceBtn.innerHTML = '<span style="font-size: 12px; font-weight: 600;">LISTENING...</span>';
        };

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            
            // Reset voice button
            this.voiceBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V21h14v-1.5c0-2.33-4.67-3.5-7-3.5zm6-7c0 .55.45 1 1 1s1-.45 1-1v-3c0-2.21-1.79-4-4-4-.55 0-1 .45-1 1s.45 1 1 1c1.1 0 2 .9 2 2v3z"></path></svg>';
            this.voiceBtn.style.background = '';
            this.voiceBtn.style.color = '';
            
            console.log('[VOICE] Transcript:', transcript);
            
            if (transcript.trim()) {
                this.messageInput.value = transcript;
                this.messageInput.focus();
                // Trigger send after a short delay
                setTimeout(() => {
                    this.inputForm.dispatchEvent(new Event('submit'));
                }, 100);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.voiceBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V21h14v-1.5c0-2.33-4.67-3.5-7-3.5zm6-7c0 .55.45 1 1 1s1-.45 1-1v-3c0-2.21-1.79-4-4-4-.55 0-1 .45-1 1s.45 1 1 1c1.1 0 2 .9 2 2v3z"></path></svg>';
            this.voiceBtn.style.background = '';
            this.voiceBtn.style.color = '';
            
            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please allow microphone access in your browser settings.');
            } else {
                alert('Voice error: ' + event.error);
            }
        };

        recognition.onend = () => {
            this.voiceBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V21h14v-1.5c0-2.33-4.67-3.5-7-3.5zm6-7c0 .55.45 1 1 1s1-.45 1-1v-3c0-2.21-1.79-4-4-4-.55 0-1 .45-1 1s.45 1 1 1c1.1 0 2 .9 2 2v3z"></path></svg>';
            this.voiceBtn.style.background = '';
            this.voiceBtn.style.color = '';
        };

        recognition.start();
    }

    createNewChat() {
        // Save current chat before creating new one
        if (this.conversationHistory.length > 0) {
            this.saveCurrentChat();
        }

        this.conversationHistory = [];
        this.currentConversationId = null;
        this.messageInput.value = '';
        
        if (this.headerTitle) {
            this.headerTitle.textContent = 'Welcome to Gemini AI';
        }

        this.showWelcomeMessage();
        this.loadChats(); // Refresh chat list
    }

    setupAutoResize() {
        if (!this.messageInput) return;
        
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 150) + 'px';
            // Force reflow to ensure proper layout
            this.messageInput.parentElement.style.alignItems = 'flex-end';
        });
    }

    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        this.updateThemeIcons();
        
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    }

    loadTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        this.updateThemeIcons();
    }

    updateThemeIcons() {
        if (!this.themeToggleBtn) return;
        
        const sunIcon = this.themeToggleBtn.querySelector('.sun-icon');
        const moonIcon = this.themeToggleBtn.querySelector('.moon-icon');
        
        if (sunIcon && moonIcon) {
            if (document.body.classList.contains('dark-mode')) {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            } else {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            }
        }
    }

    openSettings() {
        // Check if settings modal already exists
        if (document.querySelector('.settings-modal')) {
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        modal.innerHTML = `
            <div class="settings-overlay"></div>
            <div class="settings-panel">
                <div class="settings-header">
                    <h2>Settings</h2>
                    <button class="close-btn" aria-label="Close settings">&times;</button>
                </div>
                
                <div class="settings-content">
                    <!-- General Settings -->
                    <div class="settings-section">
                        <h3 class="settings-section-title">General</h3>
                        
                        <div class="settings-item">
                            <label>Theme</label>
                            <div class="theme-selector">
                                <button class="theme-btn ${document.body.classList.contains('dark-mode') ? 'active' : ''}" data-theme="dark">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                                    </svg>
                                    Dark
                                </button>
                                <button class="theme-btn ${!document.body.classList.contains('dark-mode') ? 'active' : ''}" data-theme="light">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="5"></circle>
                                        <line x1="12" y1="1" x2="12" y2="3"></line>
                                        <line x1="12" y1="21" x2="12" y2="23"></line>
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                        <line x1="1" y1="12" x2="3" y2="12"></line>
                                        <line x1="21" y1="12" x2="23" y2="12"></line>
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                                    </svg>
                                    Light
                                </button>
                            </div>
                        </div>

                        <div class="settings-item">
                            <label>Enable Voice Input</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="voice-toggle" ${localStorage.getItem('voiceEnabled') !== 'false' ? 'checked' : ''}>
                                <label for="voice-toggle" class="toggle-label"></label>
                            </div>
                        </div>
                    </div>

                    <!-- Chat Settings -->
                    <div class="settings-section">
                        <h3 class="settings-section-title">Chat Settings</h3>
                        
                        <div class="settings-item">
                            <label for="model-select">AI Model</label>
                            <select id="model-select">
                                <option value="gemini-flash-latest" selected>Gemini Flash (Fast)</option>
                                <option value="gemini-pro">Gemini Pro (Powerful)</option>
                            </select>
                        </div>

                        <div class="settings-item">
                            <label for="temperature-slider">Creativity Level</label>
                            <div class="slider-container">
                                <input type="range" id="temperature-slider" min="0" max="2" step="0.1" value="${localStorage.getItem('temperature') || '1'}">
                                <span class="slider-value">${localStorage.getItem('temperature') || '1'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Data & Privacy -->
                    <div class="settings-section">
                        <h3 class="settings-section-title">Data & Privacy</h3>
                        
                        <div class="settings-item">
                            <button class="danger-btn" id="clear-history-btn">Clear Chat History</button>
                        </div>

                        <div class="settings-item">
                            <button class="secondary-btn" id="export-btn">Export Chats</button>
                        </div>
                    </div>
                </div>

                <div class="settings-footer">
                    <button class="save-btn">Save Settings</button>
                    <button class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event handlers
        const closeBtn = modal.querySelector('.close-btn');
        const cancelBtn = modal.querySelector('.cancel-btn');
        const saveBtn = modal.querySelector('.save-btn');
        const overlay = modal.querySelector('.settings-overlay');
        
        const closeSettings = () => modal.remove();
        
        closeBtn.addEventListener('click', closeSettings);
        cancelBtn.addEventListener('click', closeSettings);
        overlay.addEventListener('click', closeSettings);
        
        // Theme buttons
        modal.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (btn.dataset.theme === 'dark') {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
                
                this.updateThemeIcons();
            });
        });

        // Temperature slider
        const tempSlider = modal.querySelector('#temperature-slider');
        const tempValue = modal.querySelector('.slider-value');
        tempSlider.addEventListener('input', () => {
            tempValue.textContent = tempSlider.value;
        });

        // Clear history
        modal.querySelector('#clear-history-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
                localStorage.setItem('chats', '[]');
                this.chats = [];
                this.loadChats();
                alert('Chat history cleared');
                closeSettings();
            }
        });

        // Export chats
        modal.querySelector('#export-btn').addEventListener('click', () => {
            const chats = JSON.parse(localStorage.getItem('chats') || '[]');
            if (chats.length === 0) {
                alert('No chats to export');
                return;
            }
            
            const dataStr = JSON.stringify(chats, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'chats_export_' + new Date().toISOString().split('T')[0] + '.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            alert('Chats exported successfully');
        });

        // Save settings
        saveBtn.addEventListener('click', () => {
            localStorage.setItem('temperature', tempSlider.value);
            localStorage.setItem('voiceEnabled', modal.querySelector('#voice-toggle').checked);
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
            closeSettings();
            alert('Settings saved');
        });

        // Prevent closing on panel click
        modal.querySelector('.settings-panel').addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    saveCurrentChat() {
        if (this.conversationHistory.length === 0) return;
        
        const chatId = this.currentConversationId || this.generateChatId();
        const firstMessage = this.conversationHistory[0]?.content || 'New Chat';
        const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
        
        const chat = {
            id: chatId,
            title: title,
            messages: [...this.conversationHistory], // Copy to avoid reference issues
            timestamp: new Date().toISOString()
        };
        
        // Save to localStorage
        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        const existingIndex = chats.findIndex(c => c.id === chatId);
        
        if (existingIndex >= 0) {
            chats[existingIndex] = chat;
        } else {
            chats.push(chat);
        }
        
        // Limit to 50 chats to prevent storage issues
        chats = chats.slice(-50);
        
        localStorage.setItem('chats', JSON.stringify(chats));
        this.currentConversationId = chatId;
        this.loadChats(); // Refresh the chat list
    }

    // Load chats from localStorage
    loadChats() {
        const chats = JSON.parse(localStorage.getItem('chats') || '[]');
        this.chats = chats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (!this.chatsList) return;
        
        this.chatsList.innerHTML = '';
        
        if (this.chats.length === 0) {
            this.chatsList.innerHTML = '<div style="padding: 10px; color: #999; font-size: 12px;">No chat history</div>';
            return;
        }
        
        this.chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.dataset.chatId = chat.id;
            
            const chatBtn = document.createElement('button');
            chatBtn.className = 'chat-history-btn';
            
            const chatTitle = document.createElement('span');
            chatTitle.className = 'chat-title';
            chatTitle.textContent = chat.title;
            
            const chatTime = document.createElement('span');
            chatTime.className = 'chat-time';
            const time = new Date(chat.timestamp);
            chatTime.textContent = time.toLocaleDateString() + ' ' + time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'chat-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.setAttribute('aria-label', 'Delete chat');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent loading the chat
                this.deleteChat(chat.id);
            });
            
            chatBtn.appendChild(chatTitle);
            chatBtn.appendChild(chatTime);
            
            chatItem.appendChild(chatBtn);
            chatItem.appendChild(deleteBtn);
            this.chatsList.appendChild(chatItem);
            
            chatBtn.addEventListener('click', () => this.loadChat(chat.id));
        });
    }

    loadChat(chatId) {
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;
        
        this.currentConversationId = chat.id;
        this.conversationHistory = [...chat.messages]; // Create a copy
        this.isWelcomeVisible = false;
        
        if (this.headerTitle) {
            this.headerTitle.textContent = 'Chat';
        }
        
        // Render messages
        this.messagesContainer.innerHTML = '';
        this.conversationHistory.forEach(msg => {
            this.addMessage(msg.content, msg.role === 'user' ? 'user' : 'assistant');
        });
        
        this.scrollToBottom();
    }

    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    initializeTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(el => {
            el.addEventListener('mouseenter', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.textContent = el.getAttribute('data-tooltip');
                tooltip.style.cssText = 'position:fixed;background:#333;color:#fff;padding:6px 10px;border-radius:4px;font-size:12px;white-space:nowrap;z-index:9999;pointer-events:none;';
                document.body.appendChild(tooltip);
                
                const rect = el.getBoundingClientRect();
                tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
                
                el._tooltip = tooltip;
            });
            
            el.addEventListener('mouseleave', (e) => {
                if (el._tooltip) {
                    el._tooltip.remove();
                    el._tooltip = null;
                }
            });
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new GeminiChatApp();
    });
} else {
    window.app = new GeminiChatApp();
}