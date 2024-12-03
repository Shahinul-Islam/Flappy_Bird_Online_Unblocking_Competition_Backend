const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let authToken = '';
let sessionId = '';

async function testScores() {
    try {
        // 1. Login to get token
        console.log('\n1. Logging in...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            mobile: '+8801736553937',
            password: '123456'
        });
        
        authToken = loginResponse.data.token;
        console.log('Login successful, got token:', authToken);

        // 2. Start game session
        console.log('\n2. Starting game session...');
        const sessionResponse = await axios.post(
            `${API_URL}/scores/start-session`,
            {
                clientVersion: '1.0.0',
                deviceInfo: {
                    platform: 'web',
                    browser: 'chrome'
                }
            },
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        
        sessionId = sessionResponse.data.sessionId;
        console.log('Session started:', sessionId);

        // 3. Record some game events
        console.log('\n3. Recording game events...');
        await axios.post(
            `${API_URL}/scores/record-event/${sessionId}`,
            {
                eventType: 'jump',
                eventData: { height: 100 },
                timestamp: new Date().toISOString()
            },
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        console.log('Game event recorded');

        // 4. Submit a score
        console.log('\n4. Submitting score...');
        const submitResponse = await axios.post(
            `${API_URL}/scores/submit`,
            {
                score: 15,
                sessionId,
                events: [
                    {
                        type: 'jump',
                        timestamp: new Date().toISOString(),
                        data: { height: 100 }
                    }
                ],
                checksum: 'test-checksum'
            },
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        console.log('Score submitted:', submitResponse.data);

        // 5. Get high scores
        console.log('\n5. Getting high scores...');
        const highScoresResponse = await axios.get(`${API_URL}/scores`);
        console.log('High Scores:');
        console.log(JSON.stringify(highScoresResponse.data, null, 2));

        // 6. Get personal scores
        console.log('\n6. Getting personal scores...');
        const personalScoresResponse = await axios.get(
            `${API_URL}/scores/personal`,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        console.log('Personal Scores:');
        console.log(JSON.stringify(personalScoresResponse.data, null, 2));

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

// Run the tests
testScores();
