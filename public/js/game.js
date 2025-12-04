/**
 * Game Manager with Socket.IO Integration
 * Handles core game logic, AI, timer, win detection, and multiplayer communication
 */

// Socket.IO Connection
const socket = io();

let currentRoomCode = null;
let myPlayerId = null;
let mySymbol = null;

socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
    myPlayerId = socket.id;
});

socket.on('connected', (data) => {
    console.log('User data:', data);
    myPlayerId = data.userId;
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('username', data.username);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    if (window.ui) {
        window.ui.showNotification('Disconnected from server');
    }
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    if (window.ui) {
        window.ui.showNotification('Connection error. Please refresh the page.');
    }
});

// ===== SOCKET EVENT HANDLERS =====

// Player Joined Room
socket.on('playerJoined', (data) => {
    console.log('Player joined:', data);
    if (window.ui) {
        window.ui.addChatMessage('system', `${data.username} joined the room. Starting game...`);
        window.ui.closeAllModals();
        window.ui.playSound('notification');
    }
});

// Game Start
socket.on('gameStart', (data) => {
    console.log('Game starting:', data);
    
    // Close all modals and show game screen
    if (window.ui) {
        window.ui.closeAllModals();
        window.ui.showScreen('gameScreen');
        window.ui.addChatMessage('system', 'Game starting...');
    }
    
    // Initialize game
    if (window.game) {
        window.game.handleGameStart(data);
    }
});

// Match Found (Matchmaking)
socket.on('matchFound', (data) => {
    console.log('Match found:', data);
    if (window.ui) {
        window.ui.showScreen('gameScreen');
        window.ui.addChatMessage('system', 'Match found! Game starting...');
        window.ui.playSound('gameStart');
    }
    if (window.game) {
        window.game.handleGameStart(data);
    }
});

// Move Made
socket.on('moveMade', (data) => {
    console.log('Move made:', data);
    if (window.game) {
        window.game.handleOpponentMove(data);
    }
});

// Game Over
socket.on('gameOver', (data) => {
    console.log('Game over:', data);
    if (window.game) {
        window.game.handleGameOver(data);
    }
});

// Game Restart
socket.on('gameRestart', (data) => {
    console.log('Game restarted');
    if (window.game) {
        window.game.handleGameRestart(data);
    }
});

// Chat Message
socket.on('chatMessage', (data) => {
    if (window.ui) {
        const messageType = data.userId === myPlayerId ? 'own' : 'other';
        window.ui.addChatMessage(messageType, data.message, data.username);
    }
});

// Reaction
socket.on('reaction', (data) => {
    if (window.ui && data.userId !== myPlayerId) {
        window.ui.addChatMessage('other', data.reaction);
        window.ui.playSound('notification');
    }
});

// Player Left
socket.on('playerLeft', (data) => {
    if (window.ui) {
        window.ui.addChatMessage('system', `${data.username} left the game`);
        window.ui.showNotification('Opponent left the game');
    }
});

// Player Disconnected
socket.on('playerDisconnected', (data) => {
    if (window.ui) {
        window.ui.addChatMessage('system', `${data.username} disconnected`);
        window.ui.showNotification('Opponent disconnected');
    }
});

// Opponent Disconnected (you win)
socket.on('opponentDisconnected', (data) => {
    if (window.ui) {
        window.ui.addChatMessage('system', data.message);
        window.ui.showNotification(data.message);
    }
    if (window.game) {
        window.game.endGame('X'); // You win by default
    }
});

// Spectator Joined
socket.on('spectatorJoined', (data) => {
    if (window.ui) {
        window.ui.addChatMessage('system', `Spectator joined (${data.spectatorCount} watching)`);
    }
});

// ===== GAME CLASS =====

class TicTacToeGame {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.gameMode = null; // 'ai', 'online', 'private'
        this.aiDifficulty = null;
        this.gameActive = false;
        this.playerSymbol = 'X';
        this.opponentSymbol = 'O';
        this.timerInterval = null;
        this.timeLeft = 60;
        this.timerEnabled = true;
        this.gameStartTime = null;
        this.moveCount = 0;
        this.moveTimes = [];
        this.isMyTurn = false;
        this.winningPattern = null;
        
        this.init();
    }

    init() {
        this.setupBoard();
    }

    setupBoard() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            cell.addEventListener('click', () => this.handleCellClick(index));
            
            // Add hover sound
            cell.addEventListener('mouseenter', () => {
                if (this.gameActive && this.board[index] === null) {
                    if (window.ui) {
                        window.ui.playSound('hover');
                    }
                }
            });
        });
    }

    // ===== MULTIPLAYER HANDLERS =====

    handleGameStart(data) {
        this.resetGame();
        this.gameMode = 'online';
        this.gameActive = true;
        this.gameStartTime = Date.now();
        
        currentRoomCode = data.room.code;
        
        // Determine player symbols
        const players = data.room.players;
        mySymbol = players[myPlayerId].symbol;
        this.playerSymbol = mySymbol;
        this.opponentSymbol = mySymbol === 'X' ? 'O' : 'X';
        
        // Get opponent info
        const opponentId = Object.keys(players).find(id => id !== myPlayerId);
        const opponentName = players[opponentId].username;
        const myName = players[myPlayerId].username;
        
        // Update UI
        if (mySymbol === 'X') {
            this.updatePlayerNames(myName, opponentName);
        } else {
            this.updatePlayerNames(opponentName, myName);
        }
        
        // Set initial turn
        this.isMyTurn = data.gameState.currentPlayer === myPlayerId;
        this.currentPlayer = data.gameState.currentPlayer === myPlayerId ? mySymbol : this.opponentSymbol;
        
        this.updateTurnIndicator();
        
        if (this.timerEnabled) {
            this.startTimer();
        }

        if (window.ui) {
            window.ui.playSound('gameStart');
        }
    }

    handleOpponentMove(data) {
        const { cellIndex, symbol, nextPlayer, gameState } = data;
        
        // Update board
        this.board[cellIndex] = symbol;
        
        // Update UI
        const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
        cell.textContent = symbol;
        cell.classList.add('filled', symbol.toLowerCase());
        
        this.moveCount++;
        
        // Update turn
        this.isMyTurn = nextPlayer === myPlayerId;
        this.currentPlayer = this.isMyTurn ? this.playerSymbol : this.opponentSymbol;
        
        this.updateTurnIndicator();
        
        // Reset timer
        if (this.timerEnabled) {
            this.resetTimer();
        }
        
        if (window.ui) {
            window.ui.playSound('move');
        }
    }

    handleGameOver(data) {
        this.gameActive = false;
        this.stopTimer();

        const gameTime = this.calculateGameTime();
        const avgMoveTime = this.calculateAvgMoveTime();

        let result, points;

        if (data.result === 'draw') {
            result = 'draw';
            points = 1;
            if (window.ui) window.ui.playSound('draw');
        } else if (data.winner === mySymbol) {
            result = 'win';
            points = 10;
            if (window.ui) window.ui.playSound('win');
            
            // Highlight winning cells
            if (data.winningPattern) {
                this.winningPattern = data.winningPattern;
                this.highlightWinningCells(data.winningPattern);
            }
        } else {
            result = 'lose';
            points = 0;
            if (window.ui) window.ui.playSound('lose');
            
            // Highlight winning cells even when losing
            if (data.winningPattern) {
                this.winningPattern = data.winningPattern;
                this.highlightWinningCells(data.winningPattern);
            }
        }

        // Record result
        if (window.ui) {
            window.ui.recordGameResult(result);
        }

        // Show result modal
        setTimeout(() => {
            if (window.ui) {
                window.ui.showGameResult(result, points, {
                    gameTime: gameTime,
                    totalMoves: this.moveCount,
                    avgMoveTime: avgMoveTime
                });
            }
        }, 1500);
    }

    handleGameRestart(data) {
        this.resetGame();
        this.gameActive = true;
        this.gameStartTime = Date.now();
        this.isMyTurn = data.gameState.currentPlayer === myPlayerId;
        this.currentPlayer = this.isMyTurn ? this.playerSymbol : this.opponentSymbol;
        this.updateTurnIndicator();
        
        if (this.timerEnabled) {
            this.startTimer();
        }
        
        if (window.ui) {
            window.ui.playSound('gameStart');
        }
    }

    highlightWinningCells(pattern) {
        // Add a small delay to ensure cells are rendered before drawing line
        setTimeout(() => {
            pattern.forEach(index => {
                const cell = document.querySelector(`.cell[data-index="${index}"]`);
                if (cell) {
                    cell.classList.add('winner');
                }
            });

            this.drawWinningLine(pattern);
        }, 100);
    }

    // ===== GAME START METHODS =====

    startAIGame(difficulty) {
        this.resetGame();
        this.gameMode = 'ai';
        this.aiDifficulty = difficulty;
        this.gameActive = true;
        this.gameStartTime = Date.now();
        this.isMyTurn = true;
        this.playerSymbol = 'X';
        this.opponentSymbol = 'O';
        
        this.updatePlayerNames('You', `AI (${difficulty.toUpperCase()})`);
        this.updateTurnIndicator();
        
        if (this.timerEnabled) {
            this.startTimer();
        }

        if (window.ui) {
            window.ui.playSound('gameStart');
        }
    }

    startOnlineGame(opponentName) {
        this.resetGame();
        this.gameMode = 'online';
        this.gameActive = true;
        this.gameStartTime = Date.now();
        
        this.updatePlayerNames('You', opponentName);
        this.updateTurnIndicator();
        
        if (this.timerEnabled) {
            this.startTimer();
        }

        if (window.ui) {
            window.ui.playSound('gameStart');
        }
    }

    createRoom(roomCode, settings) {
        currentRoomCode = roomCode;
        this.timerEnabled = settings.enableTimer;
        console.log(`Room ${roomCode} created with settings:`, settings);
    }

    joinRoom(roomCode) {
        currentRoomCode = roomCode;
        console.log(`Joining room ${roomCode}`);
    }

    // ===== GAME LOGIC =====

    handleCellClick(index) {
        if (!this.gameActive) return;
        if (this.board[index] !== null) return;
        
        // For online games, check if it's your turn
        if (this.gameMode === 'online' && !this.isMyTurn) {
            if (window.ui) {
                window.ui.showNotification("It's not your turn!");
            }
            return;
        }
        
        if (this.gameMode === 'ai' && this.currentPlayer !== this.playerSymbol) return;

        this.makeMove(index, this.currentPlayer);
    }

    makeMove(index, player) {
        // Record move time
        const moveTime = Date.now();
        if (this.moveTimes.length > 0) {
            const lastMoveTime = this.moveTimes[this.moveTimes.length - 1];
            const timeTaken = (moveTime - lastMoveTime) / 1000;
            this.moveTimes.push(moveTime);
        } else {
            this.moveTimes.push(moveTime);
        }

        this.moveCount++;
        this.board[index] = player;
        
        // Update UI
        const cell = document.querySelector(`.cell[data-index="${index}"]`);
        cell.textContent = player;
        cell.classList.add('filled', player.toLowerCase());

        if (window.ui) {
            window.ui.playSound('move');
        }

        // For online games, emit move to server
        if (this.gameMode === 'online') {
            socket.emit('makeMove', {
                roomCode: currentRoomCode,
                cellIndex: index
            }, (response) => {
                if (!response.success) {
                    console.error('Move failed:', response.error);
                    // Revert move
                    this.board[index] = null;
                    cell.textContent = '';
                    cell.classList.remove('filled', player.toLowerCase());
                    if (window.ui) {
                        window.ui.showNotification('Move failed: ' + response.error);
                    }
                }
            });
            
            this.isMyTurn = false;
            return; // Server will handle game state
        }

        // For AI games, handle locally
        const winner = this.checkWinner();
        if (winner) {
            this.endGame(winner);
            return;
        }

        if (this.board.every(cell => cell !== null)) {
            this.endGame('draw');
            return;
        }

        // Switch player
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        this.updateTurnIndicator();

        // Reset timer
        if (this.timerEnabled) {
            this.resetTimer();
        }

        // AI move
        if (this.gameMode === 'ai' && this.currentPlayer === this.opponentSymbol) {
            setTimeout(() => this.makeAIMove(), 500);
        }
    }

    makeAIMove() {
        if (!this.gameActive) return;

        let moveIndex;

        switch (this.aiDifficulty) {
            case 'easy':
                moveIndex = this.getEasyMove();
                break;
            case 'normal':
                moveIndex = this.getNormalMove();
                break;
            case 'hard':
                moveIndex = this.getHardMove();
                break;
            case 'insane':
                moveIndex = this.getInsaneMove();
                break;
            default:
                moveIndex = this.getRandomMove();
        }

        if (moveIndex !== -1) {
            this.makeMove(moveIndex, this.opponentSymbol);
        }
    }

    // ===== AI DIFFICULTY ALGORITHMS =====

    getRandomMove() {
        const availableMoves = this.board
            .map((cell, index) => cell === null ? index : null)
            .filter(index => index !== null);
        
        return availableMoves.length > 0 
            ? availableMoves[Math.floor(Math.random() * availableMoves.length)]
            : -1;
    }

    getEasyMove() {
        if (Math.random() < 0.7) {
            return this.getRandomMove();
        }
        return this.getNormalMove();
    }

    getNormalMove() {
        const winMove = this.findWinningMove(this.opponentSymbol);
        if (winMove !== -1) return winMove;

        const blockMove = this.findWinningMove(this.playerSymbol);
        if (blockMove !== -1) return blockMove;

        if (this.board[4] === null) return 4;

        const corners = [0, 2, 6, 8].filter(i => this.board[i] === null);
        if (corners.length > 0) {
            return corners[Math.floor(Math.random() * corners.length)];
        }

        return this.getRandomMove();
    }

    getHardMove() {
        return this.minimax(this.board, this.opponentSymbol, 0, 4).index;
    }

    getInsaneMove() {
        return this.minimaxAlphaBeta(
            this.board, 
            this.opponentSymbol, 
            -Infinity, 
            Infinity, 
            true
        ).index;
    }

    findWinningMove(player) {
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === null) {
                this.board[i] = player;
                const isWin = this.checkWinner() === player;
                this.board[i] = null;
                if (isWin) return i;
            }
        }
        return -1;
    }

    minimax(board, player, depth, maxDepth) {
        const winner = this.checkWinnerFromBoard(board);
        
        if (winner === this.opponentSymbol) return { score: 10 - depth };
        if (winner === this.playerSymbol) return { score: depth - 10 };
        if (board.every(cell => cell !== null)) return { score: 0 };
        if (depth >= maxDepth) return { score: 0 };

        const moves = [];

        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                const newBoard = [...board];
                newBoard[i] = player;
                
                const nextPlayer = player === 'X' ? 'O' : 'X';
                const result = this.minimax(newBoard, nextPlayer, depth + 1, maxDepth);
                
                moves.push({
                    index: i,
                    score: result.score
                });
            }
        }

        let bestMove;
        if (player === this.opponentSymbol) {
            let bestScore = -Infinity;
            moves.forEach(move => {
                if (move.score > bestScore) {
                    bestScore = move.score;
                    bestMove = move;
                }
            });
        } else {
            let bestScore = Infinity;
            moves.forEach(move => {
                if (move.score < bestScore) {
                    bestScore = move.score;
                    bestMove = move;
                }
            });
        }

        return bestMove || { index: -1, score: 0 };
    }

    minimaxAlphaBeta(board, player, alpha, beta, maximizing) {
        const winner = this.checkWinnerFromBoard(board);
        
        if (winner === this.opponentSymbol) return { score: 10, index: -1 };
        if (winner === this.playerSymbol) return { score: -10, index: -1 };
        if (board.every(cell => cell !== null)) return { score: 0, index: -1 };

        if (maximizing) {
            let bestScore = -Infinity;
            let bestMove = -1;

            for (let i = 0; i < 9; i++) {
                if (board[i] === null) {
                    const newBoard = [...board];
                    newBoard[i] = this.opponentSymbol;
                    
                    const result = this.minimaxAlphaBeta(newBoard, this.playerSymbol, alpha, beta, false);
                    
                    if (result.score > bestScore) {
                        bestScore = result.score;
                        bestMove = i;
                    }
                    
                    alpha = Math.max(alpha, bestScore);
                    if (beta <= alpha) break;
                }
            }

            return { score: bestScore, index: bestMove };
        } else {
            let bestScore = Infinity;
            let bestMove = -1;

            for (let i = 0; i < 9; i++) {
                if (board[i] === null) {
                    const newBoard = [...board];
                    newBoard[i] = this.playerSymbol;
                    
                    const result = this.minimaxAlphaBeta(newBoard, this.opponentSymbol, alpha, beta, true);
                    
                    if (result.score < bestScore) {
                        bestScore = result.score;
                        bestMove = i;
                    }
                    
                    beta = Math.min(beta, bestScore);
                    if (beta <= alpha) break;
                }
            }

            return { score: bestScore, index: bestMove };
        }
    }

    // ===== WIN DETECTION =====

    checkWinner() {
        return this.checkWinnerFromBoard(this.board);
    }

    checkWinnerFromBoard(board) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                // Only highlight if game is still active AND we're checking the current board
                if (this.gameActive && board === this.board) {
                    // Store the winning pattern for later use
                    this.winningPattern = pattern;
                    this.highlightWinningCells(pattern);
                }
                return board[a];
            }
        }

        return null;
    }

    drawWinningLine(pattern) {
        const line = document.getElementById('winningLine');
        if (!line) return;
        
        const svg = line;
        const lineElement = svg.querySelector('line');
        if (!lineElement) return;
        
        const cells = document.querySelectorAll('.cell');
        if (!cells || cells.length < 9) return;
        
        const firstCell = cells[pattern[0]];
        const lastCell = cells[pattern[2]];
        if (!firstCell || !lastCell) return;
        
        const boardWrapper = document.querySelector('.board-wrapper');
        if (!boardWrapper) return;
        
        const firstRect = firstCell.getBoundingClientRect();
        const lastRect = lastCell.getBoundingClientRect();
        const boardRect = boardWrapper.getBoundingClientRect();

        const x1 = firstRect.left + firstRect.width / 2 - boardRect.left;
        const y1 = firstRect.top + firstRect.height / 2 - boardRect.top;
        const x2 = lastRect.left + lastRect.width / 2 - boardRect.left;
        const y2 = lastRect.top + lastRect.height / 2 - boardRect.top;

        lineElement.setAttribute('x1', x1);
        lineElement.setAttribute('y1', y1);
        lineElement.setAttribute('x2', x2);
        lineElement.setAttribute('y2', y2);

        // Only show the line if game is not active (game has ended)
        if (!this.gameActive) {
            svg.classList.add('show');
        }
    }

    // ===== TIMER =====

    startTimer() {
        this.timeLeft = 60;
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();

            if (this.timeLeft <= 10) {
                document.getElementById('timerProgress').classList.add('warning');
                if (this.timeLeft <= 3 && window.ui) {
                    window.ui.playSound('tick');
                }
            }

            if (this.timeLeft <= 0) {
                this.handleTimeout();
            }
        }, 1000);
    }

    resetTimer() {
        this.stopTimer();
        if (this.timerEnabled && this.gameActive) {
            this.startTimer();
        }
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        document.getElementById('timerProgress').classList.remove('warning');
    }

    updateTimerDisplay() {
        document.getElementById('timerText').textContent = this.timeLeft;
        
        const progress = document.getElementById('timerProgress');
        const circumference = 157;
        const offset = circumference - (this.timeLeft / 60) * circumference;
        progress.style.strokeDashoffset = offset;
    }

    handleTimeout() {
        this.stopTimer();
        if (window.ui) {
            window.ui.playSound('timeout');
        }
        
        if (this.gameMode === 'ai') {
            if (this.currentPlayer === this.playerSymbol) {
                if (window.ui) {
                    window.ui.addChatMessage('system', 'Time out! You lose.');
                }
                this.endGame(this.opponentSymbol);
            }
        } else if (this.gameMode === 'online') {
            if (this.isMyTurn && window.ui) {
                window.ui.addChatMessage('system', 'Time out! You lose this turn.');
            }
        }
    }

    // ===== UI UPDATES =====

    updatePlayerNames(player1, player2) {
        document.getElementById('playerXName').textContent = player1;
        document.getElementById('playerOName').textContent = player2;
        
        // Update avatars
        const playerXAvatar = document.querySelector('.player-x .player-avatar');
        const playerOAvatar = document.querySelector('.player-o .player-avatar');
        
        if (this.gameMode === 'ai') {
            // Player X is you
            if (playerXAvatar && window.avatarManager) {
                playerXAvatar.textContent = window.avatarManager.getAvatarEmoji();
            }
            // Player O is AI
            if (playerOAvatar) {
                playerOAvatar.textContent = '🤖';
            }
        } else if (this.gameMode === 'online') {
            // Show your avatar
            if (mySymbol === 'X' && playerXAvatar && window.avatarManager) {
                playerXAvatar.textContent = window.avatarManager.getAvatarEmoji();
            } else if (mySymbol === 'O' && playerOAvatar && window.avatarManager) {
                playerOAvatar.textContent = window.avatarManager.getAvatarEmoji();
            }
            
            // Show opponent avatar (default for now)
            if (mySymbol === 'X' && playerOAvatar) {
                playerOAvatar.textContent = '👤';
            } else if (mySymbol === 'O' && playerXAvatar) {
                playerXAvatar.textContent = '👤';
            }
        }
    }

    updateTurnIndicator() {
        const indicator = document.getElementById('turnIndicator');
        const playerXInfo = document.querySelector('.player-x');
        const playerOInfo = document.querySelector('.player-o');

        playerXInfo.classList.remove('active');
        playerOInfo.classList.remove('active');

        if (this.gameMode === 'online') {
            if (this.isMyTurn) {
                indicator.textContent = "Your Turn";
                if (mySymbol === 'X') {
                    playerXInfo.classList.add('active');
                } else {
                    playerOInfo.classList.add('active');
                }
            } else {
                indicator.textContent = "Opponent's Turn";
                if (mySymbol === 'X') {
                    playerOInfo.classList.add('active');
                } else {
                    playerXInfo.classList.add('active');
                }
            }
        } else {
            if (this.currentPlayer === 'X') {
                indicator.textContent = "Your Turn";
                playerXInfo.classList.add('active');
            } else {
                indicator.textContent = this.gameMode === 'ai' ? "AI's Turn" : "Opponent's Turn";
                playerOInfo.classList.add('active');
            }
        }
    }

    // ===== GAME END =====

    endGame(winner) {
        this.gameActive = false;
        this.stopTimer();

        const gameTime = this.calculateGameTime();
        const avgMoveTime = this.calculateAvgMoveTime();

        let result, points;

        if (winner === 'draw') {
            result = 'draw';
            points = 1;
            if (window.ui) window.ui.playSound('draw');
        } else if (winner === this.playerSymbol) {
            result = 'win';
            points = this.calculatePoints();
            if (window.ui) window.ui.playSound('win');
            
            // Draw winning line ONLY after game ends
            if (this.winningPattern) {
                this.drawWinningLine(this.winningPattern);
            }
        } else {
            result = 'lose';
            points = 0;
            if (window.ui) window.ui.playSound('lose');
            
            // Draw winning line ONLY after game ends
            if (this.winningPattern) {
                this.drawWinningLine(this.winningPattern);
            }
        }

        if (window.ui) {
            window.ui.recordGameResult(result);
        }

        setTimeout(() => {
            if (window.ui) {
                window.ui.showGameResult(result, points, {
                    gameTime: gameTime,
                    totalMoves: this.moveCount,
                    avgMoveTime: avgMoveTime
                });
            }
        }, 1500);
    }

    calculatePoints() {
        if (this.gameMode === 'ai') {
            const pointMap = {
                easy: 2,
                normal: 5,
                hard: 15,
                insane: 25
            };
            return pointMap[this.aiDifficulty] || 10;
        }
        return 10;
    }

    calculateGameTime() {
        const seconds = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    calculateAvgMoveTime() {
        if (this.moveCount <= 1) return '0s';
        
        const totalTime = this.moveTimes[this.moveTimes.length - 1] - this.moveTimes[0];
        const avgMs = totalTime / (this.moveCount - 1);
        return `${Math.round(avgMs / 1000)}s`;
    }

    // ===== RESET AND RESTART =====

    resetGame() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.gameActive = false;
        this.moveCount = 0;
        this.moveTimes = [];
        this.isMyTurn = false;
        this.winningPattern = null;
        this.stopTimer();

        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('filled', 'x', 'o', 'winner');
        });

        // Hide and reset the winning line
        const winningLine = document.getElementById('winningLine');
        if (winningLine) {
            winningLine.classList.remove('show');
            const lineElement = winningLine.querySelector('line');
            if (lineElement) {
                lineElement.setAttribute('x1', 0);
                lineElement.setAttribute('y1', 0);
                lineElement.setAttribute('x2', 0);
                lineElement.setAttribute('y2', 0);
            }
        }

        document.querySelector('.player-x').classList.remove('active');
        document.querySelector('.player-o').classList.remove('active');
    }

    restart() {
        if (this.gameMode === 'online') {
            // Request restart from server
            socket.emit('restartGame', currentRoomCode);
        } else if (this.gameMode === 'ai') {
            this.startAIGame(this.aiDifficulty);
        }
    }
}

const game = new TicTacToeGame();
window.game = game;
