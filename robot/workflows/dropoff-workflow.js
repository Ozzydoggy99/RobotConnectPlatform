/**
 * Dropoff Workflow Generator
 * 
 * This module generates task sequences for the dropoff workflow:
 * Charger → Dropoff Point → Shelf → Charger
 * 
 * The workflow handles robots collecting bins from dropoff points (001-049)
 * and taking them to appropriate shelves.
 */

import { v4 as uuidv4 } from 'uuid';
import * as directApi from '../direct-api.js';
import { storage } from '../../storage.js';

// Constants
const TASK_TYPE = 'dropoff';
const DEFAULT_PRIORITY = 'normal';

/**
 * Generate a dropoff workflow task
 * 
 * @param {string} robotId - The robot's serial number
 * @param {Object} dropoffPoint - The dropoff point coordinates (where human drops off bin)
 * @param {Object} shelfPoint - The shelf point coordinates (where bin will be stored)
 * @param {Object} returnPoint - The return/charging point coordinates
 * @param {Object} options - Additional options like priority
 * @returns {Object} The generated task
 */
export async function generateDropoffTask(robotId, dropoffPoint, shelfPoint, returnPoint, options = {}) {
  try {
    if (!robotId) {
      throw new Error('Robot ID is required');
    }
    
    if (!dropoffPoint || !shelfPoint || !returnPoint) {
      throw new Error('Dropoff, shelf, and return points are required');
    }
    
    // Ensure we have the docking points for both the dropoff and shelf
    const dropoffDockingId = dropoffPoint.poiId?.replace('_load', '_load_docking') || null;
    if (!dropoffDockingId) {
      throw new Error('Could not determine dropoff docking point ID');
    }
    
    // Get the robot information
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      throw new Error(`Robot ${robotId} not found`);
    }
    
    // Generate a unique task ID
    const taskId = `dropoff-${uuidv4()}`;
    
    // Use point names for better readability in logs
    const dropoffName = dropoffPoint.name || 'dropoff';
    const shelfName = shelfPoint.name || 'shelf';
    
    // Create the task
    const task = {
      robotId,
      name: `Dropoff from ${dropoffName} to ${shelfName}`,
      taskId,
      taskType: TASK_TYPE,
      status: 'pending',
      priority: options.priority || DEFAULT_PRIORITY,
      // Store points as payload for the task
      dropoffPoint,
      shelfPoint,
      returnPoint,
      // Track the step of the workflow
      currentStep: 'init',
      // Store a timestamp
      createdAt: new Date(),
      // Add additional data fields
      metadata: {
        workflowType: 'dropoff',
        dropoffId: dropoffPoint.poiId,
        dropoffDockingId,
        shelfId: shelfPoint.poiId, 
        returnId: returnPoint.poiId,
        // Add origin data for tracking
        requestOrigin: options.origin || 'api',
        originatorId: options.originatorId || null,
      }
    };
    
    // Store the task in the database
    const storedTask = await storage.createTask(task);
    
    console.log(`Created dropoff task ${taskId} for robot ${robotId}`);
    return storedTask;
  } catch (error) {
    console.error(`Error generating dropoff task for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Execute the dropoff workflow task steps
 * 
 * @param {string} robotId - The robot's serial number
 * @param {Object} task - The task to execute
 * @returns {Promise<Object>} Updated task
 */
export async function executeDropoffWorkflow(robotId, task) {
  try {
    if (!task || !task.taskId) {
      throw new Error('Invalid task');
    }
    
    // Get robot API client
    const apiClient = await getRobotApiClient(robotId);
    if (!apiClient) {
      throw new Error(`Could not get API client for robot ${robotId}`);
    }
    
    // Get the current step of the workflow
    const currentStep = task.currentStep || 'init';
    console.log(`Executing dropoff workflow step '${currentStep}' for task ${task.taskId}`);
    
    let updatedTask = { ...task };
    
    // Execute the appropriate step based on current step
    switch (currentStep) {
      case 'init':
        // First step: Move to dropoff docking point
        updatedTask = await executeInitStep(apiClient, robotId, task);
        break;
        
      case 'to_dropoff':
        // Check if we've reached the dropoff point
        updatedTask = await checkToDropoffStep(apiClient, robotId, task);
        break;
        
      case 'at_dropoff':
        // We're at the dropoff point, waiting for bin placement or pickup
        // In real implementation, this would involve sensors, user confirmation, etc.
        updatedTask = await executeAtDropoffStep(apiClient, robotId, task);
        break;
        
      case 'to_shelf':
        // Check if we've reached the shelf
        updatedTask = await checkToShelfStep(apiClient, robotId, task);
        break;
        
      case 'at_shelf':
        // We're at the shelf, waiting for bin placement or removal
        updatedTask = await executeAtShelfStep(apiClient, robotId, task);
        break;
        
      case 'to_charger':
        // Check if we've reached the charger
        updatedTask = await checkToChargerStep(apiClient, robotId, task);
        break;
        
      case 'done':
        // Task is complete
        console.log(`Dropoff task ${task.taskId} is complete`);
        updatedTask.status = 'completed';
        updatedTask.completedAt = new Date();
        break;
        
      default:
        console.warn(`Unknown step '${currentStep}' for task ${task.taskId}`);
        break;
    }
    
    // Update the task in the database
    return await storage.updateTask(updatedTask);
    
  } catch (error) {
    console.error(`Error executing dropoff workflow for robot ${robotId}, task ${task.taskId}:`, error);
    
    // Update task status to failed
    const failedTask = {
      ...task,
      status: 'failed',
      errorDetails: {
        message: error.message,
        code: error.code || 500,
        step: task.currentStep
      }
    };
    
    await storage.updateTask(failedTask);
    throw error;
  }
}

/**
 * Get robot API client
 * 
 * @param {string} robotId - Robot's serial number
 * @returns {Promise<Object>} Robot API client
 */
async function getRobotApiClient(robotId) {
  try {
    // Get robot configuration
    const robot = await storage.getRobot(robotId);
    if (!robot || !robot.metadata?.connectionConfig) {
      throw new Error(`Robot ${robotId} not configured properly`);
    }
    
    // Create API client
    return directApi.createRobotApiClient(
      robotId,
      robot.metadata.connectionConfig.publicIp,
      8090, // Always use port 8090 for AutoXing robots
      process.env.AUTOXING_SDK_API_KEY || '667a51a4d948433081a272c78d10a8a4'
    );
  } catch (error) {
    console.error(`Error getting API client for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Execute the init step of the dropoff workflow
 * 
 * @param {Object} apiClient - Robot API client
 * @param {string} robotId - Robot's serial number
 * @param {Object} task - The task to execute
 * @returns {Promise<Object>} Updated task
 */
async function executeInitStep(apiClient, robotId, task) {
  try {
    console.log(`Initializing dropoff task ${task.taskId} for robot ${robotId}`);
    
    // Get the dropoff point (using the docking point for approach)
    // Extract the docking point ID from task metadata
    const dropoffDockingId = task.metadata?.dropoffDockingId;
    
    console.log(`Task metadata available:`, JSON.stringify(task.metadata));
    console.log(`Found dropoff docking ID: ${dropoffDockingId || 'not found'}`);
    
    // If we can't find the docking ID in the metadata, try to derive it from the dropoff point ID
    if (!dropoffDockingId && task.dropoffPoint?.poiId) {
      // Try to construct it from the dropoff point
      const derivedDockingId = task.dropoffPoint.poiId.replace('_load', '_load_docking');
      console.log(`Constructed docking ID from dropoff point: ${derivedDockingId}`);
      
      // Update task metadata to include this derived docking ID for future steps
      task.metadata = task.metadata || {};
      task.metadata.dropoffDockingId = derivedDockingId;
      
      // Continue with the docking ID we derived
      return continueInitStep(apiClient, robotId, task, derivedDockingId);
    }
    
    if (!dropoffDockingId) {
      throw new Error('Dropoff docking point ID not found in task metadata');
    }
    
    return continueInitStep(apiClient, robotId, task, dropoffDockingId);
  } catch (error) {
    console.error(`Error in init step for robot ${robotId}, task ${task.taskId}:`, error);
    throw error;
  }
}

/**
 * Continue the init step with the provided docking ID
 * 
 * @param {Object} apiClient - Robot API client
 * @param {string} robotId - Robot's serial number
 * @param {Object} task - The task to execute
 * @param {string} dockingId - The docking point ID to use
 * @returns {Promise<Object>} Updated task
 */
async function continueInitStep(apiClient, robotId, task, dockingId) {
  try {
    // Start movement to dropoff docking point
    const moveResult = await apiClient.createMoveTask({
      pointId: dockingId,
      targetName: 'dropoff_docking'
    });
    
    console.log(`Robot ${robotId} is moving to dropoff docking point (${dockingId})`);
    
    // Update the task with the movement info and make sure to update metadata too
    const updatedTask = {
      ...task,
      currentStep: 'to_dropoff',
      status: 'in_progress',
      startedAt: new Date(),
      currentMoveTaskId: moveResult.taskId || null,
      metadata: {
        ...task.metadata,
        dropoffDockingId: dockingId
      }
    };
    
    // Store the updated task
    await storage.updateTask(updatedTask);
    
    return updatedTask;
  } catch (error) {
    console.error(`Error in continue init step for robot ${robotId}, task ${task.taskId}:`, error);
    throw error;
  }
}

/**
 * Check if the robot has reached the dropoff point
 * 
 * @param {Object} apiClient - Robot API client
 * @param {string} robotId - Robot's serial number
 * @param {Object} task - The task to execute
 * @returns {Promise<Object>} Updated task
 */
async function checkToDropoffStep(apiClient, robotId, task) {
  try {
    // Check if movement is complete by querying robot status
    const robotStatus = await apiClient.getStatus();
    const currentMoveTaskId = task.currentMoveTaskId;
    
    // Check movement task status (this would be more complex in production)
    if (robotStatus.task_state === 'idle' || 
        (robotStatus.task_id !== currentMoveTaskId && robotStatus.task_state !== 'moving')) {
      console.log(`Robot ${robotId} has arrived at dropoff docking point`);
      
      // We've arrived at the dropoff point
      return {
        ...task,
        currentStep: 'at_dropoff',
        currentMoveTaskId: null
      };
    }
    
    // Still moving to the dropoff point
    console.log(`Robot ${robotId} is still moving to dropoff docking point`);
    return task;
  } catch (error) {
    console.error(`Error checking dropoff arrival for robot ${robotId}, task ${task.taskId}:`, error);
    throw error;
  }
}

/**
 * Execute actions at the dropoff point
 * 
 * @param {Object} apiClient - Robot API client
 * @param {string} robotId - Robot's serial number
 * @param {Object} task - The task to execute
 * @returns {Promise<Object>} Updated task
 */
async function executeAtDropoffStep(apiClient, robotId, task) {
  try {
    // In a real implementation, this would involve:
    // 1. Waiting for human to place bin on robot
    // 2. Confirming bin placement with sensors
    // 3. Possibly using a UI for human confirmation
    
    // For this demonstration, we'll simulate a bin placement
    console.log(`Robot ${robotId} is at dropoff point, simulating bin placement`);
    
    // TODO: In a real implementation, we'd wait for sensor confirmation
    // For demo, we'll move on after 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the shelf point
    const shelfDockingId = task.metadata?.shelfId?.replace('_load', '_load_docking') || null;
    if (!shelfDockingId) {
      throw new Error('Shelf docking point ID not found');
    }
    
    // Start movement to shelf
    const moveResult = await apiClient.createMoveTask({
      pointId: shelfDockingId,
      targetName: 'shelf_docking'
    });
    
    console.log(`Robot ${robotId} has picked up bin and is moving to shelf docking point (${shelfDockingId})`);
    
    // Update the task
    return {
      ...task,
      currentStep: 'to_shelf',
      currentMoveTaskId: moveResult.taskId || null
    };
  } catch (error) {
    console.error(`Error at dropoff point for robot ${robotId}, task ${task.taskId}:`, error);
    throw error;
  }
}

/**
 * Check if the robot has reached the shelf
 * 
 * @param {Object} apiClient - Robot API client
 * @param {string} robotId - Robot's serial number
 * @param {Object} task - The task to execute
 * @returns {Promise<Object>} Updated task
 */
async function checkToShelfStep(apiClient, robotId, task) {
  try {
    // Check if movement is complete
    const robotStatus = await apiClient.getStatus();
    const currentMoveTaskId = task.currentMoveTaskId;
    
    if (robotStatus.task_state === 'idle' || 
        (robotStatus.task_id !== currentMoveTaskId && robotStatus.task_state !== 'moving')) {
      console.log(`Robot ${robotId} has arrived at shelf docking point`);
      
      // We've arrived at the shelf
      return {
        ...task,
        currentStep: 'at_shelf',
        currentMoveTaskId: null
      };
    }
    
    // Still moving to the shelf
    console.log(`Robot ${robotId} is still moving to shelf docking point`);
    return task;
  } catch (error) {
    console.error(`Error checking shelf arrival for robot ${robotId}, task ${task.taskId}:`, error);
    throw error;
  }
}

/**
 * Execute actions at the shelf
 * 
 * @param {Object} apiClient - Robot API client
 * @param {string} robotId - Robot's serial number
 * @param {Object} task - The task to execute
 * @returns {Promise<Object>} Updated task
 */
async function executeAtShelfStep(apiClient, robotId, task) {
  try {
    // In a real implementation, this would involve:
    // 1. Robot placing the bin on the shelf (might be automated)
    // 2. Confirming bin placement with sensors
    
    // For demonstration, we'll simulate shelf placement
    console.log(`Robot ${robotId} is at shelf, simulating bin placement`);
    
    // TODO: In a real implementation, we'd wait for sensor confirmation
    // For demo, we'll move on after 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start movement to charger
    const chargerId = task.returnPoint?.poiId;
    if (!chargerId) {
      throw new Error('Charger point ID not found');
    }
    
    const moveResult = await apiClient.createMoveTask({
      pointId: chargerId,
      targetName: 'charger'
    });
    
    console.log(`Robot ${robotId} has placed bin on shelf and is returning to charger (${chargerId})`);
    
    // Update the task
    return {
      ...task,
      currentStep: 'to_charger',
      currentMoveTaskId: moveResult.taskId || null
    };
  } catch (error) {
    console.error(`Error at shelf for robot ${robotId}, task ${task.taskId}:`, error);
    throw error;
  }
}

/**
 * Check if the robot has reached the charger
 * 
 * @param {Object} apiClient - Robot API client
 * @param {string} robotId - Robot's serial number
 * @param {Object} task - The task to execute
 * @returns {Promise<Object>} Updated task
 */
async function checkToChargerStep(apiClient, robotId, task) {
  try {
    // Check if movement is complete
    const robotStatus = await apiClient.getStatus();
    const currentMoveTaskId = task.currentMoveTaskId;
    
    if (robotStatus.task_state === 'idle' || 
        (robotStatus.task_id !== currentMoveTaskId && robotStatus.task_state !== 'moving')) {
      console.log(`Robot ${robotId} has arrived at charger`);
      
      // We've arrived at the charger
      return {
        ...task,
        currentStep: 'done',
        currentMoveTaskId: null
      };
    }
    
    // Still moving to the charger
    console.log(`Robot ${robotId} is still moving to charger`);
    return task;
  } catch (error) {
    console.error(`Error checking charger arrival for robot ${robotId}, task ${task.taskId}:`, error);
    throw error;
  }
}

/**
 * Check if a task can be canceled and cancel it safely
 * 
 * @param {string} robotId - Robot's serial number
 * @param {Object} task - The task to cancel
 * @returns {Promise<Object>} Updated task
 */
export async function cancelDropoffTask(robotId, task) {
  try {
    if (!task || !task.taskId) {
      throw new Error('Invalid task');
    }
    
    console.log(`Canceling dropoff task ${task.taskId} for robot ${robotId}`);
    
    // Get robot API client
    const apiClient = await getRobotApiClient(robotId);
    
    // Cancel any active move task
    if (task.currentMoveTaskId) {
      try {
        await apiClient.cancelTask(task.currentMoveTaskId);
        console.log(`Canceled move task ${task.currentMoveTaskId} for robot ${robotId}`);
      } catch (error) {
        console.warn(`Error canceling move task ${task.currentMoveTaskId}:`, error);
        // Continue with cancellation even if this fails
      }
    }
    
    // Check if the robot is carrying a bin (at_dropoff or to_shelf steps)
    const isCarryingBin = ['at_dropoff', 'to_shelf', 'at_shelf'].includes(task.currentStep);
    
    // If the robot is carrying a bin, we need to ensure it's safely delivered
    // This is a critical safety feature to prevent bins from being lost
    if (isCarryingBin) {
      console.log(`Robot ${robotId} is carrying a bin, directing to nearest shelf for safe dropoff`);
      
      // In a real implementation, we'd route to the nearest shelf point
      // For this demo, we'll use the original shelf point
      const shelfDockingId = task.metadata?.shelfId?.replace('_load', '_load_docking');
      
      if (shelfDockingId) {
        console.log(`Sending robot ${robotId} to shelf docking point ${shelfDockingId} for safety`);
        
        try {
          await apiClient.createMoveTask({
            pointId: shelfDockingId,
            targetName: 'safety_shelf_docking'
          });
        } catch (error) {
          console.error(`Error sending robot to safety shelf:`, error);
          // Continue with cancellation
        }
      }
    }
    
    // Update the task
    const canceledTask = {
      ...task,
      status: 'cancelled',
      currentMoveTaskId: null,
      errorDetails: {
        message: 'Task canceled by user or system',
        code: 0,
        step: task.currentStep
      }
    };
    
    // Store the updated task
    return await storage.updateTask(canceledTask);
    
  } catch (error) {
    console.error(`Error canceling dropoff task ${task?.taskId} for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Find dropoff points from POI list
 * Returns points in the 001-049 range which are designated as dropoff points
 * 
 * @param {Array} points - List of POIs
 * @returns {Array} Filtered dropoff points
 */
export function findDropoffPoints(points) {
  if (!points || !Array.isArray(points)) {
    return [];
  }
  
  // Get points that are in the dropoff range (001-049)
  return points.filter(point => {
    if (!point.name) return false;
    
    // Extract the numeric part, ensuring we handle both formats: "001_load" and just "001"
    const nameBase = point.name.split('_')[0];
    const pointNum = parseInt(nameBase, 10);
    
    // Check if in dropoff range (1-49)
    return !isNaN(pointNum) && pointNum >= 1 && pointNum <= 49;
  });
}

/**
 * Find pickup points from POI list
 * Returns points in the 050-099 range which are designated as pickup points
 * 
 * @param {Array} points - List of POIs
 * @returns {Array} Filtered pickup points
 */
export function findPickupPoints(points) {
  if (!points || !Array.isArray(points)) {
    return [];
  }
  
  // Get points that are in the pickup range (050-099)
  return points.filter(point => {
    if (!point.name) return false;
    
    // Extract the numeric part, ensuring we handle both formats: "050_load" and just "050"
    const nameBase = point.name.split('_')[0];
    const pointNum = parseInt(nameBase, 10);
    
    // Check if in pickup range (50-99)
    return !isNaN(pointNum) && pointNum >= 50 && pointNum <= 99;
  });
}

/**
 * Find shelf points from POI list
 * 
 * @param {Array} points - List of POIs
 * @returns {Array} Filtered shelf points
 */
export function findShelfPoints(points) {
  if (!points || !Array.isArray(points)) {
    return [];
  }
  
  // Get points that have rack or shelf type
  return points.filter(point => {
    return point.type?.includes('rack') || point.type?.includes('shelf');
  });
}

/**
 * Find charging station from POI list
 * 
 * @param {Array} points - List of POIs
 * @returns {Object|null} Charging station or null
 */
export function findChargingStation(points) {
  if (!points || !Array.isArray(points)) {
    return null;
  }
  
  // Look for point with charger type or name
  return points.find(point => {
    return point.type?.includes('charger') || point.name?.includes('Charging');
  }) || null;
}