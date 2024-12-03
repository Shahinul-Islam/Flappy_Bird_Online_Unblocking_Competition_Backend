const crypto = require('crypto');

// Generate a unique session token with timestamp
const generateSessionToken = (userId) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    const data = `${userId}-${timestamp}-${random}`;
    return {
        sessionId: crypto.createHash('sha256').update(data).digest('hex'),
        timestamp
    };
};

// Verify game events and score
const verifyGameplay = (events, finalScore) => {
    if (!Array.isArray(events) || events.length === 0) {
        return { valid: false, reason: 'No game events recorded' };
    }

    // Check time consistency
    const startTime = new Date(events[0].timestamp);
    const endTime = new Date(events[events.length - 1].timestamp);
    const gameDuration = (endTime - startTime) / 1000; // in seconds

    // Game should last a reasonable amount of time
    if (gameDuration < 5) {
        return { valid: false, reason: 'Game duration too short' };
    }

    // Check if score progression is natural
    let calculatedScore = 0;
    let lastEventTime = startTime;

    for (const event of events) {
        const eventTime = new Date(event.timestamp);
        
        // Events should be in chronological order
        if (eventTime < lastEventTime) {
            return { valid: false, reason: 'Invalid event sequence' };
        }

        // Time between events should be reasonable
        const timeDiff = (eventTime - lastEventTime) / 1000;
        if (timeDiff > 10) {
            return { valid: false, reason: 'Suspicious time gap between events' };
        }

        // Update score based on event type
        if (event.type === 'PASS_PIPE') {
            calculatedScore += 1;
        }

        lastEventTime = eventTime;
    }

    // Verify final score matches events
    if (Math.abs(calculatedScore - finalScore) > 1) {
        return { valid: false, reason: 'Score mismatch with events' };
    }

    return { valid: true };
};

// Calculate checksum for game events
const calculateEventsChecksum = (events) => {
    const eventString = events
        .map(e => `${e.timestamp}-${e.type}-${JSON.stringify(e.data)}`)
        .join('|');
    return crypto.createHash('sha256').update(eventString).digest('hex');
};

// Verify client integrity
const verifyClientIntegrity = (clientVersion, expectedVersion) => {
    return clientVersion === expectedVersion;
};

module.exports = {
    generateSessionToken,
    verifyGameplay,
    calculateEventsChecksum,
    verifyClientIntegrity
};
