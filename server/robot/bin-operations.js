/**
 * AutoXing Robot Bin Operations
 * 
 * This module implements specialized commands for bin operations using
 * AutoXing Robot SDK's move actions API and specialized jack commands.
 * 
 * Based on AutoXing API documentation, these operations include:
 * - align_with_rack: Commands robot to position under a rack/bin
 * - /services/jack_up: Raises lifting mechanism to pick up a bin
 * - to_unload_point: Moves robot to specific unload location
 * - /services/jack_down: Lowers mechanism to release bin
 */

import axios from 'axios';
import { getRobotApiClient } from './direct-api.js';

/**
 * Move to position and pick up a bin using rack operations
 * @param {string} robotId - Robot identifier
 * @param {Object} point - Coordinate where the bin is located {x, y, orientation}
 * @param {string|null} rackAreaId - Optional rack area ID if using area-based operations
 * @returns {Promise<Object>} - Result of the pickup operation
 */
async function pickupBin(robotId, point, rackAreaId = null) {
  const robot = getRobotApiClient(robotId);
  if (!robot) {
    return {
      success: false,
      message: `Robot ${robotId} not found or not configured`,
    };
  }
  
  try {
    console.log(`Robot ${robotId} attempting to pick up bin at x:${point.x}, y:${point.y}`);
    
    // Step 1: Create move action to align with rack/bin
    const alignActionData = {
      creator: 'fleet-management-system',
      type: 'align_with_rack',
      target_x: point.x,
      target_y: point.y,
      target_ori: point.orientation || 0
    };
    
    // If using area-based operations, add the rack area ID
    if (rackAreaId) {
      alignActionData.rack_area_id = rackAreaId;
    }
    
    // Send align command
    const alignResponse = await robot.moveApi.post('/chassis/moves', alignActionData);
    const alignActionId = alignResponse.data.id;
    console.log(`Robot ${robotId} aligning with bin - action ID: ${alignActionId}`);
    
    // Step 2: Wait for alignment to complete
    const alignResult = await waitForMoveActionComplete(robot, alignActionId);
    if (alignResult.state !== 'succeeded') {
      throw new Error(`Bin alignment failed: ${alignResult.fail_reason_str}`);
    }
    
    // Step 3: Send jack up command to lift the bin
    console.log(`Robot ${robotId} lifting bin`);
    const jackUpResponse = await robot.moveApi.post('/services/jack_up');
    
    // Step 4: Wait to confirm bin is lifted
    // The robot will automatically update its footprint through the /robot_model WebSocket topic
    // Waiting a few seconds to ensure the jack completes its operation
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return {
      success: true,
      message: 'Bin pickup completed',
      actionId: alignActionId
    };
  } catch (error) {
    console.error(`Error during bin pickup operation for robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Bin pickup failed: ${error.message}`,
      error: error
    };
  }
}

/**
 * Move to position and drop off a bin
 * @param {string} robotId - Robot identifier
 * @param {Object} point - Coordinate where the bin should be placed {x, y, orientation}
 * @param {string|null} rackAreaId - Optional rack area ID if using area-based operations
 * @returns {Promise<Object>} - Result of the dropoff operation
 */
async function dropoffBin(robotId, point, rackAreaId = null) {
  const robot = getRobotApiClient(robotId);
  if (!robot) {
    return {
      success: false,
      message: `Robot ${robotId} not found or not configured`,
    };
  }
  
  try {
    console.log(`Robot ${robotId} attempting to drop off bin at x:${point.x}, y:${point.y}`);
    
    // Step 1: Create move action to unload point
    const unloadActionData = {
      creator: 'fleet-management-system',
      type: 'to_unload_point',
      target_x: point.x,
      target_y: point.y,
      target_ori: point.orientation || 0
    };
    
    // If using area-based operations, add the rack area ID
    if (rackAreaId) {
      unloadActionData.rack_area_id = rackAreaId;
    }
    
    // Send unload command
    const unloadResponse = await robot.moveApi.post('/chassis/moves', unloadActionData);
    const unloadActionId = unloadResponse.data.id;
    console.log(`Robot ${robotId} moving to unload point - action ID: ${unloadActionId}`);
    
    // Step 2: Wait for unload movement to complete
    const unloadResult = await waitForMoveActionComplete(robot, unloadActionId);
    if (unloadResult.state !== 'succeeded') {
      throw new Error(`Move to unload point failed: ${unloadResult.fail_reason_str}`);
    }
    
    // Step 3: Send jack down command to lower the bin
    console.log(`Robot ${robotId} lowering bin`);
    const jackDownResponse = await robot.moveApi.post('/services/jack_down');
    
    // Step 4: Wait to confirm bin is lowered
    // The robot will automatically update its footprint through the /robot_model WebSocket topic
    // Waiting a few seconds to ensure the jack completes its operation
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return {
      success: true,
      message: 'Bin dropoff completed',
      actionId: unloadActionId
    };
  } catch (error) {
    console.error(`Error during bin dropoff operation for robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Bin dropoff failed: ${error.message}`,
      error: error
    };
  }
}

/**
 * Move to a standard position (like charger or wait position)
 * @param {string} robotId - Robot identifier
 * @param {Object} point - Coordinate to move to {x, y, orientation}
 * @param {boolean} isChargePoint - Whether this is a charging point
 * @returns {Promise<Object>} - Result of the move operation
 */
async function moveToPoint(robotId, point, isChargePoint = false) {
  const robot = getRobotApiClient(robotId);
  if (!robot) {
    return {
      success: false,
      message: `Robot ${robotId} not found or not configured`,
    };
  }
  
  try {
    console.log(`Robot ${robotId} moving to point x:${point.x}, y:${point.y}`);
    
    // Create move action with appropriate type
    const moveActionData = {
      creator: 'fleet-management-system',
      type: isChargePoint ? 'charge' : 'standard',
      target_x: point.x,
      target_y: point.y,
      target_ori: point.orientation || 0
    };
    
    // Send move command
    const moveResponse = await robot.moveApi.post('/chassis/moves', moveActionData);
    const moveActionId = moveResponse.data.id;
    console.log(`Robot ${robotId} moving to point - action ID: ${moveActionId}`);
    
    // Wait for movement to complete
    const moveResult = await waitForMoveActionComplete(robot, moveActionId);
    
    return {
      success: moveResult.state === 'succeeded',
      message: moveResult.state === 'succeeded' ? 
        'Move completed successfully' : 
        `Move failed: ${moveResult.fail_reason_str}`,
      actionId: moveActionId,
      state: moveResult.state
    };
  } catch (error) {
    console.error(`Error during move operation for robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Move failed: ${error.message}`,
      error: error
    };
  }
}

/**
 * Wait for a move action to complete (success, failure, or cancellation)
 * @param {Object} robot - Robot API client
 * @param {number} actionId - ID of the move action to wait for
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} - Final state of the move action
 */
async function waitForMoveActionComplete(robot, actionId, timeoutMs = 300000) {
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
  
  throw new Error(`Timeout waiting for move action ${actionId} to complete`);
}

/**
 * Execute a complete dropoff workflow task
 * @param {string} robotId - Robot identifier
 * @param {Object} dropoffPoint - Dropoff point coordinates
 * @param {Object} shelfPoint - Shelf point coordinates
 * @param {Object} returnPoint - Return point coordinates
 * @returns {Promise<Object>} - Returns the execution result
 */
async function executeDropoffWorkflow(robotId, dropoffPoint, shelfPoint, returnPoint) {
  try {
    const workflowId = `dropoff-${Date.now()}`;
    console.log(`Starting dropoff workflow ${workflowId} for robot ${robotId}`);
    
    // Step 1: Move to dropoff point to pick up bin
    const pickupResult = await pickupBin(robotId, dropoffPoint);
    if (!pickupResult.success) {
      return {
        success: false,
        workflowId,
        step: 'pickup_at_dropoff',
        message: pickupResult.message
      };
    }
    
    // Step 2: Move to shelf point and drop off bin
    const dropoffResult = await dropoffBin(robotId, shelfPoint);
    if (!dropoffResult.success) {
      return {
        success: false,
        workflowId,
        step: 'dropoff_at_shelf',
        message: dropoffResult.message
      };
    }
    
    // Step 3: Return to charging/home position
    const returnResult = await moveToPoint(robotId, returnPoint, true);
    
    return {
      success: returnResult.success,
      workflowId,
      message: returnResult.success ? 
        'Dropoff workflow completed successfully' : 
        `Dropoff workflow failed during return: ${returnResult.message}`,
      steps: {
        pickup: pickupResult,
        dropoff: dropoffResult,
        return: returnResult
      }
    };
  } catch (error) {
    console.error(`Error executing dropoff workflow for robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Dropoff workflow failed: ${error.message}`,
      error: error
    };
  }
}

/**
 * Execute a complete pickup workflow task
 * @param {string} robotId - Robot identifier
 * @param {Object} shelfPoint - Shelf point coordinates
 * @param {Object} pickupPoint - Pickup point coordinates
 * @param {Object} returnPoint - Return point coordinates
 * @returns {Promise<Object>} - Returns the execution result
 */
async function executePickupWorkflow(robotId, shelfPoint, pickupPoint, returnPoint) {
  try {
    const workflowId = `pickup-${Date.now()}`;
    console.log(`Starting pickup workflow ${workflowId} for robot ${robotId}`);
    
    // Step 1: Move to shelf point to pick up bin
    const pickupResult = await pickupBin(robotId, shelfPoint);
    if (!pickupResult.success) {
      return {
        success: false,
        workflowId,
        step: 'pickup_at_shelf',
        message: pickupResult.message
      };
    }
    
    // Step 2: Move to pickup point and drop off bin
    const dropoffResult = await dropoffBin(robotId, pickupPoint);
    if (!dropoffResult.success) {
      return {
        success: false,
        workflowId,
        step: 'dropoff_at_pickup',
        message: dropoffResult.message
      };
    }
    
    // Step 3: Return to charging/home position
    const returnResult = await moveToPoint(robotId, returnPoint, true);
    
    return {
      success: returnResult.success,
      workflowId,
      message: returnResult.success ? 
        'Pickup workflow completed successfully' : 
        `Pickup workflow failed during return: ${returnResult.message}`,
      steps: {
        pickup: pickupResult,
        dropoff: dropoffResult,
        return: returnResult
      }
    };
  } catch (error) {
    console.error(`Error executing pickup workflow for robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Pickup workflow failed: ${error.message}`,
      error: error
    };
  }
}

/**
 * Execute a return to charging task
 * @param {string} robotId - Robot identifier
 * @param {Object} returnPoint - Return point coordinates
 * @returns {Promise<Object>} - Returns the execution result
 */
async function executeReturnWorkflow(robotId, returnPoint) {
  try {
    console.log(`Starting return workflow for robot ${robotId}`);
    
    // Move to charging/home position
    const returnResult = await moveToPoint(robotId, returnPoint, true);
    
    return {
      success: returnResult.success,
      message: returnResult.success ? 
        'Return to charging completed successfully' : 
        `Return to charging failed: ${returnResult.message}`,
      step: returnResult
    };
  } catch (error) {
    console.error(`Error executing return workflow for robot ${robotId}:`, error.message);
    return {
      success: false,
      message: `Return workflow failed: ${error.message}`,
      error: error
    };
  }
}

// Export functions for use in other modules
export {
  pickupBin,
  dropoffBin,
  moveToPoint,
  executeDropoffWorkflow,
  executePickupWorkflow,
  executeReturnWorkflow
};