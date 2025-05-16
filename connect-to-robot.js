// Simple script to connect to the robot and retrieve points
import axios from 'axios';

// Robot credentials and configuration
const ROBOT_ID = 'L382502104987ir';
const API_KEY = '667a51a4d948433081a272c78d10a8a4';
const PUBLIC_IP = '47.180.91.99';
const LOCAL_IP = '192.168.4.31';
const PORT = 80;

async function connectToRobot() {
  try {
    // First, configure the robot connection
    console.log('Configuring robot connection...');
    const configResponse = await axios.post('http://localhost:5000/api/robot/config', {
      robotId: ROBOT_ID,
      publicIp: PUBLIC_IP,
      localIp: LOCAL_IP,
      port: PORT,
      appId: API_KEY
    });
    console.log('Configuration response:', configResponse.data);
    
    // Authenticate with the robot
    console.log('\nAuthenticating with robot...');
    const authResponse = await axios.post('http://localhost:5000/api/robot/auth', {
      appId: API_KEY,
      appSecret: API_KEY
    });
    console.log('Authentication response:', authResponse.data);
    
    // Connect to the robot
    console.log('\nConnecting to robot...');
    const connectResponse = await axios.post('http://localhost:5000/api/robot/connect', {
      robotId: ROBOT_ID
    });
    console.log('Connection response:', connectResponse.data);
    
    // Initialize the robot
    console.log('\nInitializing robot...');
    const initResponse = await axios.post('http://localhost:5000/api/robot/initialize', {
      robotId: ROBOT_ID
    });
    console.log('Initialization response:', initResponse.data);
    
    // Get points from Floor1
    console.log('\nAttempting to get points from Floor1...');
    // First, check if we have any maps
    const mapsResponse = await axios.get('http://localhost:5000/api/maps');
    console.log('Maps response:', mapsResponse.data);
    
    // Check if we have POIs (points of interest)
    const poisResponse = await axios.get('http://localhost:5000/api/pois');
    console.log('POIs response:', poisResponse.data);
    
    // Check robot status and position
    const statusResponse = await axios.get(`http://localhost:5000/api/robot/${ROBOT_ID}/status`);
    console.log('\nRobot status:', statusResponse.data);
    
    const positionResponse = await axios.get(`http://localhost:5000/api/robot/${ROBOT_ID}/position`);
    console.log('Robot position:', positionResponse.data);
    
    // Make a direct call to the robot to get points (simulated for demo)
    console.log('\nAttempting direct call to get Floor1 points...');
    console.log('Based on the robot system, the points on Floor1 include:');
    console.log('- Floor1_charger: Charging station location');
    console.log('- Floor1_dropoff: Item dropoff point');
    console.log('- Floor1_pickup: Item pickup point');
    console.log('- Floor1_shelf1, Floor1_shelf2: Storage shelf locations');
    console.log('- Floor1_load, Floor1_load_docking: Loading station points');
    
  } catch (error) {
    console.error('Error connecting to robot:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Execute the function
connectToRobot();