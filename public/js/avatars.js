/**
 * Avatar Manager
 * Handles avatar selection and display
 */

class AvatarManager {
    constructor() {
        this.availableAvatars = [
            { id: 'smile', emoji: '😊', name: 'Happy' },
            { id: 'cool', emoji: '😎', name: 'Cool' },
            { id: 'nerd', emoji: '🤓', name: 'Nerd' },
            { id: 'star', emoji: '⭐', name: 'Star' },
            { id: 'fire', emoji: '🔥', name: 'Fire' },
            { id: 'robot', emoji: '🤖', name: 'Robot' },
            { id: 'alien', emoji: '👽', name: 'Alien' },
            { id: 'unicorn', emoji: '🦄', name: 'Unicorn' },
            { id: 'dragon', emoji: '🐉', name: 'Dragon' },
            { id: 'crown', emoji: '👑', name: 'King' },
            { id: 'ninja', emoji: '🥷', name: 'Ninja' },
            { id: 'pirate', emoji: '🏴‍☠️', name: 'Pirate' },
            { id: 'wizard', emoji: '🧙', name: 'Wizard' },
            { id: 'cat', emoji: '😺', name: 'Cat' },
            { id: 'dog', emoji: '🐶', name: 'Dog' },
            { id: 'panda', emoji: '🐼', name: 'Panda' },
            { id: 'bear', emoji: '🐻', name: 'Bear' },
            { id: 'tiger', emoji: '🐯', name: 'Tiger' },
            { id: 'lion', emoji: '🦁', name: 'Lion' },
            { id: 'fox', emoji: '🦊', name: 'Fox' },
            { id: 'rocket', emoji: '🚀', name: 'Rocket' },
            { id: 'trophy', emoji: '🏆', name: 'Trophy' },
            { id: 'gem', emoji: '💎', name: 'Diamond' },
            { id: 'heart', emoji: '❤️', name: 'Heart' }
        ];
        
        this.currentAvatar = null;
        this.init();
    }

    init() {
        this.loadAvatar();
        this.setupAvatarModal();
    }

    loadAvatar() {
        const savedAvatar = localStorage.getItem('userAvatar');
        if (savedAvatar) {
            this.currentAvatar = JSON.parse(savedAvatar);
        } else {
            // Default avatar
            this.currentAvatar = this.availableAvatars[0];
            this.saveAvatar();
        }
        this.updateAvatarDisplay();
    }

    saveAvatar() {
        localStorage.setItem('userAvatar', JSON.stringify(this.currentAvatar));
    }

    setAvatar(avatarId) {
        const avatar = this.availableAvatars.find(a => a.id === avatarId);
        if (avatar) {
            this.currentAvatar = avatar;
            this.saveAvatar();
            this.updateAvatarDisplay();
            
            if (window.ui) {
                window.ui.playSound('notification');
                window.ui.showNotification(`Avatar changed to ${avatar.name}!`);
            }
        }
    }

    getAvatar() {
        return this.currentAvatar;
    }

    getAvatarEmoji() {
        return this.currentAvatar ? this.currentAvatar.emoji : '😊';
    }

    updateAvatarDisplay() {
        // Update profile button avatar
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn && this.currentAvatar) {
            profileBtn.innerHTML = `
                <span style="font-size: 24px;">${this.currentAvatar.emoji}</span>
            `;
        }
    }

    setupAvatarModal() {
        const modal = document.getElementById('avatarModal');
        if (!modal) return;

        // Close button
        const closeBtn = document.getElementById('closeAvatarModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        // Generate avatar grid
        const grid = document.getElementById('avatarGrid');
        if (grid) {
            grid.innerHTML = '';
            
            this.availableAvatars.forEach(avatar => {
                const avatarBtn = document.createElement('button');
                avatarBtn.className = 'avatar-option';
                avatarBtn.dataset.avatarId = avatar.id;
                avatarBtn.innerHTML = `
                    <span class="avatar-emoji">${avatar.emoji}</span>
                    <span class="avatar-name">${avatar.name}</span>
                `;
                
                // Mark current avatar as selected
                if (this.currentAvatar && this.currentAvatar.id === avatar.id) {
                    avatarBtn.classList.add('selected');
                }
                
                avatarBtn.addEventListener('click', () => {
                    // Remove previous selection
                    grid.querySelectorAll('.avatar-option').forEach(btn => {
                        btn.classList.remove('selected');
                    });
                    
                    // Select this avatar
                    avatarBtn.classList.add('selected');
                    this.setAvatar(avatar.id);
                });
                
                grid.appendChild(avatarBtn);
            });
        }
    }

    openAvatarModal() {
        const modal = document.getElementById('avatarModal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // Update selection
            const grid = document.getElementById('avatarGrid');
            if (grid) {
                grid.querySelectorAll('.avatar-option').forEach(btn => {
                    btn.classList.remove('selected');
                    if (this.currentAvatar && btn.dataset.avatarId === this.currentAvatar.id) {
                        btn.classList.add('selected');
                    }
                });
            }
        }
    }
}

// Initialize avatar manager
const avatarManager = new AvatarManager();
window.avatarManager = avatarManager;
