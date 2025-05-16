/**
 * Test script for AutoXing robot Task API
 * Tests the task creation/management endpoints based on documentation
 */
import axios from 'axios';

const ROBOT_SN = 'L382502104987ir';
const PUBLIC_IP = '47.180.91.99';
const PORT = 8090;
const APPCODE = '667a51a4d948433081a272c78d10a8a4';

async function testTaskApi() {
  try {
    console.log(`Testing Task API for robot ${ROBOT_SN} at ${PUBLIC_IP}:${PORT}`);
    
    // Configure axios with authentication header
    const axiosInstance = axios.create({
      baseURL: `http://${PUBLIC_IP}:${PORT}`,
      headers: {
        'APPCODE': `APPCODE ${APPCODE}`
      },
      timeout: 10000
    });
    
    // 1. First test - get current map to ensure we have a valid map ID
    console.log('\nGetting current map to prepare for task creation...');
    const mapResponse = await axiosInstance.get('/chassis/current-map');
    console.log('Current map:', mapResponse.data);
    
    // Store map ID for task creation
    const mapId = mapResponse.data.id;
    
    // 2. Try to get current task (if any)
    console.log('\nChecking if the robot is currently executing a task...');
    try {
      // Try a few possible endpoints based on documentation
      const taskEndpoints = [
        '/tasks/current', 
        '/v1/tasks/current',
        '/v3/tasks/current',
        '/task/current'
      ];
      
      let currentTaskResponse = null;
      for (const endpoint of taskEndpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          currentTaskResponse = await axiosInstance.get(endpoint);
          console.log(`Success with endpoint: ${endpoint}`);
          break;
        } catch (error) {
          console.log(`Endpoint ${endpoint} failed with status: ${error.response?.status}`);
        }
      }
      
      if (currentTaskResponse) {
        console.log('Current task:', currentTaskResponse.data);
      } else {
        console.log('Could not find a working task endpoint. Will continue with testing task creation.');
      }
    } catch (error) {
      console.log('No current task or endpoint not found:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
      }
    }
    
    // 3. Create a simple test task (just a return to charging station)
    console.log('\nCreating a simple test task (return to charging station)...');
    
    // Prepare test task data - minimal task that returns to charging station
    const testTask = {
      name: `Test Return Task ${new Date().toISOString()}`,
      robotId: ROBOT_SN,
      routeMode: 1,
      runMode: 1,
      runNum: 1,
      taskType: 1, // Return to charging station type
      pts: [],
      // Assuming a charging point at map center (we'll use this for testing)
      backPt: {
        type: 9, // 9 = charging station
        x: 0,
        y: 0,
        yaw: 0,
        areaId: mapId.toString(),
        ext: {
          name: "Charging Station"
        }
      }
    };
    
    // Try a few possible task creation endpoints
    const taskCreationEndpoints = [
      '/tasks',
      '/v1/tasks',
      '/v3/tasks',
      '/task/create'
    ];
    
    let taskId = null;
    let successEndpoint = null;
    for (const endpoint of taskCreationEndpoints) {
      try {
        console.log(`Trying to create task at endpoint: ${endpoint}`);
        const createResponse = await axiosInstance.post(endpoint, testTask);
        successEndpoint = endpoint;
        taskId = createResponse.data;
        console.log(`Task created successfully at ${endpoint}. Task ID:`, taskId);
        break;
      } catch (error) {
        console.log(`Task creation failed at ${endpoint}:`, error.message);
        if (error.response) {
          console.log('Status:', error.response.status);
          console.log('Response data:', error.response.data);
        }
      }
    }
    
    // 4. If task was created, test getting task details
    if (taskId) {
      console.log(`\nGetting details for task ID: ${taskId}`);
      try {
        const detailsResponse = await axiosInstance.get(`${successEndpoint}/${taskId}`);
        console.log('Task details:', detailsResponse.data);
        
        // 5. Test starting the task
        console.log(`\nStarting task ID: ${taskId}`);
        try {
          const startResponse = await axiosInstance.post(`${successEndpoint}/${taskId}/start`);
          console.log('Task started:', startResponse.data);
          
          // Give the task a moment to start
          console.log('\nWaiting 5 seconds for task to start executing...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // 6. Test canceling the task
          console.log(`\nCanceling task ID: ${taskId}`);
          try {
            const cancelResponse = await axiosInstance.post(`${successEndpoint}/${taskId}/cancel`);
            console.log('Task canceled:', cancelResponse.data);
          } catch (error) {
            console.log('Task cancellation failed:', error.message);
            if (error.response) {
              console.log('Status:', error.response.status);
              console.log('Response data:', error.response.data);
            }
          }
        } catch (error) {
          console.log('Task start failed:', error.message);
          if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response data:', error.response.data);
          }
        }
      } catch (error) {
        console.log('Getting task details failed:', error.message);
        if (error.response) {
          console.log('Status:', error.response.status);
          console.log('Response data:', error.response.data);
        }
      }
    }
    
    console.log('\nTask API testing completed');
    return true;
  } catch (error) {
    console.error('\nTask API test error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Run the test
testTaskApi()
  .then(success => {
    console.log(`\nTest result: ${success ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });