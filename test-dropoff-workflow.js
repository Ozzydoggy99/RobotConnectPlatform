/**
 * Test script for the dropoff workflow
 * This script tests creating and executing a dropoff task
 */
import axios from 'axios';

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const ROBOT_ID = 'L382502104987ir';
const DROPOFF_POINT_ID = '001_load';  // Dropoff point ID (001-049 range)
const SHELF_POINT_ID = '115_load';    // Shelf point ID 

async function testDropoffWorkflow() {
  try {
    console.log('Starting dropoff workflow test...');
    console.log(`Robot ID: ${ROBOT_ID}`);
    console.log(`Dropoff Point: ${DROPOFF_POINT_ID}`);
    console.log(`Shelf Point: ${SHELF_POINT_ID}`);
    console.log('----------------------------------------');

    // Step 1: Get the available points to confirm our point IDs
    console.log('Step 1: Getting filtered points...');
    const pointsResponse = await axios.get(`${API_BASE_URL}/robot/${ROBOT_ID}/points`);
    const points = pointsResponse.data;
    
    console.log(`Found ${points.dropoff.length} dropoff points`);
    console.log(`Found ${points.shelf.length} shelf points`);
    console.log(`Found ${points.charger.length} charger points`);
    
    // Log each dropoff point for debugging
    console.log('\nDropoff Points:');
    points.dropoff.forEach(point => {
      console.log(`ID: ${point.poiId}, Name: ${point.name}, Type: ${point.type}`);
    });
    
    // Log each shelf point for debugging
    console.log('\nShelf Points:');
    points.shelf.forEach(point => {
      console.log(`ID: ${point.poiId}, Name: ${point.name}, Type: ${point.type}`);
    });
    
    // Log each charger point for debugging
    console.log('\nCharger Points:');
    points.charger.forEach(point => {
      console.log(`ID: ${point.poiId}, Name: ${point.name}, Type: ${point.type}`);
    });
    
    // Step 2: Create a dropoff task
    console.log('\nStep 2: Creating dropoff task...');
    const createTaskResponse = await axios.post(`${API_BASE_URL}/robot/${ROBOT_ID}/tasks/dropoff`, {
      dropoffPointId: DROPOFF_POINT_ID,
      shelfPointId: SHELF_POINT_ID,
      priority: 'normal'
    });
    
    const task = createTaskResponse.data;
    console.log(`Created task with ID: ${task.taskId}`);
    console.log(`Task name: ${task.name}`);
    console.log(`Task status: ${task.status}`);
    console.log(`Task current step: ${task.currentStep}`);
    
    // Step 3: Execute the first step of the task
    console.log('\nStep 3: Executing task step...');
    const executeResponse = await axios.post(`${API_BASE_URL}/robot/${ROBOT_ID}/tasks/${task.taskId}/execute`);
    const updatedTask = executeResponse.data;
    
    console.log(`Task status: ${updatedTask.status}`);
    console.log(`Task current step: ${updatedTask.currentStep}`);
    
    // Step 4: Get task details to verify state
    console.log('\nStep 4: Getting task details...');
    const taskDetailsResponse = await axios.get(`${API_BASE_URL}/robot/${ROBOT_ID}/tasks/${task.taskId}`);
    const taskDetails = taskDetailsResponse.data;
    
    console.log('Task details:');
    console.log(JSON.stringify(taskDetails, null, 2));
    
    console.log('----------------------------------------');
    console.log('Dropoff workflow test completed successfully');
    
  } catch (error) {
    console.error('Error testing dropoff workflow:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(error.response.data);
      console.error(`Status: ${error.response.status}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testDropoffWorkflow().catch(console.error);

// Export for module compatibility
export { testDropoffWorkflow };