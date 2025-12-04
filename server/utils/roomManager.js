class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        do {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (this.rooms.has(code));
        return code;
    }

    createRoom(hostId, hostUsername, settings = {}) {
        const code = this.generateRoomCode();
        
        const room = {
            code: code,
            host: hostId,
            player1: hostId,
            player2: null,
            players: {
                [hostId]: {
                    id: hostId,
                    username: hostUsername,
                    symbol: 'X',
                    ready: true
                }
            },
            spectators: [],
            settings: {
                allowSpectators: settings.allowSpectators ?? true,
                timerEnabled: settings.timerEnabled ?? true,
                timeLimit: settings.timeLimit ?? 60
            },
            gameState: null,
            createdAt: Date.now(),
            status: 'waiting' // waiting, active, finished
        };

        this.rooms.set(code, room);
        return room;
    }

    createMatchmakingRoom(player1Id, player2Id, player1Username, player2Username) {
        const code = this.generateRoomCode();
        
        const room = {
            code: code,
            host: player1Id,
            player1: player1Id,
            player2: player2Id,
            players: {
                [player1Id]: {
                    id: player1Id,
                    username: player1Username,
                    symbol: 'X',
                    ready: true
                },
                [player2Id]: {
                    id: player2Id,
                    username: player2Username,
                    symbol: 'O',
                    ready: true
                }
            },
            spectators: [],
            settings: {
                allowSpectators: true,
                timerEnabled: true,
                timeLimit: 60
            },
            gameState: null,
            createdAt: Date.now(),
            status: 'waiting',
            isMatchmaking: true
        };

        this.rooms.set(code, room);
        return code;
    }

    joinRoom(code, playerId, username) {
        const room = this.rooms.get(code);
        
        if (!room) {
            throw new Error('Room not found');
        }

        if (room.player2) {
            throw new Error('Room is full');
        }

        room.player2 = playerId;
        room.players[playerId] = {
            id: playerId,
            username: username,
            symbol: 'O',
            ready: true
        };

        return room;
    }

    startGame(code) {
        const room = this.rooms.get(code);
        
        if (!room) {
            throw new Error('Room not found');
        }

        if (!room.player1 || !room.player2) {
            throw new Error('Not enough players');
        }

        room.status = 'active';
        room.gameState = {
            board: Array(9).fill(null),
            currentPlayer: room.player1,
            moveCount: 0,
            timeLeft: room.settings.timerEnabled ? room.settings.timeLimit : null,
            startTime: Date.now(),
            lastMoveTime: Date.now(),
            status: 'active',
            winner: null
        };

        return room.gameState;
    }

    getRoom(code) {
        return this.rooms.get(code);
    }

    removeRoom(code) {
        this.rooms.delete(code);
    }

    getActiveRoomsCount() {
        return Array.from(this.rooms.values()).filter(r => r.status === 'active').length;
    }

    // Clean up old rooms (call periodically)
    cleanupOldRooms() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes

        for (const [code, room] of this.rooms.entries()) {
            if (now - room.createdAt > maxAge && room.status !== 'active') {
                this.rooms.delete(code);
                console.log(`Cleaned up old room: ${code}`);
            }
        }
    }
}

module.exports = RoomManager;
