/**
 * Test script for the updated AutoXing direct-api.js implementation
 * This script tests the robot configuration and task tracking methods
 */
import * as directApi from './server/robot/direct-api.js';

async function testDirectApi() {
  try {
    console.log('Starting direct API test...');
    
    // Robot ID to test
    const robotId = 'L382502104987ir';
    
    // Step 1: Configure Robot
    console.log(`\nStep 1: Configure Robot ${robotId}`);
    const config = {
      publicIp: '47.180.91.99',
      localIp: '192.168.4.31', 
      port: 8090, // Using correct port 8090 as per documentation
      wsPort: 8090,
      appCode: '667a51a4d948433081a272c78d10a8a4'
    };
    
    const configResult = directApi.configureRobot(robotId, config);
    console.log('Robot configured:', configResult);
    
    // Step 2: Connect to WebSocket
    console.log(`\nStep 2: Connect to WebSocket for real-time data`);
    const messageHandler = (message) => {
      console.log('WebSocket message received:', JSON.stringify(message, null, 2));
    };
    
    const wsConnection = directApi.connectToRobotWebSocket(
      robotId, 
      ['/battery_state', '/tracked_pose', '/planning_state'], 
      messageHandler
    );
    
    console.log('WebSocket connection started');
    
    // Wait for WebSocket to connect
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Get Robot API Client
    console.log(`\nStep 3: Get API Client for robot ${robotId}`);
    const apiClient = directApi.getRobotApiClient(robotId);
    
    // Step 4: Get current status
    console.log(`\nStep 4: Get Status`);
    try {
      const status = await apiClient.getStatus();
      console.log('Robot status:', status);
    } catch (error) {
      console.error('Error getting status:', error.message);
    }
    
    // Step 5: Get battery status
    console.log(`\nStep 5: Get Battery Status`);
    try {
      const batteryStatus = await apiClient.getBatteryStatus();
      console.log('Battery status:', batteryStatus);
    } catch (error) {
      console.error('Error getting battery status:', error.message);
    }
    
    // Step 6: Get all tasks
    console.log(`\nStep 6: Get all Tasks`);
    try {
      const tasks = await apiClient.getTasks();
      console.log('Tasks:', tasks);
    } catch (error) {
      console.error('Error getting tasks:', error.message);
    }
    
    // Step 7: Get current task
    console.log(`\nStep 7: Get Current Task`);
    try {
      const currentTask = await apiClient.getCurrentTask();
      console.log('Current task:', currentTask);
    } catch (error) {
      console.error('Error getting current task:', error.message);
    }
    
    // Step 8: Task Status from WebSocket
    console.log(`\nStep 8: Get Task Status from WebSocket`);
    const wsStatus = directApi.getRobotTaskStatus(robotId);
    console.log('WebSocket task status:', wsStatus);
    
    // Step 9: Disconnect WebSocket after testing
    console.log(`\nStep 9: Disconnect WebSocket`);
    directApi.disconnectRobotWebSocket(robotId);
    console.log('WebSocket disconnected');
    
    console.log('\nDirect API test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testDirectApi().catch(error => {
  console.error('Unhandled error during test:', error);
});