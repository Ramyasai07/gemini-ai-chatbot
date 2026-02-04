/**
 * Main Application File
 * Initializes all modules and manages global state
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    console.log('🚀 Initializing Gemini AI Chatbot...');

    try {
        // 1. Initialize theme
        console.log('✓ Theme manager initialized');

        // 2. Initialize API
        console.log('✓ API client initialized');

        // 3. Initialize chat manager
        console.log('✓ Chat manager initialized');

        // 4. Initialize voice manager
        console.log('✓ Voice manager initialized');

        // 5. Initialize file manager
        console.log('✓ File manager initialized');

        // 6. Load models
        await loadModels();

        // 7. Setup sidebar
        setupSidebar();

        // 8. Setup settings panel
        setupSettingsPanel();

        // 9. Setup keyboard shortcuts
        setupKeyboardShortcuts();

        // 10. Load initial data
        await chatManager.loadConversations();

        console.log('Application initialized successfully!');

    } catch (error) {
        console.error('❌ Initialization error:', error);
    }
}

/**
 * Load available AI models
 */
async function loadModels() {
    try {
        const data = await api.getModels();
        const modelsList = document.getElementById('models-list');

        if (modelsList) {
            modelsList.innerHTML = '';

            Object.entries(data.models).forEach(([key, model]) => {
                const modelCard = document.createElement('div');
                modelCard.className = 'model-card';
                modelCard.innerHTML = `
                    <div class="model-card-header">
                        <span class="model-name">${model.display_name}</span>
                        <span class="model-selected-icon" style="display: ${key === 'gemini-pro' ? 'block' : 'none'}">✓</span>
                    </div>
                    <div class="model-description">${model.description}</div>
                    <div class="model-stats">
                        <div class="model-stat">⚡ ${model.speed}</div>
                        <div class="model-stat">🧠 ${model.capability}</div>
                        <div class="model-stat">💰 ${model.cost}</div>
                    </div>
                `;

                modelCard.addEventListener('click', () => selectModel(key, modelsList));
                modelsList.appendChild(modelCard);
            });
        }
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

/**
 * Select AI model
 */
function selectModel(modelKey, container) {
    document.querySelectorAll('.model-card').forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.model-selected-icon');
        if (icon) icon.style.display = 'none';
    });

    const selected = container.querySelector(`[data-model="${modelKey}"]`)?.parentElement;
    if (selected) {
        selected.classList.add('selected');
        const icon = selected.querySelector('.model-selected-icon');
        if (icon) icon.style.display = 'block';
    }

    localStorage.setItem('preferred-model', modelKey);
}

/**
 * Setup sidebar
 */
function setupSidebar() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // Close sidebar on mobile when item selected
    document.getElementById('conversations-list').addEventListener('click', () => {
        if (window.innerWidth < 1024) {
            sidebar.classList.add('collapsed');
        }
    });
}

/**
 * Setup settings panel
 */
function setupSettingsPanel() {
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings');

    if (settingsToggle) {
        settingsToggle.addEventListener('click', () => {
            settingsPanel.classList.toggle('open');
        });
    }

    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            settingsPanel.classList.remove('open');
        });
    }

    if (saveSettings) {
        saveSettings.addEventListener('click', () => {
            saveUserSettings();
        });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#settings-toggle') && 
            !e.target.closest('.settings-panel')) {
            settingsPanel.classList.remove('open');
        }
    });
}

/**
 * Save user settings
 */
function saveUserSettings() {
    const settings = {
        reduceMotion: document.getElementById('reduce-motion').checked,
        compactMode: document.getElementById('compact-mode').checked,
        voiceLanguage: document.getElementById('voice-language').value,
        enableTTS: document.getElementById('enable-tts').checked
    };

    localStorage.setItem('user-settings', JSON.stringify(settings));

    if (settings.reduceMotion) {
        document.body.style.setProperty('--transition-base', '0.01ms');
    } else {
        document.body.style.removeProperty('--transition-base');
    }

    if (settings.compactMode) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }

    chatManager.showNotification('Settings saved!', 'success');
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K for quick commands
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            // Show command palette (TODO)
        }

        // Ctrl/Cmd + N for new conversation
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            chatManager.createNewConversation();
        }

        // Escape to close settings
        if (e.key === 'Escape') {
            document.getElementById('settings-panel').classList.remove('open');
        }
    });
}

/**
 * Load user settings on startup
 */
function loadUserSettings() {
    const settings = JSON.parse(localStorage.getItem('user-settings') || '{}');

    if (settings.reduceMotion) {
        document.getElementById('reduce-motion').checked = true;
    }

    if (settings.compactMode) {
        document.getElementById('compact-mode').checked = true;
        document.body.classList.add('compact-mode');
    }

    if (settings.voiceLanguage) {
        document.getElementById('voice-language').value = settings.voiceLanguage;
    }

    if (settings.enableTTS) {
        document.getElementById('enable-tts').checked = true;
    }
}

// Load settings when page is ready
loadUserSettings();

// Add quick prompt handlers
document.querySelectorAll('.quick-prompt').forEach(btn => {
    btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        chatManager.messageInput.value = prompt;
        chatManager.updateSendButtonState();
        chatManager.messageInput.focus();
    });
});

// Handle connection status
window.addEventListener('online', () => {
    const indicator = document.getElementById('connection-indicator');
    if (indicator) {
        indicator.className = 'status-indicator online';
        indicator.title = 'Online';
    }
});

window.addEventListener('offline', () => {
    const indicator = document.getElementById('connection-indicator');
    if (indicator) {
        indicator.className = 'status-indicator offline';
        indicator.title = 'Offline';
    }
});

// Set initial connection status
const indicator = document.getElementById('connection-indicator');
if (indicator) {
    indicator.className = navigator.onLine ? 'status-indicator online' : 'status-indicator offline';
}

console.log('Gemini AI Chatbot Ready!');
