/**
 * UI Manager with Socket.IO Integration
 * Handles all UI interactions, modals, navigation, and visual feedback
 */

class UIManager {
    constructor() {
        this.soundEnabled = true;
        this.currentScreen = 'mainMenu';
        this.matchmakingInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserData();
        this.initializeSoundToggle();
    }

    setupEventListeners() {
        // Main menu buttons
        document.getElementById('playAIBtn').addEventListener('click', () => {
            this.openAIModal();
            this.playSound('notification');
        });

        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.openRoomModal();
            this.playSound('notification');
        });

        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.openJoinModal();
            this.playSound('notification');
        });

        document.getElementById('matchmakingBtn').addEventListener('click', () => {
            this.startMatchmaking();
            this.playSound('notification');
        });

        // AI Modal
        document.getElementById('closeAIModal').addEventListener('click', () => {
            this.closeAIModal();
        });

        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const difficulty = e.currentTarget.dataset.difficulty;
                this.startAIGame(difficulty);
            });
        });

        // Room Modal
        document.getElementById('closeRoomModal').addEventListener('click', () => {
            this.closeRoomModal();
        });

        document.getElementById('createRoomConfirm').addEventListener('click', () => {
            this.createRoom();
        });

        document.getElementById('copyCodeBtn').addEventListener('click', () => {
            this.copyRoomCode();
        });

        // Join Modal
        document.getElementById('closeJoinModal').addEventListener('click', () => {
            this.closeJoinModal();
        });

        document.getElementById('joinRoomConfirm').addEventListener('click', () => {
            this.joinRoom();
        });

        document.getElementById('roomCodeInput').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });

        // Game controls
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });

        document.getElementById('leaveGameBtn').addEventListener('click', () => {
            this.leaveGame();
        });

        // Result modal
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.playAgain();
        });

        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            this.backToMenu();
        });

        // Chat
        document.getElementById('sendChatBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        document.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reaction = e.currentTarget.dataset.reaction;
                this.sendReaction(reaction);
            });
        });

        document.getElementById('chatToggle').addEventListener('click', () => {
            this.toggleChat();
        });

        // Matchmaking
        document.getElementById('cancelMatchmaking').addEventListener('click', () => {
            this.cancelMatchmaking();
        });

        // Sound toggle
        document.getElementById('soundBtn').addEventListener('click', () => {
            this.toggleSound();
        });

        // Profile button
        document.getElementById('profileBtn').addEventListener('click', () => {
            this.showProfile();
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });
    }

    // ===== SCREEN NAVIGATION =====

    showScreen(screenId) {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('matchmakingScreen').classList.add('hidden');

        document.getElementById(screenId).classList.remove('hidden');
        this.currentScreen = screenId;
    }

    // ===== AI GAME =====

    openAIModal() {
        document.getElementById('aiModal').classList.remove('hidden');
    }

    closeAIModal() {
        document.getElementById('aiModal').classList.add('hidden');
    }

    startAIGame(difficulty) {
        this.closeAIModal();
        this.showScreen('gameScreen');
        
        if (window.game) {
            window.game.startAIGame(difficulty);
        }

        this.addChatMessage('system', `Starting game against ${difficulty.toUpperCase()} AI`);
    }

    // ===== ROOM MANAGEMENT (WITH SOCKET.IO) =====

    openRoomModal() {
        document.getElementById('roomModal').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').classList.add('hidden');
    }

    closeRoomModal() {
        document.getElementById('roomModal').classList.add('hidden');
    }

    closeAllModals() {
        document.getElementById('aiModal').classList.add('hidden');
        document.getElementById('roomModal').classList.add('hidden');
        document.getElementById('joinModal').classList.add('hidden');
        document.getElementById('resultModal').classList.add('hidden');
    }

    createRoom() {
        const allowSpectators = document.getElementById('allowSpectators').checked;
        const enableTimer = document.getElementById('enableTimer').checked;

        // Create room via socket
        socket.emit('createRoom', 
            { allowSpectators, enableTimer },
            (response) => {
                if (response.success) {
                    document.getElementById('roomCode').textContent = response.roomCode;
                    document.getElementById('roomCodeDisplay').classList.remove('hidden');
                    this.addChatMessage('system', `Room ${response.roomCode} created. Waiting for opponent...`);
                    this.playSound('notification');
                    
                    // Store room code
                    if (window.game) {
                        window.game.createRoom(response.roomCode, { allowSpectators, enableTimer });
                    }
                } else {
                    this.showNotification('Failed to create room: ' + response.error);
                }
            }
        );
    }

    copyRoomCode() {
        const code = document.getElementById('roomCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            this.showNotification('Room code copied to clipboard!');
            this.playSound('notification');
        }).catch(err => {
            console.error('Failed to copy:', err);
            this.showNotification('Failed to copy code');
        });
    }

    openJoinModal() {
        document.getElementById('joinModal').classList.remove('hidden');
        document.getElementById('joinError').classList.add('hidden');
        document.getElementById('roomCodeInput').value = '';
    }

    closeJoinModal() {
        document.getElementById('joinModal').classList.add('hidden');
    }

    joinRoom() {
        const code = document.getElementById('roomCodeInput').value.trim();
        
        if (code.length !== 6) {
            this.showJoinError('Please enter a 6-character code');
            return;
        }

        // Join room via socket
        socket.emit('joinRoom', code, (response) => {
            if (response.success) {
                this.closeJoinModal();
                this.addChatMessage('system', `Joined room ${code}. Game starting...`);
                
                if (window.game) {
                    window.game.joinRoom(code);
                }
            } else {
                this.showJoinError(response.error || 'Failed to join room');
            }
        });
    }

    showJoinError(message) {
        const errorEl = document.getElementById('joinError');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    // ===== MATCHMAKING (WITH SOCKET.IO) =====

    startMatchmaking() {
        this.showScreen('matchmakingScreen');
        
        const userPoints = this.userData.points || 0;
        
        // Join matchmaking queue
        socket.emit('joinMatchmaking', userPoints, (response) => {
            if (response && response.success && response.inQueue) {
                this.updateMatchmakingStatus(response.position);
                this.startMatchmakingUpdates();
            }
        });
    }

    startMatchmakingUpdates() {
        // Update queue status every 2 seconds
        this.matchmakingInterval = setInterval(() => {
            socket.emit('getQueueStatus', (status) => {
                if (status) {
                    this.updateMatchmakingStatus(status.position, status.estimatedWait);
                }
            });
        }, 2000);
    }

    updateMatchmakingStatus(position, estimatedWait) {
        document.getElementById('queuePosition').textContent = `Position in queue: ${position}`;
        if (estimatedWait) {
            document.getElementById('estimatedWait').textContent = `Estimated wait: ~${estimatedWait}s`;
        }
    }

    cancelMatchmaking() {
        if (this.matchmakingInterval) {
            clearInterval(this.matchmakingInterval);
            this.matchmakingInterval = null;
        }
        
        socket.emit('cancelMatchmaking');
        this.showScreen('mainMenu');
        this.addChatMessage('system', 'Matchmaking cancelled');
    }

    // ===== GAME CONTROLS =====

    restartGame() {
        if (window.game) {
            window.game.restart();
        }
    }

    leaveGame() {
        if (confirm('Are you sure you want to leave the game?')) {
            // Emit leave room event
            socket.emit('leaveRoom');
            
            if (window.game) {
                window.game.resetGame();
            }
            this.showScreen('mainMenu');
            this.addChatMessage('system', 'You left the game');
        }
    }

    playAgain() {
        document.getElementById('resultModal').classList.add('hidden');
        if (window.game) {
            window.game.restart();
        }
    }

    backToMenu() {
        document.getElementById('resultModal').classList.add('hidden');
        socket.emit('leaveRoom');
        this.showScreen('mainMenu');
    }

    // ===== CHAT (WITH SOCKET.IO) =====

    addChatMessage(type, message, sender = null) {
        const chatMessages = document.getElementById('chatMessages');
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${type}`;
        
        if (sender) {
            messageEl.innerHTML = `<strong>${sender}:</strong> ${message}`;
        } else {
            messageEl.textContent = message;
        }

        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Play chat sound for received messages
        if (type === 'other') {
            this.playSound('chat');
        }
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (message && currentRoomCode) {
            // Emit chat message to server
            socket.emit('chatMessage', {
                roomCode: currentRoomCode,
                message: message
            });
            
            input.value = '';
        } else if (message && !currentRoomCode) {
            this.showNotification('Not in a game room');
            input.value = '';
        }
    }

    sendReaction(reaction) {
        if (currentRoomCode) {
            socket.emit('reaction', {
                roomCode: currentRoomCode,
                reaction: reaction
            });
            
            // Show own reaction
            this.addChatMessage('own', reaction);
            this.playSound('notification');
        } else {
            this.showNotification('Not in a game room');
        }
    }

    toggleChat() {
        const chatPanel = document.getElementById('chatPanel');
        chatPanel.classList.toggle('minimized');
    }

    // ===== GAME RESULT =====

    showGameResult(result, points, stats) {
        const modal = document.getElementById('resultModal');
        const icon = document.getElementById('resultIcon');
        const title = document.getElementById('resultTitle');
        const pointsEl = document.getElementById('resultPoints');

        if (result === 'win') {
            icon.textContent = '🎉';
            title.textContent = 'You Win!';
            pointsEl.textContent = `+${points} Points`;
        } else if (result === 'lose') {
            icon.textContent = '😢';
            title.textContent = 'You Lose';
            pointsEl.textContent = '0 Points';
        } else {
            icon.textContent = '🤝';
            title.textContent = "It's a Draw!";
            pointsEl.textContent = '+1 Point';
        }

        document.getElementById('gameTime').textContent = stats.gameTime;
        document.getElementById('totalMoves').textContent = stats.totalMoves;
        document.getElementById('avgMoveTime').textContent = stats.avgMoveTime;

        modal.classList.remove('hidden');

        this.updateUserPoints(points);
    }

    // ===== USER DATA =====

    loadUserData() {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        this.userData = {
            points: userData.points || 0,
            wins: userData.wins || 0,
            losses: userData.losses || 0,
            draws: userData.draws || 0,
            totalGames: userData.totalGames || 0
        };

        this.updateStats();
    }

    saveUserData() {
        localStorage.setItem('userData', JSON.stringify(this.userData));
    }

    updateUserPoints(points) {
        this.userData.points += points;
        document.getElementById('userPoints').textContent = `${this.userData.points} pts`;
        this.saveUserData();
    }

    updateStats() {
        document.getElementById('userPoints').textContent = `${this.userData.points} pts`;
        document.getElementById('totalWins').textContent = this.userData.wins;
        document.getElementById('totalGames').textContent = this.userData.totalGames;
        
        const winRate = this.userData.totalGames > 0 
            ? Math.round((this.userData.wins / this.userData.totalGames) * 100)
            : 0;
        document.getElementById('winRate').textContent = `${winRate}%`;
    }

    recordGameResult(result) {
        this.userData.totalGames++;
        if (result === 'win') this.userData.wins++;
        else if (result === 'lose') this.userData.losses++;
        else if (result === 'draw') this.userData.draws++;
        
        this.updateStats();
        this.saveUserData();
    }

    // ===== SOUND =====

    initializeSoundToggle() {
        if (window.soundManager) {
            this.soundEnabled = window.soundManager.isEnabled();
        } else {
            const savedSound = localStorage.getItem('soundEnabled');
            this.soundEnabled = savedSound !== 'false';
        }
        this.updateSoundButton();
    }

    toggleSound() {
        if (window.soundManager) {
            const enabled = window.soundManager.toggle();
            this.soundEnabled = enabled;
            this.updateSoundButton();
            this.showNotification(enabled ? '🔊 Sound enabled' : '🔇 Sound disabled');
            
            // Play a test sound when enabling
            if (enabled) {
                window.soundManager.play('notification');
            }
        }
    }

    updateSoundButton() {
        const btn = document.getElementById('soundBtn');
        if (this.soundEnabled) {
            btn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
            `;
            btn.title = 'Sound On';
        } else {
            btn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/>
                    <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
            `;
            btn.title = 'Sound Off';
        }
    }

    playSound(soundName) {
        if (window.soundManager) {
            window.soundManager.play(soundName);
        }
    }

    // ===== NOTIFICATIONS =====

    showNotification(message) {
        const existing = document.querySelector('.theme-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'theme-notification';
        notification.textContent = message;
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
            max-width: 90%;
            text-align: center;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // ===== PROFILE =====

    showProfile() {
        alert('Profile feature coming soon!\n\nYour Stats:\n' +
              `Total Games: ${this.userData.totalGames}\n` +
              `Wins: ${this.userData.wins}\n` +
              `Losses: ${this.userData.losses}\n` +
              `Draws: ${this.userData.draws}\n` +
              `Points: ${this.userData.points}`);
    }
}

// Initialize UI Manager
const uiManager = new UIManager();
window.ui = uiManager;
