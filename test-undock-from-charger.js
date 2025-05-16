/**
 * Test script for undocking the AutoXing robot from the charging station
 * This script tests sending the undock command to allow movement
 */
import axios from 'axios';
import { configureRobot, createRobotApiClient } from './server/robot/direct-api.js';

const ROBOT_ID = 'L382502104987ir';
const ROBOT_IP = '47.180.91.99';
const ROBOT_PORT = 8090;

async function testUndockFromCharger() {
  try {
    console.log(`Starting undock test for robot ${ROBOT_ID}...`);
    
    // Configure the robot first
    configureRobot(ROBOT_ID, {
      publicIp: ROBOT_IP,
      port: ROBOT_PORT,
      wsPort: ROBOT_PORT
    });
    
    // Get robot API client
    const apiClient = createRobotApiClient(ROBOT_ID, ROBOT_IP, ROBOT_PORT);
    if (!apiClient) {
      throw new Error(`Could not create API client for robot ${ROBOT_ID}`);
    }
    
    // First check robot status to confirm it's charging
    console.log('Checking robot status...');
    try {
      const status = await apiClient.getStatus();
      console.log('Current robot status:', status);
      
      if (status.power_supply_status === 'charging' || status.is_charging) {
        console.log(`Robot is charging, will send undock command`);
      } else {
        console.log(`Robot doesn't appear to be charging (power status: ${status.power_supply_status})`);
      }
    } catch (statusError) {
      console.error('Error getting robot status:', statusError.message);
    }
    
    // Send undock command using the direct services API
    console.log('Sending undock command...');
    try {
      // Services endpoint should be used directly
      const undockResponse = await axios.post(`http://47.180.91.99:8090/services/undock`);
      console.log('Undock command response:', undockResponse.status, undockResponse.data);
      
      // Wait a moment for the undock operation to complete
      console.log('Waiting for undock to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check status again to confirm the robot is no longer charging
      const updatedStatus = await apiClient.getStatus();
      console.log('Updated robot status:', updatedStatus);
      
      if (updatedStatus.power_supply_status === 'charging' || updatedStatus.is_charging) {
        console.log(`WARNING: Robot still appears to be charging`);
      } else {
        console.log(`SUCCESS: Robot is no longer in charging state`);
      }
    } catch (undockError) {
      console.error('Error sending undock command:', undockError.message);
    }
    
    // Try alternative disconnecting from charger (robot-specific method)
    console.log('Testing alternative disconnect method...');
    try {
      // Try robot's "Disconnect from charger" command which may be specific for this model
      const disconnectResponse = await axios.post(`http://47.180.91.99:8090/services/disconnect_from_charger`);
      console.log('Disconnect command response:', disconnectResponse.status, disconnectResponse.data);
    } catch (disconnectError) {
      console.log('Alternative disconnect command not supported:', disconnectError.message);
    }
    
    console.log('Undock test completed');
  } catch (error) {
    console.error('Undock test failed:', error.message);
  }
}

// Execute the test
testUndockFromCharger();