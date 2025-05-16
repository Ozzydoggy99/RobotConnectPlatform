/**
 * API test script for undocking the robot
 * This script tests the undock API endpoint that uses our improved charger-actions implementation
 */
const axios = require('axios');

const ROBOT_ID = 'L382502104987ir';
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Test the undock API endpoint
 */
async function testUndockApi() {
  try {
    console.log(`Testing undock API for robot ${ROBOT_ID}...`);
    
    // First get robot status to verify it's charging
    const statusResponse = await axios.get(`${API_BASE_URL}/robot/${ROBOT_ID}/status`);
    console.log('Current robot status:', statusResponse.data);
    
    // Send the undock command
    console.log('Sending undock command...');
    const undockResponse = await axios.post(`${API_BASE_URL}/robot/${ROBOT_ID}/undock`);
    
    // Check if the response is valid JSON
    if (typeof undockResponse.data === 'object') {
      console.log('Undock response:', undockResponse.data);
      
      if (undockResponse.data.success) {
        console.log('✅ Undock command sent successfully!');
        
        // Wait to check status change
        console.log('Waiting 5 seconds to check status change...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Get updated status
        const updatedStatus = await axios.get(`${API_BASE_URL}/robot/${ROBOT_ID}/status`);
        console.log('Updated robot status:', updatedStatus.data);
      } else {
        console.log('❌ Undock command failed:', undockResponse.data.message);
      }
    } else {
      console.log('❌ Invalid response format. Server might have returned HTML instead of JSON.');
      console.log('Status code:', undockResponse.status);
    }
  } catch (error) {
    console.error('Error testing undock API:', error.response ? error.response.data : error.message);
  }
}

// Execute the test
testUndockApi();