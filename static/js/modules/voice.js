/**
 * Voice Module
 * Handles speech-to-text and text-to-speech features
 */

class VoiceManager {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.init();
    }

    init() {
        this.setupRecognition();
        this.setupEventListeners();
    }

    /**
     * Setup speech recognition
     */
    setupRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateVoiceButtonState();
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                chatManager.messageInput.value = finalTranscript.trim();
                chatManager.updateSendButtonState();
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateVoiceButtonState();
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => this.toggleListening());
        }
    }

    /**
     * Toggle listening
     */
    toggleListening() {
        if (!this.recognition) {
            alert('Speech Recognition is not supported in this browser');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            // Show transcribing indicator
            const transcribingIndicator = document.createElement('div');
            transcribingIndicator.id = 'transcribing-indicator';
            transcribingIndicator.textContent = 'Transcribing...';
            transcribingIndicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 10px 15px;
                background: var(--accent-primary);
                color: white;
                border-radius: 4px;
                z-index: 1000;
                animation: fadeIn 0.3s ease-out;
            `;
            document.body.appendChild(transcribingIndicator);

            this.recognition.start();

            // Remove indicator when recognition ends
            this.recognition.onend = () => {
                this.isListening = false;
                this.updateVoiceButtonState();
                transcribingIndicator.remove();
            };
        }
    }

    /**
     * Update voice button state
     */
    updateVoiceButtonState() {
        const voiceBtn = document.getElementById('voice-btn');
        if (!voiceBtn) return;

        if (this.isListening) {
            voiceBtn.style.background = 'var(--accent-primary)';
            voiceBtn.style.color = 'white';
        } else {
            voiceBtn.style.background = '';
            voiceBtn.style.color = '';
        }
    }

    /**
     * Speak text (TTS)
     */
    speak(text) {
        if (!this.synthesis) {
            console.warn('Speech Synthesis not supported');
            return;
        }

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        this.synthesis.speak(utterance);
    }

    /**
     * Stop speaking
     */
    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
        }
    }

    /**
     * Get available voices
     */
    getAvailableVoices() {
        return this.synthesis.getVoices();
    }

    /**
     * Set voice
     */
    setVoice(voiceIndex) {
        const voices = this.getAvailableVoices();
        if (voiceIndex < voices.length) {
            this.selectedVoice = voices[voiceIndex];
        }
    }
}

// Initialize voice manager
const voiceManager = new VoiceManager();
