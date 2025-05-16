/**
 * Test script for AutoXing robot API using port 8090
 * This more closely follows the official documentation
 */
import axios from 'axios';

const ROBOT_SN = 'L382502104987ir';
const PUBLIC_IP = '47.180.91.99';
const PORT = 8090;
const APPCODE = '667a51a4d948433081a272c78d10a8a4';

async function testRobotAPI() {
  try {
    console.log(`Testing connection to robot ${ROBOT_SN} at ${PUBLIC_IP}:${PORT}`);
    
    // Test chassis state endpoint as listed in the Django URL patterns
    console.log('\nTesting chassis state endpoint...');
    const stateResponse = await axios.get(`http://${PUBLIC_IP}:${PORT}/chassis/state`, {
      headers: {
        'APPCODE': `APPCODE ${APPCODE}`
      }
    });
    console.log('Chassis state response:', stateResponse.data);
    
    console.log('\nAPI tests completed successfully');
    return true;
  } catch (error) {
    console.error('\nAPI test error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Run the test
testRobotAPI()
  .then(success => {
    console.log(`\nTest result: ${success ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });