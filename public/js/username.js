/**
 * Username Manager
 * Handles username selection and display
 */

class UsernameManager {
    constructor() {
        this.username = null;
        this.init();
    }

    init() {
        this.loadUsername();
    }

    loadUsername() {
        let saved = localStorage.getItem('username');
        if (!saved) {
            // Generate random username
            const adjectives = ['Cool', 'Super', 'Epic', 'Mega', 'Ultra', 'Pro', 'Master'];
            const nouns = ['Player', 'Gamer', 'Champion', 'Winner', 'Star', 'Hero'];
            const randomNum = Math.floor(Math.random() * 9999);
            
            const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
            const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
            
            saved = `${randomAdj}${randomNoun}${randomNum}`;
            localStorage.setItem('username', saved);
        }
        this.username = saved;
    }

    getUsername() {
        return this.username;
    }

    setUsername(newUsername) {
        if (newUsername && newUsername.trim().length > 0) {
            this.username = newUsername.trim();
            localStorage.setItem('username', this.username);
            
            if (window.ui) {
                window.ui.showNotification(`Username changed to ${this.username}!`);
            }
        }
    }

    promptChange() {
        const newUsername = prompt('Enter your new username:', this.username);
        if (newUsername && newUsername.trim().length > 0) {
            this.setUsername(newUsername);
        }
    }
}

const usernameManager = new UsernameManager();
window.usernameManager = usernameManager;
