const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testMobileSession() {
    try {
        // 1. Login first
        console.log('\n1. Logging in...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            mobile: '+8801736553937',  // Using exact format from database
            password: '123456'
        });
        
        const token = loginResponse.data.token;
        console.log('Login successful, got token');

        // 2. Start game session with mobile device info
        console.log('\n2. Starting mobile game session...');
        const sessionResponse = await axios.post(
            `${API_URL}/scores/start-session`,
            {
                clientVersion: "1.0.0",
                deviceInfo: {
                    platform: "android",
                    deviceModel: "Pixel 6",
                    osVersion: "Android 13"
                }
            },
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        console.log('Game session response:', sessionResponse.data);

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
testMobileSession();
