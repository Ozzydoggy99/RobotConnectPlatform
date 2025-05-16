/**
 * Test script for executing a task with the AutoXing robot
 * This script tests the task execution endpoint to verify it works
 */

import axios from 'axios';
const API_URL = 'http://localhost:5000';

async function testExecuteTask() {
  try {
    console.log('Testing task execution functionality...');
    
    // 1. Get all tasks to find a pending task
    console.log('Fetching available tasks...');
    const tasksResponse = await axios.get(`${API_URL}/api/tasks`);
    const tasks = tasksResponse.data;
    
    if (!tasks || tasks.length === 0) {
      console.log('No tasks found. Creating a new dropoff task first...');
      
      // Create a task if none exist
      const robotId = 'L382502104987ir';
      const createResponse = await axios.post(`${API_URL}/api/robot/${robotId}/tasks/dropoff`, {
        dropoffPointId: '001_load',
        shelfPointId: '115_load',
        priority: 'high'
      });
      
      console.log('Created new task:', createResponse.data);
      var taskToExecute = createResponse.data;
    } else {
      console.log(`Found ${tasks.length} tasks`);
      // Use the first pending task
      var taskToExecute = tasks.find(task => task.status === 'pending') || tasks[0];
    }
    
    console.log(`Will execute task: ${taskToExecute.taskId} (${taskToExecute.status})`);
    
    // 2. Execute the task
    console.log(`Executing task ${taskToExecute.taskId}...`);
    const executeResponse = await axios.post(
      `${API_URL}/api/robot/${taskToExecute.robotId}/tasks/${taskToExecute.taskId}/execute`
    );
    
    console.log('Task execution response:', executeResponse.data);
    
    // 3. Check the updated task status
    console.log(`Checking task ${taskToExecute.taskId} status after execution...`);
    const updatedTaskResponse = await axios.get(
      `${API_URL}/api/robot/${taskToExecute.robotId}/tasks/${taskToExecute.taskId}`
    );
    
    console.log('Updated task details:', updatedTaskResponse.data);
    
    console.log('Task execution test completed.');
  } catch (error) {
    console.error('Error testing task execution:', error.response ? error.response.data : error.message);
  }
}

// Run the test
testExecuteTask()
  .catch(error => console.error('Unhandled error:', error));