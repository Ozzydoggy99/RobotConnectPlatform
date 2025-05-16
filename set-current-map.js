/**
 * Set the current map for robot L382502104987ir
 * This script ensures the robot has the correct map set for our workflow tests
 */
import axios from 'axios';

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const ROBOT_ID = 'L382502104987ir';
const MAP_ID = '6823a65a635e4a0ff05b8104'; // The uid of Floor1 map

async function setCurrentMap() {
  try {
    console.log(`Setting current map for robot ${ROBOT_ID}...`);
    
    // First, get connection details for direct API access
    const robotResponse = await axios.get(`${API_BASE_URL}/robot/${ROBOT_ID}`);
    const robot = robotResponse.data;
    
    if (!robot || !robot.metadata || !robot.metadata.connectionConfig) {
      throw new Error(`Robot ${ROBOT_ID} not properly configured`);
    }
    
    // Extract connection details
    const { publicIp, port } = robot.metadata.connectionConfig;
    
    // Set the current map using the robot's direct API
    console.log(`Setting map ${MAP_ID} as current map for robot ${ROBOT_ID}`);
    
    const setMapResponse = await axios({
      method: 'post',
      url: `http://${publicIp}:${port || 8090}/chassis/current-map`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'APPCODE 667a51a4d948433081a272c78d10a8a4' // Auth key for robot
      },
      data: {
        map_uid: MAP_ID // Using map_uid as per API docs
      }
    });
    
    console.log('Map set response:', setMapResponse.data);
    
    // Verify the current map was set
    const currentMapResponse = await axios({
      method: 'get',
      url: `http://${publicIp}:${port || 8090}/chassis/current-map`,
      headers: {
        'Authorization': 'APPCODE 667a51a4d948433081a272c78d10a8a4'
      }
    });
    
    console.log('Current map:', currentMapResponse.data);
    
    console.log(`Successfully set current map for robot ${ROBOT_ID}`);
    return currentMapResponse.data;
  } catch (error) {
    console.error('Error setting current map:');
    if (error.response) {
      console.error(error.response.data);
      console.error(`Status: ${error.response.status}`);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

// Run the script
setCurrentMap().catch(console.error);

export { setCurrentMap };