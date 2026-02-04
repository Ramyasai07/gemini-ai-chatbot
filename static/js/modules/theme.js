/**
 * Theme Module
 * Handles dark/light mode switching with smooth animations
 */

class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'theme-preference';
        this.DARK_THEME = 'dark';
        this.LIGHT_THEME = 'light';
        this.HTML_ELEMENT = document.documentElement;
        this.init();
    }

    init() {
        // Get saved preference or system preference
        const savedTheme = localStorage.getItem(this.STORAGE_KEY);
        const systemTheme = this.getSystemTheme();
        const theme = savedTheme || systemTheme || this.DARK_THEME;

        this.setTheme(theme);
        this.setupListeners();
    }

    /**
     * Get system theme preference
     */
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return this.LIGHT_THEME;
        }
        return this.DARK_THEME;
    }

    /**
     * Smooth transition for theme changes
     */
    setTheme(theme) {
        const isValid = [this.DARK_THEME, this.LIGHT_THEME].includes(theme);
        const themeToSet = isValid ? theme : this.DARK_THEME;

        // Add smooth transition
        this.HTML_ELEMENT.style.transition = 'background-color 0.2s ease, color 0.2s ease';

        this.HTML_ELEMENT.setAttribute('data-theme', themeToSet);
        localStorage.setItem(this.STORAGE_KEY, themeToSet);
        this.updateThemeToggleIcon(themeToSet);

        console.log(`[ThemeManager] Theme set to: ${themeToSet}`);

        // Emit custom event
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: themeToSet }
        }));
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        const currentTheme = this.HTML_ELEMENT.getAttribute('data-theme');
        const newTheme = currentTheme === this.DARK_THEME ? this.LIGHT_THEME : this.DARK_THEME;
        this.setTheme(newTheme);
    }

    /**
     * Update theme toggle button icon
     */
    updateThemeToggleIcon(theme) {
        const themeIcon = document.querySelector('.theme-icon');
        if (!themeIcon) return;

        const sunIcon = themeIcon.querySelector('.sun-icon');
        const moonIcon = themeIcon.querySelector('.moon-icon');

        if (theme === this.LIGHT_THEME) {
            if (sunIcon) sunIcon.style.display = 'inline';
            if (moonIcon) moonIcon.style.display = 'none';
        } else {
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'inline';
        }
    }

    /**
     * Debugging event listener for theme toggle
     */
    setupListeners() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            console.log('[ThemeManager] Theme toggle button found. Adding event listener.');
            themeToggle.addEventListener('click', () => this.toggleTheme());
        } else {
            console.error('[ThemeManager] Theme toggle button not found.');
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
                const theme = e.matches ? this.LIGHT_THEME : this.DARK_THEME;
                console.log(`[ThemeManager] System theme changed to: ${theme}`);
                this.setTheme(theme);
            });
        }
    }

    /**
     * Get current theme
     */
    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || this.DARK_THEME;
    }
}

// Initialize theme manager
const themeManager = new ThemeManager();
