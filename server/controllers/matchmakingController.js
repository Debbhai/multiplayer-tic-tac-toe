class MatchmakingController {
    constructor() {
        this.queue = [];
        this.matchRange = 100; // Points difference for matching
    }

    addToQueue(playerId, playerData) {
        // Check if player already in queue
        const existingIndex = this.queue.findIndex(p => p.id === playerId);
        if (existingIndex !== -1) {
            this.queue.splice(existingIndex, 1);
        }

        const player = {
            id: playerId,
            username: playerData.username,
            points: playerData.points || 0,
            joinedAt: Date.now()
        };

        // Try to find a match
        const match = this.findMatch(player);

        if (match) {
            // Remove matched player from queue
            const matchIndex = this.queue.findIndex(p => p.id === match.id);
            this.queue.splice(matchIndex, 1);

            return {
                player1: player,
                player2: match
            };
        } else {
            // Add to queue
            this.queue.push(player);
            return null;
        }
    }

    findMatch(player) {
        // Sort queue by points similarity
        const sortedQueue = [...this.queue].sort((a, b) => {
            const diffA = Math.abs(a.points - player.points);
            const diffB = Math.abs(b.points - player.points);
            return diffA - diffB;
        });

        // Find first suitable match
        for (const candidate of sortedQueue) {
            const pointsDiff = Math.abs(candidate.points - player.points);
            const waitTime = Date.now() - candidate.joinedAt;

            // Increase match range based on wait time
            const adjustedRange = this.matchRange + (waitTime / 1000) * 10;

            if (pointsDiff <= adjustedRange) {
                return candidate;
            }
        }

        return null;
    }

    removeFromQueue(playerId) {
        const index = this.queue.findIndex(p => p.id === playerId);
        if (index !== -1) {
            this.queue.splice(index, 1);
            return true;
        }
        return false;
    }

    getQueuePosition(playerId) {
        const index = this.queue.findIndex(p => p.id === playerId);
        return index !== -1 ? index + 1 : 0;
    }

    getQueueSize() {
        return this.queue.length;
    }

    getEstimatedWaitTime(position) {
        if (position <= 1) return 5;
        if (position <= 3) return 15;
        if (position <= 5) return 30;
        return 60;
    }

    // Clean up old queue entries
    cleanupQueue() {
        const now = Date.now();
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes

        this.queue = this.queue.filter(player => {
            const waitTime = now - player.joinedAt;
            return waitTime < maxWaitTime;
        });
    }
}

module.exports = MatchmakingController;
