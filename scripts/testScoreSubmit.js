const axios = require('axios');
const crypto = require('crypto');

const API_URL = 'http://localhost:5000/api';

// Helper function to calculate checksum (same as server)
const calculateEventsChecksum = (events) => {
    const eventString = events
        .map(e => `${e.timestamp}-${e.type}-${JSON.stringify(e.data)}`)
        .join('|');
    return crypto.createHash('sha256').update(eventString).digest('hex');
};

async function testScoreSubmission() {
    try {
        // 1. Login first
        console.log('\n1. Logging in...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            mobile: '+8801736553937',
            password: '123456'
        });
        
        const token = loginResponse.data.token;
        console.log('Login successful');

        // 2. Start game session
        console.log('\n2. Starting game session...');
        const sessionResponse = await axios.post(
            `${API_URL}/scores/start-session`,
            {
                clientVersion: "1.0.0",
                deviceInfo: {
                    platform: 'web',
                    browser: 'chrome',
                    screenResolution: '1920x1080'
                }
            },
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        const { sessionId, timestamp } = sessionResponse.data;
        console.log('Game session started');

        // 3. Create game events
        const gameEvents = [
            {
                timestamp: timestamp,
                type: 'GAME_START',
                data: {}
            },
            {
                timestamp: timestamp + 5000, // 5 seconds later
                type: 'PASS_PIPE',
                data: { pipeNumber: 1 }
            },
            {
                timestamp: timestamp + 10000, // 10 seconds later
                type: 'PASS_PIPE',
                data: { pipeNumber: 2 }
            },
            {
                timestamp: timestamp + 15000, // 15 seconds later
                type: 'GAME_END',
                data: { reason: 'collision' }
            }
        ];

        // Calculate checksum
        const checksum = calculateEventsChecksum(gameEvents);

        // 4. Submit score
        console.log('\n3. Submitting score...');
        const scoreResponse = await axios.post(
            `${API_URL}/scores/submit`,
            {
                sessionId,
                score: 2, // 2 pipes passed = 2 points
                gameEvents,
                checksum
            },
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        console.log('Score submission response:', scoreResponse.data);

    } catch (error) {
        if (error.response) {
            console.error('Error Response:', {
                status: error.response.status,
                data: error.response.data
            });
        } else if (error.request) {
            console.error('No response received:', error.message);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run the test
testScoreSubmission();
