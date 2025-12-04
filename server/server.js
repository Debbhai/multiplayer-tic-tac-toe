const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const RoomManager = require('./utils/roomManager');
const MatchmakingController = require('./controllers/matchmakingController');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize managers
const roomManager = new RoomManager();
const matchmaking = new MatchmakingController();

// Store connected users
const connectedUsers = new Map();

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Store user info
    connectedUsers.set(socket.id, {
        id: socket.id,
        username: `Player${Math.floor(Math.random() * 10000)}`,
        points: 0,
        inGame: false
    });

    // Send user info
    socket.emit('connected', {
        userId: socket.id,
        username: connectedUsers.get(socket.id).username
    });

    // ===== ROOM MANAGEMENT =====

    // Create Private Room
    socket.on('createRoom', (settings, callback) => {
        try {
            const user = connectedUsers.get(socket.id);
            const room = roomManager.createRoom(socket.id, user.username, settings);
            
            socket.join(room.code);
            user.inGame = true;
            user.currentRoom = room.code;

            callback({
                success: true,
                roomCode: room.code,
                room: room
            });

            console.log(`Room ${room.code} created by ${user.username}`);
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });

    // Join Room
    socket.on('joinRoom', (roomCode, callback) => {
        try {
            const user = connectedUsers.get(socket.id);
            const room = roomManager.joinRoom(roomCode, socket.id, user.username);

            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            socket.join(roomCode);
            user.inGame = true;
            user.currentRoom = roomCode;

            // Notify room creator
            io.to(room.host).emit('playerJoined', {
                playerId: socket.id,
                username: user.username
            });

            // Start game
            const gameState = roomManager.startGame(roomCode);
            
            io.to(roomCode).emit('gameStart', {
                room: room,
                gameState: gameState
            });

            callback({
                success: true,
                room: room,
                gameState: gameState
            });

            console.log(`${user.username} joined room ${roomCode}`);
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });

    // Leave Room
    socket.on('leaveRoom', () => {
        const user = connectedUsers.get(socket.id);
        if (user && user.currentRoom) {
            const roomCode = user.currentRoom;
            const room = roomManager.getRoom(roomCode);

            if (room) {
                socket.leave(roomCode);
                io.to(roomCode).emit('playerLeft', {
                    playerId: socket.id,
                    username: user.username
                });

                roomManager.removeRoom(roomCode);
                user.inGame = false;
                user.currentRoom = null;

                console.log(`${user.username} left room ${roomCode}`);
            }
        }
    });

    // ===== MATCHMAKING =====

    // Join Matchmaking Queue
    socket.on('joinMatchmaking', (userPoints, callback) => {
        try {
            const user = connectedUsers.get(socket.id);
            user.points = userPoints || 0;

            const match = matchmaking.addToQueue(socket.id, user);

            if (match) {
                // Match found
                const roomCode = roomManager.createMatchmakingRoom(
                    match.player1.id,
                    match.player2.id,
                    match.player1.username,
                    match.player2.username
                );

                const room = roomManager.getRoom(roomCode);

                // Join both players to room
                io.sockets.sockets.get(match.player1.id)?.join(roomCode);
                io.sockets.sockets.get(match.player2.id)?.join(roomCode);

                // Update users
                connectedUsers.get(match.player1.id).inGame = true;
                connectedUsers.get(match.player1.id).currentRoom = roomCode;
                connectedUsers.get(match.player2.id).inGame = true;
                connectedUsers.get(match.player2.id).currentRoom = roomCode;

                // Start game
                const gameState = roomManager.startGame(roomCode);

                // Notify both players
                io.to(roomCode).emit('matchFound', {
                    room: room,
                    gameState: gameState
                });

                console.log(`Match found: ${match.player1.username} vs ${match.player2.username}`);
            } else {
                // Added to queue
                const position = matchmaking.getQueuePosition(socket.id);
                callback({
                    success: true,
                    inQueue: true,
                    position: position
                });
            }
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });

    // Cancel Matchmaking
    socket.on('cancelMatchmaking', () => {
        matchmaking.removeFromQueue(socket.id);
        console.log(`${socket.id} cancelled matchmaking`);
    });

    // Get Queue Status
    socket.on('getQueueStatus', (callback) => {
        const position = matchmaking.getQueuePosition(socket.id);
        const estimatedWait = matchmaking.getEstimatedWaitTime(position);
        
        callback({
            position: position,
            estimatedWait: estimatedWait
        });
    });

    // ===== GAME LOGIC =====

    // Make Move
    socket.on('makeMove', (data, callback) => {
        try {
            const { roomCode, cellIndex } = data;
            const room = roomManager.getRoom(roomCode);

            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            const gameState = room.gameState;

            // Validate move
            if (gameState.board[cellIndex] !== null) {
                return callback({ success: false, error: 'Cell already taken' });
            }

            if (gameState.currentPlayer !== socket.id) {
                return callback({ success: false, error: 'Not your turn' });
            }

            // Make move
            const playerSymbol = room.players[socket.id].symbol;
            gameState.board[cellIndex] = playerSymbol;
            gameState.moveCount++;
            gameState.lastMoveTime = Date.now();

            // Check for winner
            const winner = checkWinner(gameState.board);
            
            if (winner) {
                gameState.winner = winner;
                gameState.status = 'finished';
                
                const winnerData = winner === 'draw' 
                    ? { result: 'draw' }
                    : { 
                        result: 'win', 
                        winner: winner,
                        winnerId: room.players[Object.keys(room.players).find(
                            id => room.players[id].symbol === winner
                        )].id
                    };

                io.to(roomCode).emit('gameOver', winnerData);
            } else {
                // Switch turn
                gameState.currentPlayer = gameState.currentPlayer === room.player1 
                    ? room.player2 
                    : room.player1;

                // Reset timer
                if (room.settings.timerEnabled) {
                    gameState.timeLeft = 60;
                }

                // Broadcast move
                io.to(roomCode).emit('moveMade', {
                    cellIndex: cellIndex,
                    symbol: playerSymbol,
                    nextPlayer: gameState.currentPlayer,
                    gameState: gameState
                });
            }

            callback({ success: true });
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });

    // Restart Game
    socket.on('restartGame', (roomCode) => {
        const room = roomManager.getRoom(roomCode);
        if (room) {
            const gameState = roomManager.startGame(roomCode);
            io.to(roomCode).emit('gameRestart', { gameState });
            console.log(`Game restarted in room ${roomCode}`);
        }
    });

    // ===== CHAT =====

    // Send Message
    socket.on('chatMessage', (data) => {
        const { roomCode, message } = data;
        const user = connectedUsers.get(socket.id);

        if (user && roomCode) {
            io.to(roomCode).emit('chatMessage', {
                userId: socket.id,
                username: user.username,
                message: message,
                timestamp: Date.now()
            });
        }
    });

    // Send Reaction
    socket.on('reaction', (data) => {
        const { roomCode, reaction } = data;
        const user = connectedUsers.get(socket.id);

        if (user && roomCode) {
            io.to(roomCode).emit('reaction', {
                userId: socket.id,
                username: user.username,
                reaction: reaction,
                timestamp: Date.now()
            });
        }
    });

    // ===== SPECTATOR MODE =====

    // Join as Spectator
    socket.on('spectateRoom', (roomCode, callback) => {
        try {
            const room = roomManager.getRoom(roomCode);
            
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (!room.settings.allowSpectators) {
                return callback({ success: false, error: 'Spectators not allowed' });
            }

            socket.join(roomCode);
            room.spectators.push(socket.id);

            io.to(roomCode).emit('spectatorJoined', {
                spectatorId: socket.id,
                spectatorCount: room.spectators.length
            });

            callback({
                success: true,
                room: room,
                gameState: room.gameState
            });

            console.log(`Spectator ${socket.id} joined room ${roomCode}`);
        } catch (error) {
            callback({ success: false, error: error.message });
        }
    });

    // ===== DISCONNECT =====

    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        
        if (user) {
            // Remove from matchmaking queue
            matchmaking.removeFromQueue(socket.id);

            // Handle room disconnect
            if (user.currentRoom) {
                const roomCode = user.currentRoom;
                const room = roomManager.getRoom(roomCode);

                if (room) {
                    io.to(roomCode).emit('playerDisconnected', {
                        playerId: socket.id,
                        username: user.username
                    });

                    // End game if in progress
                    if (room.gameState.status === 'active') {
                        const opponent = room.player1 === socket.id ? room.player2 : room.player1;
                        io.to(opponent).emit('opponentDisconnected', {
                            message: 'Opponent disconnected. You win by default!'
                        });
                    }

                    roomManager.removeRoom(roomCode);
                }
            }

            connectedUsers.delete(socket.id);
            console.log(`Client disconnected: ${socket.id}`);
        }
    });
});

// Helper function to check winner
function checkWinner(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]              // Diagonals
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    // Check for draw
    if (board.every(cell => cell !== null)) {
        return 'draw';
    }

    return null;
}

// API Routes
app.get('/api/stats', (req, res) => {
    res.json({
        activeRooms: roomManager.getActiveRoomsCount(),
        playersOnline: connectedUsers.size,
        playersInQueue: matchmaking.getQueueSize()
    });
});

app.get('/api/leaderboard', (req, res) => {
    // This would fetch from database in production
    const topPlayers = Array.from(connectedUsers.values())
        .sort((a, b) => b.points - a.points)
        .slice(0, 10)
        .map(user => ({
            username: user.username,
            points: user.points
        }));

    res.json(topPlayers);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🎮 Game URL: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
