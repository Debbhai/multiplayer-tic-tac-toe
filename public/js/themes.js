/**
 * Theme Management System
 * Handles theme switching, saving preferences, and applying themes
 */

class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
        this.themes = [
            'classic', 'dark', 'nature', 'ocean', 'neon', 'minimalist',
            'sunset', 'cyberpunk', 'retro', 'pastel', 'forest', 'candy', 'midnight'
        ];
        this.init();
    }

    init() {
        // Load saved theme from localStorage
        const savedTheme = localStorage.getItem('selectedTheme');
        if (savedTheme && this.themes.includes(savedTheme)) {
            this.currentTheme = savedTheme;
        }
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Theme button click - open modal
        document.getElementById('themeBtn').addEventListener('click', () => {
            this.openThemeModal();
        });

        // Close modal button
        document.getElementById('closeThemeModal').addEventListener('click', () => {
            this.closeThemeModal();
        });

        // Theme selection
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.selectTheme(theme);
            });
        });

        // Close modal on backdrop click
        document.getElementById('themeModal').addEventListener('click', (e) => {
            if (e.target.id === 'themeModal') {
                this.closeThemeModal();
            }
        });
    }

    openThemeModal() {
        const modal = document.getElementById('themeModal');
        modal.classList.remove('hidden');
        this.highlightCurrentTheme();
    }

    closeThemeModal() {
        const modal = document.getElementById('themeModal');
        modal.classList.add('hidden');
    }

    highlightCurrentTheme() {
        document.querySelectorAll('.theme-option').forEach(option => {
            if (option.dataset.theme === this.currentTheme) {
                option.style.transform = 'scale(1.05)';
                option.style.outline = '3px solid var(--color-primary)';
                option.style.outlineOffset = '4px';
            } else {
                option.style.transform = 'scale(1)';
                option.style.outline = 'none';
            }
        });
    }

    selectTheme(theme) {
        if (this.themes.includes(theme)) {
            this.currentTheme = theme;
            this.applyTheme(theme);
            this.saveTheme(theme);
            this.closeThemeModal();
            
            // Show confirmation
            this.showThemeChangeNotification(theme);
        }
    }

    applyTheme(theme) {
        const app = document.getElementById('app');
        const body = document.body;
        
        // Remove all theme classes from both app and body
        this.themes.forEach(t => {
            app.classList.remove(`theme-${t}`);
            body.classList.remove(`theme-${t}`);
        });
        
        // Add selected theme class to both app and body
        app.classList.add(`theme-${theme}`);
        body.classList.add(`theme-${theme}`);
        
        // Update meta theme color for mobile browsers
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            // Wait for CSS to apply
            setTimeout(() => {
                const bgColor = getComputedStyle(document.documentElement)
                    .getPropertyValue('--bg-secondary').trim();
                metaTheme.content = bgColor || '#1a1a2e';
            }, 50);
        }
    }

    saveTheme(theme) {
        localStorage.setItem('selectedTheme', theme);
    }

    showThemeChangeNotification(theme) {
        // Remove existing notification if any
        const existing = document.querySelector('.theme-notification');
        if (existing) {
            existing.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'theme-notification';
        const themeName = theme.charAt(0).toUpperCase() + theme.slice(1);
        notification.textContent = `Theme changed to ${themeName}`;
        notification.style.cssText = `
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: var(--color-primary);
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideUp 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        // Remove notification after 2 seconds
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

// Add animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(100px);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(100px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize theme manager
const themeManager = new ThemeManager();
