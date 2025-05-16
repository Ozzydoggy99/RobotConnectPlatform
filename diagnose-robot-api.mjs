/**
 * AutoXing Robot API Diagnostic Tool
 * For troubleshooting robot connectivity issues with detailed error reporting
 */
import axios from 'axios';

const ROBOT_SN = 'L382502104987ir';
const PUBLIC_IP = '47.180.91.99';
const PORT = 8080;
const APPCODE = '667a51a4d948433081a272c78d10a8a4';

async function testEndpoint(url, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url,
      headers: {
        'APPCODE': `APPCODE ${APPCODE}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      validateStatus: () => true, // Accept all status codes for diagnostic purposes
    };
    
    if (data) {
      config.data = data;
    }
    
    console.log(`Testing ${method} ${url}...`);
    const response = await axios(config);
    
    console.log(`Status code: ${response.status}`);
    console.log(`Status text: ${response.statusText}`);
    console.log(`Headers: ${JSON.stringify(response.headers, null, 2)}`);
    console.log(`Response data: ${JSON.stringify(response.data, null, 2)}`);
    
    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error(`Request error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runDiagnostics() {
  console.log('==========================================================');
  console.log(`AUTOXING ROBOT API DIAGNOSTICS - SN: ${ROBOT_SN}`);
  console.log('==========================================================\n');
  
  // 1. Test basic connectivity (no sn parameter)
  console.log('\n[TEST 1] Basic connectivity:');
  await testEndpoint(`http://${PUBLIC_IP}:${PORT}/`);
  
  // 2. Test chassis/state with SN in query parameter
  console.log('\n[TEST 2] Chassis state with SN in query parameter:');
  await testEndpoint(`http://${PUBLIC_IP}:${PORT}/chassis/state?sn=${ROBOT_SN}`);
  
  // 3. Test chassis/state with SN in path parameter
  console.log('\n[TEST 3] Chassis state with SN in path parameter:');
  await testEndpoint(`http://${PUBLIC_IP}:${PORT}/chassis/${ROBOT_SN}/state`);
  
  // 4. Test chassis/state with SN in header
  console.log('\n[TEST 4] Chassis state with SN in header:');
  const config = {
    method: 'GET',
    url: `http://${PUBLIC_IP}:${PORT}/chassis/state`,
    headers: {
      'APPCODE': `APPCODE ${APPCODE}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'SN': ROBOT_SN
    },
    validateStatus: () => true,
  };
  
  try {
    console.log(`Testing GET ${config.url} with SN in header...`);
    const response = await axios(config);
    console.log(`Status code: ${response.status}`);
    console.log(`Status text: ${response.statusText}`);
    console.log(`Response data: ${JSON.stringify(response.data, null, 2)}`);
  } catch (error) {
    console.error(`Request error: ${error.message}`);
  }
  
  // 5. Test version endpoint (often available without authentication)
  console.log('\n[TEST 5] Version endpoint:');
  await testEndpoint(`http://${PUBLIC_IP}:${PORT}/version`);
  
  console.log('\n==========================================================');
  console.log('DIAGNOSTICS COMPLETED');
  console.log('==========================================================');
}

// Run the diagnostics
runDiagnostics()
  .then(() => {
    console.log('\nDiagnostics finished.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error during diagnostics:', error);
    process.exit(1);
  });