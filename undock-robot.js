/**
 * Script to undock the AutoXing robot from the charging station
 * Uses the Move API to create a movement command that disconnects the robot from charger
 */
import axios from 'axios';

const ROBOT_IP = '47.180.91.99';
const ROBOT_PORT = 8090;

// Get robot's current pose to calculate a safe undock position
async function getRobotPose() {
  try {
    const response = await axios.get(`http://${ROBOT_IP}:${ROBOT_PORT}/application/state/map/pose`);
    return response.data;
  } catch (error) {
    console.error('Error getting robot pose:', error.message);
    return null;
  }
}

// Move robot away from charger (undocking)
async function undockRobot() {
  try {
    // First get the robot's current position
    const pose = await getRobotPose();
    if (!pose) {
      throw new Error('Could not get robot pose');
    }
    console.log('Current robot pose:', pose);
    
    // Calculate a position 1 meter away from current position
    // This will make the robot move forward away from the charger
    const moveX = pose.x + Math.cos(pose.theta) * 1.0;
    const moveY = pose.y + Math.sin(pose.theta) * 1.0;
    
    // Create a standard move command to leave the charger
    console.log(`Moving robot to position (${moveX}, ${moveY}) to undock from charger`);
    const movePayload = {
      creator: "fleet_manager",
      type: "standard",
      target_x: moveX, 
      target_y: moveY,
      target_ori: pose.theta  // maintain same orientation
    };
    
    // Send the move command that will undock the robot
    const response = await axios.post(
      `http://${ROBOT_IP}:${ROBOT_PORT}/chassis/moves`, 
      movePayload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    console.log('Undock command response:', response.status, response.data);
    console.log('Move action ID:', response.data.id);
    console.log('Waiting 5 seconds to check movement status...');
    
    // Wait a few seconds to check the move status
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check the status of the move action
    try {
      const statusResponse = await axios.get(`http://${ROBOT_IP}:${ROBOT_PORT}/chassis/moves/${response.data.id}`);
      console.log('Move action status:', statusResponse.data.state);
      console.log('Undock operation completed');
    } catch (statusError) {
      console.error('Error checking move status:', statusError.message);
    }
  } catch (error) {
    console.error('Error undocking robot:', error.message);
  }
}

// Run the undock command
undockRobot();