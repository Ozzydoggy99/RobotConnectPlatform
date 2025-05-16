/**
 * Test script to connect to robot L382502104987ir
 */
import * as directApi from './server/robot/direct-api.js';

// Define the robot ID
const ROBOT_ID = 'L382502104987ir';
const APPCODE = '667a51a4d948433081a272c78d10a8a4';

// Configure the robot connection
directApi.configureRobot(ROBOT_ID, {
  publicIp: '47.180.91.99', // Public IP from notes
  port: 80,
  useSsl: false
});

// Test the connection to the robot
async function testConnection() {
  try {
    console.log(`Attempting to connect to robot: ${ROBOT_ID}`);
    
    // Create WebSocket connection to monitor robot status
    const wsConnection = directApi.connectToRobotWebSocket(
      ROBOT_ID, 
      ['/robot/status', '/map/info'],
      (message) => {
        console.log('Received real-time data:', JSON.stringify(message, null, 2));
      }
    );
    
    console.log('WebSocket connection established');
    
    // Wait for a moment to receive some data
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try to fetch the robot's current status via REST API
    try {
      const url = directApi.getRobotApiUrl(ROBOT_ID, '/chassis/status');
      console.log(`Fetching robot status from: ${url}`);
      
      // Use direct axios call from directApi for testing
      const status = await fetch(url, {
        headers: {
          'APPCODE': `APPCODE ${APPCODE}`
        }
      }).then(res => res.json());
      
      console.log('Robot status:', JSON.stringify(status, null, 2));
    } catch (error) {
      console.error('Error fetching robot status:', error.message);
    }
    
    // Close the connection after testing
    directApi.disconnectRobotWebSocket(ROBOT_ID);
    console.log('WebSocket connection closed');
    
  } catch (error) {
    console.error('Connection test failed:', error.message);
  }
}

// Run the test
testConnection().catch(console.error);