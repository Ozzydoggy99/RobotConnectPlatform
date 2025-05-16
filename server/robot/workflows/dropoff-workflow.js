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
import axios from 'axios';
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
    
    // Get docking information from enhanced options if available
    let dropoffDockingId = null;
    
    if (options.dockingPoint) {
      // Use the docking point provided in options
      dropoffDockingId = options.dockingPoint.poiId;
      console.log(`Using docking point from options: ${dropoffDockingId}`);
    } else {
      // Try to derive from dropoff point as before
      dropoffDockingId = dropoffPoint.poiId?.replace('_load', '_load_docking') || null;
      console.log(`Deriving docking point ID: ${dropoffDockingId}`);
    }
    
    // Allow proceeding even without an explicit docking point
    // We'll handle finding a suitable docking point during execution
    
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
        dockingPointObject: options.dockingPoint,
        dropoffPointObject: dropoffPoint,
        shelfPointObject: shelfPoint,
        returnPointObject: returnPoint,
        shelfId: shelfPoint.poiId, 
        returnId: returnPoint.poiId,
        // Add origin data for tracking
        requestOrigin: options.origin || 'api',
        originatorId: options.originatorId || null
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
    
    // Log out the full task data to inspect what we're working with
    console.log(`Task data:`, JSON.stringify({
      id: task.id,
      taskId: task.taskId,
      status: task.status,
      hasMetadata: !!task.metadata
    }));
    
    // CRITICAL FIX: First, try to reconstruct missing point data from metadata or the robot's map
    if (!task.dropoffPoint || !task.shelfPoint) {
      console.log(`Missing critical point data, attempting to recover...`);
      
      // Get all the map points for reference
      const allPoints = await apiClient.getAllMapPoints();
      console.log(`Retrieved ${allPoints.length} map points to recover data`);
      
      // Check if we can recover point data from metadata first
      if (task.metadata) {
        // Try to get dropoff point from metadata objects
        if (!task.dropoffPoint && task.metadata.dropoffPointObject) {
          console.log(`Recovering dropoff point from metadata object`);
          task.dropoffPoint = task.metadata.dropoffPointObject;
        } 
        // If no object but we have ID, look it up in the map
        else if (!task.dropoffPoint && task.metadata.dropoffId) {
          console.log(`Looking for dropoff point with ID ${task.metadata.dropoffId}`);
          const point = allPoints.find(p => p.poiId === task.metadata.dropoffId);
          if (point) {
            console.log(`Found dropoff point from map by ID`);
            task.dropoffPoint = point;
          }
        }
        
        // Apply the same logic for shelf point
        if (!task.shelfPoint && task.metadata.shelfPointObject) {
          console.log(`Recovering shelf point from metadata object`);
          task.shelfPoint = task.metadata.shelfPointObject;
        } 
        else if (!task.shelfPoint && task.metadata.shelfId) {
          console.log(`Looking for shelf point with ID ${task.metadata.shelfId}`);
          const point = allPoints.find(p => p.poiId === task.metadata.shelfId);
          if (point) {
            console.log(`Found shelf point from map by ID`);
            task.shelfPoint = point;
          }
        }
        
        // Save any recovered points
        if (task.dropoffPoint || task.shelfPoint) {
          console.log(`Saving recovered point data to task`);
          await storage.updateTask(task);
        }
      }
      
      // If we still don't have points, try to find them by name in the map
      if (!task.dropoffPoint || !task.shelfPoint) {
        if (task.name && task.name.startsWith('Dropoff from')) {
          const nameParts = task.name.replace('Dropoff from ', '').split(' to ');
          if (nameParts.length === 2) {
            const [dropoffName, shelfName] = nameParts;
            
            // Try to find points by name
            if (!task.dropoffPoint) {
              const point = allPoints.find(p => p.name === dropoffName);
              if (point) {
                console.log(`Found dropoff point by name: ${dropoffName}`);
                task.dropoffPoint = point;
              }
            }
            
            if (!task.shelfPoint) {
              const point = allPoints.find(p => p.name === shelfName);
              if (point) {
                console.log(`Found shelf point by name: ${shelfName}`);
                task.shelfPoint = point;
              }
            }
            
            // Save any recovered points
            if (task.dropoffPoint || task.shelfPoint) {
              console.log(`Saving points recovered by name to task`);
              await storage.updateTask(task);
            }
          }
        }
      }
    }
    
    // Check if recovery was successful
    console.log(`After recovery, have dropoff point: ${!!task.dropoffPoint}, shelf point: ${!!task.shelfPoint}`);
    
    // Initialize metadata if missing
    if (!task.metadata && task.dropoffPoint) {
      console.log('Creating metadata from recovered points');
      task.metadata = {
        workflowType: 'dropoff',
        dropoffId: task.dropoffPoint.poiId,
        shelfId: task.shelfPoint?.poiId,
        returnId: task.returnPoint?.poiId,
        // Store objects for easier recovery later
        dropoffPointObject: task.dropoffPoint,
        shelfPointObject: task.shelfPoint,
        returnPointObject: task.returnPoint
      };
      
      await storage.updateTask(task);
    }
    
    // Check if we already have a docking point in metadata
    if (task.metadata?.dropoffDockingId) {
      console.log(`Found existing docking ID in metadata: ${task.metadata.dropoffDockingId}`);
      return continueInitStep(apiClient, robotId, task, task.metadata.dropoffDockingId);
    }
    
    // Get the dropoff point after potential recovery
    const dropoffPoint = task.dropoffPoint;
    if (!dropoffPoint) {
      console.error(`CRITICAL ERROR: Task ${task.taskId} is missing dropoff point data even after recovery attempts`);
      throw new Error('Task missing dropoff point data');
    }
    
    console.log(`Using dropoff point: ${dropoffPoint.poiId} (${dropoffPoint.name})`);
    
    // Get all points to find a suitable docking point
    const allPoints = await apiClient.getAllMapPoints();
    console.log(`Retrieved ${allPoints.length} map points`);
    
    // First, try to find a docking point that corresponds to this dropoff point
    let dockingPoint = null;
    
    // Common pattern: if dropoff is 001_load, docking might be 001_load_docking
    if (dropoffPoint.name && dropoffPoint.name.includes('_load')) {
      const potentialDockingName = dropoffPoint.name.replace('_load', '_load_docking');
      console.log(`Looking for docking point with name: ${potentialDockingName}`);
      
      dockingPoint = allPoints.find(p => 
        p.name === potentialDockingName || 
        p.poiId === potentialDockingName
      );
      
      if (dockingPoint) {
        console.log(`Found matching docking point by name pattern: ${dockingPoint.poiId}`);
      }
    }
    
    // If no specific match found, look for any docking points
    if (!dockingPoint) {
      const dockingPoints = allPoints.filter(p => 
        p.type === 'docking' || 
        p.name.includes('dock') || 
        p.name.includes('docking')
      );
      
      console.log(`Found ${dockingPoints.length} docking points in total`);
      
      if (dockingPoints.length > 0) {
        dockingPoint = dockingPoints[0];
        console.log(`Using first available docking point: ${dockingPoint.poiId}`);
      }
    }
    
    // Store the docking point if found
    if (dockingPoint) {
      console.log(`Using docking point: ${dockingPoint.poiId} (${dockingPoint.name})`);
      task.metadata = task.metadata || {};
      task.metadata.dropoffDockingId = dockingPoint.poiId;
      await storage.updateTask(task);
      
      return continueInitStep(apiClient, robotId, task, dockingPoint.poiId);
    }
    
    // If no suitable docking point is found, use the dropoff point itself
    console.log(`No docking points found, using dropoff point itself: ${dropoffPoint.poiId}`);
    task.metadata = task.metadata || {};
    task.metadata.dropoffDockingId = dropoffPoint.poiId;
    await storage.updateTask(task);
    
    return continueInitStep(apiClient, robotId, task, dropoffPoint.poiId);
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
    console.log(`Robot ${robotId} is moving to dropoff docking point (${dockingId})`);
    
    // Find the point information from the robot's map
    const allPoints = await apiClient.getAllMapPoints();
    const targetPoint = allPoints.find(p => p.poiId === dockingId);
    
    if (!targetPoint) {
      throw new Error(`Could not find point with ID ${dockingId} in robot's map`);
    }
    
    // Check if robot is charging and undock if necessary
    try {
      // Import charger actions module
      const { undockFromCharger } = await import('../charger-actions.js');
      
      // Get robot status to check if it's charging
      const status = await apiClient.getStatus();
      if (status && (status.power_supply_status === 'charging' || status.is_charging)) {
        console.log(`Robot ${robotId} is currently charging, sending undock command...`);
        
        // Send undock command
        const undockResult = await undockFromCharger(robotId);
        console.log(`Undock result for robot ${robotId}:`, JSON.stringify(undockResult));
        
        // Wait a moment for the undock operation to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.log(`Robot ${robotId} is not charging, proceeding with movement`);
      }
    } catch (undockError) {
      console.error(`Error checking charging status or undocking robot ${robotId}:`, undockError.message);
      // Continue even if undock fails - the direct API will handle it
    }
    
    // Create a movement task using the robot's API client directly
    console.log(`Creating task to navigate to docking point ${dockingId}`);
    
    let moveResponse;
    
    try {
      // Following the correct Move API format according to /chassis/moves endpoint documentation
      console.log(`Target point data:`, JSON.stringify(targetPoint));
      
      // Create a move command with the proper format for the Move API
      const moveData = {
        creator: "robot-platform", // Who created this move action
        type: "standard", // Standard move type
        target_x: Number(targetPoint.x) || 0,
        target_y: Number(targetPoint.y) || 0,
        target_ori: Number(targetPoint.yaw || 0),
        target_accuracy: 0.2, // Accuracy in meters (optional)
      };
      
      console.log(`Creating move command for robot ${robotId} with data:`, JSON.stringify(moveData));
      
      // Use the Move API /chassis/moves endpoint to move the robot
      const moveId = await apiClient.createMoveAction(robotId, moveData);
      
      if (!moveId) {
        throw new Error(`Failed to create move action for robot ${robotId}`);
      }
      
      console.log(`Move action created successfully for robot ${robotId}: ${moveId}`);
      moveResponse = { moveId };
      
      console.log(`Move response from API: ${JSON.stringify(moveResponse)}`);
    } catch (error) {
      console.error(`Error creating task:`, error);
      throw new Error(`Failed to move robot to docking point: ${error.message}`);
    }
    
    // Store the result for tracking
    const moveResult = {
      success: moveResponse && !moveResponse.error,
      taskId: moveResponse?.taskId || moveResponse?.id || `move-to-${dockingId}`,
      status: 'in_progress',
      details: moveResponse
    };
    
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
    
    // Get the shelf point details from the map
    const allPoints = await apiClient.getAllMapPoints();
    const targetPoint = allPoints.find(p => p.poiId === shelfDockingId);
    
    if (!targetPoint) {
      throw new Error(`Could not find shelf point with ID ${shelfDockingId} in robot's map`);
    }
    
    // Create a move action to the shelf point
    const moveTaskData = {
      x: targetPoint.x,
      y: targetPoint.y,
      yaw: targetPoint.yaw || 0,
      areaId: targetPoint.areaId,
      name: "Move to shelf point"
    };
    
    // Create and execute the movement task
    const moveTaskId = await apiClient.createMoveAction(robotId, moveTaskData);
    
    // Store the result for tracking
    const moveResult = {
      success: true,
      taskId: moveTaskId,
      status: 'in_progress'
    };
    
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
    
    // Get the charger point details from the map
    const allPoints = await apiClient.getAllMapPoints();
    const targetPoint = allPoints.find(p => p.poiId === chargerId);
    
    if (!targetPoint) {
      throw new Error(`Could not find charger point with ID ${chargerId} in robot's map`);
    }
    
    // Create a move action to the charger point
    const moveTaskData = {
      x: targetPoint.x,
      y: targetPoint.y,
      yaw: targetPoint.yaw || 0,
      areaId: targetPoint.areaId,
      name: "Return to charger"
    };
    
    // Create and execute the movement task
    const moveTaskId = await apiClient.createMoveAction(robotId, moveTaskData);
    
    // Store the result for tracking
    const moveResult = {
      success: true,
      taskId: moveTaskId,
      status: 'in_progress'
    };
    
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
          // Get the shelf point details from the map
          const allPoints = await apiClient.getAllMapPoints();
          const targetPoint = allPoints.find(p => p.poiId === shelfDockingId);
          
          if (!targetPoint) {
            console.error(`Could not find shelf point with ID ${shelfDockingId} for safety move`);
          } else {
            console.log(`Sending robot ${robotId} to safety shelf point ${shelfDockingId}`);
            
            // Create a move action to the shelf point for safety
            const moveTaskData = {
              x: targetPoint.x,
              y: targetPoint.y,
              yaw: targetPoint.yaw || 0,
              areaId: targetPoint.areaId,
              name: "Safety move to shelf"
            };
            
            // Create and execute the movement task
            await apiClient.createMoveAction(robotId, moveTaskData);
          }
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