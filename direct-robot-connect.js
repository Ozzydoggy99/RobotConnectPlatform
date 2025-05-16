/**
 * Direct robot connection script
 * This script demonstrates connecting directly to the robot
 */
import axios from 'axios';
import WebSocket from 'ws';

const ROBOT_SN = 'L382502104987ir';
const PUBLIC_IP = '47.180.91.99';
const HTTP_PORT = 8090; // Using the same port for both REST API and WebSocket
const WS_PORT = 8090;
const APPCODE = '667a51a4d948433081a272c78d10a8a4';

// Store WebSocket connection
let wsConnection = null;

/**
 * Connect to the robot's WebSocket for real-time data
 */
function connectToRobotWebSocket() {
  return new Promise((resolve, reject) => {
    try {
      // Format based on AutoXing documentation
      const wsUrl = `ws://${PUBLIC_IP}:${WS_PORT}/ws/v2/topics`;
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        console.log('WebSocket connection established');
        
        // Subscribe to topics as per documentation
        const topics = [
          '/tracked_pose',
          '/battery_state',
          '/planning_state',
          '/wheel_state',
          '/slam/state',
          '/nearby_robots',
          '/alerts'
        ];
        
        const subscriptionMessage = {
          op: 'subscribe',
          topics: topics
        };
        
        ws.send(JSON.stringify(subscriptionMessage));
        console.log(`Subscribed to topics: ${topics.join(', ')}`);
        
        wsConnection = ws;
        resolve(ws);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log(`Received message from topic ${message.topic}`);
          
          // Process different message types based on topic
          if (message.topic === '/tracked_pose') {
            console.log(`Robot position: x=${message.pos[0]}, y=${message.pos[1]}, orientation=${message.ori}`);
          } else if (message.topic === '/battery_state') {
            console.log(`Battery level: ${message.percentage}%, charging: ${message.is_charging}`);
          } else if (message.topic === '/alerts') {
            console.log(`Alert received: ${JSON.stringify(message)}`);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });
      
      ws.on('close', () => {
        console.log('WebSocket connection closed');
        wsConnection = null;
      });
    } catch (error) {
      console.error('Error setting up WebSocket connection:', error);
      reject(error);
    }
  });
}

/**
 * Get robot status using REST API
 */
async function getRobotStatus() {
  try {
    console.log('Getting robot status...');
    
    // Format based on AutoXing documentation
    const response = await axios.get(`http://${PUBLIC_IP}:${HTTP_PORT}/chassis/state`, {
      headers: {
        'APPCODE': `APPCODE ${APPCODE}`
      }
    });
    
    console.log('Robot status:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting robot status:', error.message);
    console.error('Response:', error.response?.data);
    throw error;
  }
}

/**
 * Get the current map for the robot
 */
async function getCurrentMap() {
  try {
    console.log('Getting current map...');
    
    // Format based on AutoXing documentation
    const response = await axios.get(`http://${PUBLIC_IP}:${HTTP_PORT}/chassis/current-map`, {
      headers: {
        'APPCODE': `APPCODE ${APPCODE}`
      }
    });
    
    console.log('Current map:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting current map:', error.message);
    console.error('Response:', error.response?.data);
    throw error;
  }
}

/**
 * Check if the robot has a reliable pose (position)
 */
async function getRobotPose() {
  try {
    console.log('Getting robot pose...');
    
    // Format based on AutoXing documentation
    const response = await axios.get(`http://${PUBLIC_IP}:${HTTP_PORT}/chassis/pose`, {
      headers: {
        'APPCODE': `APPCODE ${APPCODE}`
      }
    });
    
    console.log('Robot pose:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting robot pose:', error.message);
    console.error('Response:', error.response?.data);
    throw error;
  }
}

/**
 * Main function to test robot connection
 */
async function main() {
  try {
    console.log(`Testing connection to robot ${ROBOT_SN}...`);
    
    // First connect to WebSocket for real-time data
    await connectToRobotWebSocket();
    
    // Then test REST API endpoints
    await getRobotStatus();
    await getCurrentMap();
    await getRobotPose();
    
    console.log('Direct robot connection tests completed');
  } catch (error) {
    console.error('Error in main execution:', error);
  }
}

// Run the main function
main();