/**
 * Test script for the AutoXing robot return-to-charger functionality
 * This tests the charger-actions module with the correct charger coordinates
 */
const axios = require('axios');

// Robot and charger configuration
const ROBOT_ID = 'L382502104987ir';
const CHARGER_POINT = {
  x: 10.5,
  y: 5.2,
  orientation: 0
};

async function testReturnToCharger() {
  try {
    console.log(`Testing return to charger for robot ${ROBOT_ID}...`);
    
    // Use our API endpoint to send the robot to the charger
    const response = await axios.post('http://localhost:5000/api/robot/charger/return', {
      robotId: ROBOT_ID,
      chargerPoint: CHARGER_POINT
    });
    
    console.log('Return to charger initiated:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // The robot is now moving to the charger in the background
    // You can monitor its progress through the battery updates in the logs
    console.log('\nTask started! The robot should now be moving to the charger point.');
    console.log('You can check the task progress in the application logs.');
    console.log('Once the robot reaches the charger, it will attempt to dock and begin charging.');
    console.log('Battery status updates will show the charging state once docked.');
    
    return response.data;
  } catch (error) {
    console.error('Error sending robot to charger:', error.message);
    if (error.response && error.response.data) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Execute the test
testReturnToCharger()
  .then(result => {
    console.log('Test completed.');
  })
  .catch(error => {
    console.error('Test failed:', error);
  });