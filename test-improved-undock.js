/**
 * Test script for the improved undocking functionality
 * This script tests the newly implemented undockFromCharger function that uses
 * the robot's current position and a move command to undock from charging station
 */
import { undockFromCharger } from './server/robot/charger-actions.js';

// Robot ID for testing
const robotId = 'L382502104987ir';

/**
 * Test the improved undock functionality
 */
async function testImprovedUndock() {
  try {
    console.log(`Testing improved undock for robot ${robotId}...`);
    
    // Execute the undock command
    const result = await undockFromCharger(robotId);
    
    // Log the result
    console.log('Undock result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Undock command successful!');
      
      // Wait to see if robot starts moving
      console.log('Waiting 5 seconds to confirm movement...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('Test complete. Check robot is moving away from charging station.');
    } else {
      console.log('❌ Undock command failed:', result.message);
    }
  } catch (error) {
    console.error('Error testing undock:', error.message);
  }
}

// Execute the test
testImprovedUndock();