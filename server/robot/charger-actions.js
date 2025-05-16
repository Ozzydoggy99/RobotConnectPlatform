/**
 * AutoXing Robot Charger Actions
 * 
 * This module implements specialized commands for charging operations
 * using AutoXing Robot SDK's move actions API with the specific 'charge' type
 * that enables precision docking with charging stations.
 */

import { getRobotApiClient, robotTaskStatuses } from './direct-api.js';
import axios from 'axios';

/**
 * Command robot to return to charger and begin charging
 * @param {string} robotId - Robot identifier
 * @param {Object} chargerPoint - Charger point coordinates {x, y, orientation}
 * @param {Object} options - Additional options for charging
 * @returns {Promise<Object>} - Result of the charging operation
 */
async function returnToCharger(robotId, chargerPoint, options = {}) {
  const robot = getRobotApiClient(robotId);
  if (!robot) {
    return {
      success: false,
      message: `Robot ${robotId} not found or not configured`,
    };
  }
  
  try {
    console.log(`Robot ${robotId} returning to charger at x:${chargerPoint.x}, y:${chargerPoint.y}`);
    
    // Create move action with charge type for precise docking
    const chargeActionData = {
      creator: 'fleet-management-system',
      type: 'charge', // Special type for charging stations
      target_x: chargerPoint.x,
      target_y: chargerPoint.y,
      target_ori: chargerPoint.orientation || 0,
      // Higher accuracy for docking
      accuracy: options.accuracy || 0.05
    };
    
    // Send charge command
    const chargeResponse = await robot.moveApi.post('/chassis/moves', chargeActionData);
    const chargeActionId = chargeResponse.data.id;
    console.log(`Robot ${robotId} moving to charger - action ID: ${chargeActionId}`);
    
    // Wait for movement to complete
    const chargeResult = await waitForChargeComplete(robot, chargeActionId, options.timeoutMs);
    
    // Verify charging state
    if (chargeResult.state === 'succeeded') {
      // Monitor battery state to confirm charging
      const isCharging = await monitorChargingState(robot, options.monitorTimeoutMs || 60000);
      
      if (isCharging) {
        return {
          success: true,
          message: 'Robot successfully docked and charging',
          actionId: chargeActionId,
          state: 'charging'
        };
      } else {
        return {
          success: false,
          message: 'Robot reached charger but failed to start charging',
          actionId: chargeActionId,
          state: 'docked_not_charging'
        };
      }
    } else {
      return {
        success: false,
        message: `Failed to reach charger: ${chargeResult.fail_reason_str || 'Unknown error'}`,
        actionId: chargeActionId,
        state: chargeResult.state
      };
    }
  } catch (error) {
    console.error(`Error during charger operation for robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Charging operation failed: ${error.message}`,
      error: error
    };
  }
}

/**
 * Wait for a charge action to complete (success, failure, or cancellation)
 * @param {Object} robot - Robot API client
 * @param {number} actionId - ID of the move action to wait for
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} - Final state of the move action
 */
async function waitForChargeComplete(robot, actionId, timeoutMs = 300000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    // Get action status
    const response = await robot.moveApi.get(`/chassis/moves/${actionId}`);
    const action = response.data;
    
    // Check if the action has completed
    if (['succeeded', 'failed', 'cancelled'].includes(action.state)) {
      return action;
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error(`Timeout waiting for charge action ${actionId} to complete`);
}

/**
 * Monitor battery state to confirm robot is charging
 * @param {Object} robot - Robot API client
 * @param {number} timeoutMs - Timeout in milliseconds to wait for charging to begin
 * @returns {Promise<boolean>} - Whether robot is charging
 */
async function monitorChargingState(robot, timeoutMs = 60000) {
  return new Promise((resolve) => {
    let resolved = false;
    const startTime = Date.now();
    let timeout;
    
    // Function to check battery state periodically
    const checkBatteryStatus = async () => {
      try {
        if (Date.now() - startTime > timeoutMs || resolved) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(false); // Timed out without charging
          }
          return;
        }
        
        // Get battery state from WebSocket or battery status API
        const batteryState = robot.getBatteryState();
        
        // Check if the robot is charging
        if (batteryState && batteryState.power_supply_status === 'charging') {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve(true); // Robot is charging
          }
          return;
        }
        
        // Continue checking
        timeout = setTimeout(checkBatteryStatus, 2000);
      } catch (error) {
        console.error("Error checking battery status:", error);
        timeout = setTimeout(checkBatteryStatus, 2000);
      }
    };
    
    // Start checking
    checkBatteryStatus();
    
    // Set overall timeout
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false); // Timed out without charging
      }
    }, timeoutMs);
  });
}

/**
 * Get robot's charging status
 * @param {string} robotId - Robot identifier
 * @returns {Promise<Object>} - Charging status information
 */
async function getChargingStatus(robotId) {
  const robot = getRobotApiClient(robotId);
  if (!robot) {
    return {
      success: false,
      message: `Robot ${robotId} not found or not configured`,
    };
  }
  
  try {
    // Get battery state
    const batteryState = robot.getBatteryState();
    
    return {
      success: true,
      batteryLevel: batteryState.percentage * 100,
      isCharging: batteryState.power_supply_status === 'charging',
      remainingCapacity: batteryState.remaining_capacity,
      voltage: batteryState.voltage,
      current: batteryState.current
    };
  } catch (error) {
    console.error(`Error getting charging status for robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Failed to get charging status: ${error.message}`,
      error: error
    };
  }
}

/**
 * Execute a complete return-to-charger workflow
 * @param {string} robotId - Robot identifier
 * @param {Object} chargerPoint - Charger point coordinates
 * @returns {Promise<Object>} - Returns the execution result
 */
async function executeChargerWorkflow(robotId, chargerPoint) {
  try {
    console.log(`Starting return-to-charger workflow for robot ${robotId}`);
    
    // Return to charger
    const chargerResult = await returnToCharger(robotId, chargerPoint);
    
    return {
      success: chargerResult.success,
      workflowId: `charge-${Date.now()}`,
      message: chargerResult.success ? 
        'Return to charger completed successfully' : 
        `Return to charger failed: ${chargerResult.message}`,
      steps: {
        returnToCharger: chargerResult
      }
    };
  } catch (error) {
    console.error(`Error executing return-to-charger workflow for robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Return to charger workflow failed: ${error.message}`,
      error: error
    };
  }
}

/**
 * Undock the robot from the charging station
 * This is required before the robot can move when it's currently docked
 * Uses a standard move command to move the robot away from the charging station
 * @param {string} robotId - Robot identifier
 * @returns {Promise<Object>} - Result of the undock operation
 */
async function undockFromCharger(robotId) {
  const robot = getRobotApiClient(robotId);
  if (!robot) {
    return {
      success: false,
      message: `Robot ${robotId} not found or not configured`,
    };
  }
  
  try {
    console.log(`Undocking robot ${robotId} from charger using move command`);
    
    // Check if robot is actually charging
    // Since direct access to WebSocket data isn't available via the API client,
    // let's use global storage from direct-api.js
    const statusInfo = robotTaskStatuses.get(robotId);
    const batteryState = statusInfo && statusInfo.batteryStatus;
    const isCharging = batteryState && batteryState.power_supply_status === 'charging';
    
    if (!isCharging) {
      console.log(`Robot ${robotId} is not currently charging, no need to undock`);
      return {
        success: true,
        message: 'Robot is not charging, no undock needed'
      };
    }
    
    // Get current position from the stored tracking data
    let poseData = statusInfo && statusInfo.poseStatus;
    
    // If we can't get position data from WebSocket, try direct API calls
    if (!poseData || !poseData.position) {
      try {
        // Try to get current pose from API instead
        console.log(`WebSocket position data not available, using API call for robot ${robotId}`);
        const poseResponse = await robot.getCurrentPose();
        if (poseResponse && poseResponse.pos) {
          poseData = {
            position: poseResponse.pos,
            orientation: poseResponse.ori || 0
          };
        } else {
          console.error(`Cannot get robot ${robotId} position for undocking`);
          return {
            success: false,
            message: 'Failed to get robot position for undocking'
          };
        }
      } catch (poseError) {
        console.error(`Error getting robot ${robotId} position:`, poseError.message);
        return {
          success: false,
          message: 'Failed to get robot position for undocking'
        };
      }
    }
    
    // Current position and orientation
    // WebSocket data structure is different from API response
    // Handle both cases
    let currentX, currentY, currentOrientation;
    
    if (Array.isArray(poseData.position)) {
      // WebSocket data format
      [currentX, currentY] = poseData.position;
      currentOrientation = poseData.orientation || 0;
    } else {
      // Direct API response format
      currentX = poseData.position.x || 0;
      currentY = poseData.position.y || 0;
      currentOrientation = poseData.orientation || poseData.theta || 0;
    }
    
    console.log(`Robot ${robotId} current position: (${currentX}, ${currentY}), orientation: ${currentOrientation}`);
    
    // Calculate a position 1 meter away in the direction the robot is facing
    // This creates a "move forward" command to leave the charger
    const moveX = currentX + Math.cos(currentOrientation) * 1.0;
    const moveY = currentY + Math.sin(currentOrientation) * 1.0;
    
    console.log(`Creating move command to position (${moveX}, ${moveY}) to undock robot ${robotId}`);
    
    // Use the dedicated service endpoint for undocking as documented in the API
    console.log(`Using the direct undock service endpoint for robot ${robotId}`);
    const undockResponse = await robot.moveApi.post('/services/undock');
    console.log(`Undock service response:`, JSON.stringify(undockResponse.data));
    
    // Wait a moment for the undock operation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return successful result with action ID
    return {
      success: true,
      message: "Undock command sent successfully",
      actionId: undockResponse.data.id || null
    };
    
    // Send the move command using the robot API client
    console.log(`Creating move action for robot ${robotId} to position (${moveX}, ${moveY})`);
    console.log(`Sending move command to /chassis/moves: ${JSON.stringify(moveData)}`);
    
    const moveResponse = await robot.moveApi.post('/chassis/moves', moveData);
    const actionId = moveResponse.data.id;
    
    console.log(`Move response: ${JSON.stringify(moveResponse.data)}`);
    console.log(`Move action created successfully with ID: ${actionId}`);
    console.log(`Move command sent for robot ${robotId}, action ID: ${actionId}`);
    
    // Wait a moment for the move to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      success: true,
      message: 'Undock move command sent successfully',
      actionId: actionId
    };
  } catch (error) {
    console.error(`Error undocking robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Undock operation failed: ${error.message}`,
      error: error
    };
  }
}

// Export functions for use in other modules
export {
  returnToCharger,
  getChargingStatus,
  executeChargerWorkflow,
  undockFromCharger
};