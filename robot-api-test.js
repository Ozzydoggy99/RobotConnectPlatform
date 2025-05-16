/**
 * Test script for AutoXing robot API using the correct endpoints
 * Based on the actual URL patterns from the Django application
 */
import axios from 'axios';

const ROBOT_SN = 'L382502104987ir';
const PUBLIC_IP = '47.180.91.99';
const PORT = 8090;
const APPCODE = '667a51a4d948433081a272c78d10a8a4';

async function testRobotAPI() {
  try {
    console.log(`Testing connection to robot ${ROBOT_SN} at ${PUBLIC_IP}:${PORT}`);
    
    // Test the base chassis endpoint
    console.log('\nTesting base chassis endpoint...');
    const chassisResponse = await axios.get(`http://${PUBLIC_IP}:${PORT}/chassis/`, {
      headers: {
        'APPCODE': `APPCODE ${APPCODE}`
      }
    });
    console.log('Chassis response:', chassisResponse.data);
    
    // Test move actions list endpoint
    console.log('\nTesting move actions endpoint...');
    const movesResponse = await axios.get(`http://${PUBLIC_IP}:${PORT}/chassis/moves`, {
      headers: {
        'APPCODE': `APPCODE ${APPCODE}`
      }
    });
    console.log('Moves response:', movesResponse.data);
    
    // Test current map endpoint based on documentation
    console.log('\nTesting current map endpoint...');
    const mapResponse = await axios.get(`http://${PUBLIC_IP}:${PORT}/chassis/current-map`, {
      headers: {
        'APPCODE': `APPCODE ${APPCODE}`
      }
    });
    console.log('Current map response:', mapResponse.data);
    
    console.log('\nAPI tests completed successfully');
    return true;
  } catch (error) {
    console.error('\nAPI test error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      
      // Check if there's more detailed info about available endpoints
      if (error.response.data && typeof error.response.data === 'string' && 
          error.response.data.includes('Django tried these URL patterns')) {
        console.log('\nAvailable URL patterns:');
        const matches = error.response.data.match(/chassis\/[^<>\s]+/g);
        if (matches) {
          console.log(matches);
        }
      }
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