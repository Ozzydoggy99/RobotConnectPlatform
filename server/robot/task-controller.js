/**
 * Task Controller
 * 
 * Exposes API endpoints for managing robot tasks
 * including creating and managing the dropoff and pickup workflows
 */

import * as directApi from './direct-api.js';
import { storage } from '../storage.js';
import * as dropoffWorkflow from './workflows/dropoff-workflow.js';

/**
 * Helper function to retrieve a task by ID
 * This ensures we use the correct method from storage and enhances it with necessary data
 */
async function getTaskFromStorage(taskId) {
  // Attempt to retrieve task with cached data enhancements
  const task = await storage.getTask(taskId);
  
  if (task) {
    // Log task retrieval for debugging
    console.log(`Retrieved task ${task.taskId} (${task.name}) from storage`);
    console.log(`Task data status:`, {
      hasDropoffPoint: !!task.dropoffPoint,
      hasShelfPoint: !!task.shelfPoint,
      hasReturnPoint: !!task.returnPoint,
      hasMetadata: !!task.metadata,
      metadataKeys: task.metadata ? Object.keys(task.metadata) : []
    });
    
    // FIRST RECOVERY ATTEMPT: Use metadata objects directly if available
    if (task.taskType === 'dropoff') {
      let pointDataRecovered = false;
      
      // Try to recover point data from metadata first
      if (!task.dropoffPoint && task.metadata?.dropoffPointObject) {
        console.log(`Recovering dropoff point from metadata object`);
        task.dropoffPoint = task.metadata.dropoffPointObject;
        pointDataRecovered = true;
      }
      
      if (!task.shelfPoint && task.metadata?.shelfPointObject) {
        console.log(`Recovering shelf point from metadata object`);
        task.shelfPoint = task.metadata.shelfPointObject;
        pointDataRecovered = true;
      }
      
      if (!task.returnPoint && task.metadata?.returnPointObject) {
        console.log(`Recovering return point from metadata object`);
        task.returnPoint = task.metadata.returnPointObject;
        pointDataRecovered = true;
      }
      
      // SECOND RECOVERY ATTEMPT: Try to locate the points from robot's map using IDs
      if (!task.dropoffPoint || !task.shelfPoint || !task.returnPoint) {
        console.log(`Some point data still missing, attempting to recover from robot's map...`);
        
        try {
          const robotId = task.robotId;
          const allPoints = await getAllMapPoints(robotId);
          console.log(`Retrieved ${allPoints.length} points from robot's map`);
          
          // Recover dropoff point
          if (!task.dropoffPoint && task.metadata?.dropoffId) {
            const point = allPoints.find(p => p.poiId === task.metadata.dropoffId);
            if (point) {
              console.log(`Found dropoff point with ID ${task.metadata.dropoffId} in the map`);
              task.dropoffPoint = point;
              pointDataRecovered = true;
            }
          }
          
          // Recover shelf point
          if (!task.shelfPoint && task.metadata?.shelfId) {
            const point = allPoints.find(p => p.poiId === task.metadata.shelfId);
            if (point) {
              console.log(`Found shelf point with ID ${task.metadata.shelfId} in the map`);
              task.shelfPoint = point;
              pointDataRecovered = true;
            }
          }
          
          // Recover return point
          if (!task.returnPoint && task.metadata?.returnId) {
            const point = allPoints.find(p => p.poiId === task.metadata.returnId);
            if (point) {
              console.log(`Found return point with ID ${task.metadata.returnId} in the map`);
              task.returnPoint = point;
              pointDataRecovered = true;
            }
          }
          
          // THIRD RECOVERY ATTEMPT: Try to recover points by their names from task name
          if ((!task.dropoffPoint || !task.shelfPoint) && task.name && task.name.includes('from')) {
            console.log(`Attempting to recover points from task name: ${task.name}`);
            const match = task.name.match(/Dropoff from (.+) to (.+)/);
            
            if (match && match.length >= 3) {
              const [_, dropoffName, shelfName] = match;
              
              // If we don't have dropoff point yet, try to find by name
              if (!task.dropoffPoint) {
                const point = allPoints.find(p => p.name === dropoffName);
                if (point) {
                  console.log(`Found dropoff point by name: ${dropoffName}`);
                  task.dropoffPoint = point;
                  // Also update metadata
                  if (!task.metadata) task.metadata = {};
                  task.metadata.dropoffId = point.poiId;
                  task.metadata.dropoffPointObject = point;
                  pointDataRecovered = true;
                }
              }
              
              // If we don't have shelf point yet, try to find by name
              if (!task.shelfPoint) {
                const point = allPoints.find(p => p.name === shelfName);
                if (point) {
                  console.log(`Found shelf point by name: ${shelfName}`);
                  task.shelfPoint = point;
                  // Also update metadata
                  if (!task.metadata) task.metadata = {};
                  task.metadata.shelfId = point.poiId;
                  task.metadata.shelfPointObject = point;
                  pointDataRecovered = true;
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error recovering point data from map:`, error);
        }
      }
      
      // Update the task in storage if we recovered any data
      if (pointDataRecovered) {
        console.log(`Updating task with recovered point data:`, {
          hasDropoffPoint: !!task.dropoffPoint,
          hasShelfPoint: !!task.shelfPoint,
          hasReturnPoint: !!task.returnPoint
        });
        await storage.updateTask(task);
      }
    }
  }
  
  return task;
}

/**
 * Create a dropoff task for a robot
 * 
 * @param {string} robotId - The robot's serial number
 * @param {string} dropoffPointId - The ID of the dropoff point
 * @param {string} shelfPointId - The ID of the shelf point
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} The created task
 */
export async function createDropoffTask(robotId, dropoffPointId, shelfPointId, options = {}) {
  try {
    // Get the map points
    const allPoints = await getAllMapPoints(robotId);
    
    // Debug - log points and search criteria
    console.log(`Trying to find dropoff point with ID or name: ${dropoffPointId}`);
    console.log(`Trying to find shelf point with ID or name: ${shelfPointId}`);
    console.log(`Number of points available: ${allPoints.length}`);
    console.log(`Points available (first 3 samples):`);
    allPoints.slice(0, 3).forEach(p => {
      console.log(`  Point: id=${p.id}, poiId=${p.poiId}, name=${p.name}, type=${p.type}`);
    });
    
    // Find the specified points
    // Try matching by poiId first, then fall back to matching by name 
    const dropoffPoint = allPoints.find(p => p.poiId === dropoffPointId || p.name === dropoffPointId);
    const shelfPoint = allPoints.find(p => p.poiId === shelfPointId || p.name === shelfPointId);
    const returnPoint = dropoffWorkflow.findChargingStation(allPoints);
    
    // Debug - log results
    console.log(`Found dropoff point: ${dropoffPoint ? 'yes' : 'no'}`);
    console.log(`Found shelf point: ${shelfPoint ? 'yes' : 'no'}`);
    console.log(`Found return point: ${returnPoint ? 'yes' : 'no'}`);
    
    if (!dropoffPoint) {
      throw new Error(`Dropoff point ${dropoffPointId} not found`);
    }
    
    if (!shelfPoint) {
      throw new Error(`Shelf point ${shelfPointId} not found`);
    }
    
    if (!returnPoint) {
      throw new Error('Charging station not found in the map');
    }
    
    // Find a matching docking point for the dropoff
    let dockingPoint = null;
    
    // Try to find a matching docking point with the same base name
    if (dropoffPoint.poiId.includes('_load')) {
      const dockingPointId = dropoffPoint.poiId.replace('_load', '_load_docking');
      dockingPoint = allPoints.find(p => p.poiId === dockingPointId || p.name === dockingPointId);
      console.log(`Looking for matching docking point with ID: ${dockingPointId}, found: ${dockingPoint ? 'yes' : 'no'}`);
    }
    
    // If no specific docking point found, look for any docking point
    if (!dockingPoint) {
      dockingPoint = allPoints.find(p => 
        p.type === 'docking' || 
        p.type.includes('dock') || 
        p.name.includes('dock')
      );
      console.log(`Using alternative docking point: ${dockingPoint ? dockingPoint.poiId : 'none found'}`);
    }
    
    // Provide the actual docking information if found
    const enhancedOptions = {
      ...options,
      dockingPoint: dockingPoint
    };
    
    // Generate and return the dropoff task
    return await dropoffWorkflow.generateDropoffTask(
      robotId, 
      dropoffPoint, 
      shelfPoint, 
      returnPoint,
      enhancedOptions
    );
  } catch (error) {
    console.error(`Error creating dropoff task for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Execute the next step of a task
 * 
 * @param {string} robotId - The robot's serial number
 * @param {string} taskId - The ID of the task to execute
 * @returns {Promise<Object>} The updated task
 */
export async function executeTaskStep(robotId, taskId) {
  try {
    // Get the task using our helper function
    const task = await getTaskFromStorage(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Verify task belongs to the specified robot
    if (task.robotId !== robotId) {
      throw new Error(`Task ${taskId} does not belong to robot ${robotId}`);
    }
    
    // Log the task details for debugging
    console.log(`Executing task ${taskId}: ${task.name}`);
    console.log(`Task details:`, JSON.stringify({
      taskId: task.taskId,
      taskType: task.taskType,
      currentStep: task.currentStep,
      hasMetadata: !!task.metadata,
      hasDropoffPoint: !!task.dropoffPoint,
      hasShelfPoint: !!task.shelfPoint,
      hasReturnPoint: !!task.returnPoint
    }));
    
    // For dropoff tasks, make sure we have the necessary point data
    if (task.taskType === 'dropoff') {
      if (!task.dropoffPoint || !task.shelfPoint) {
        console.log(`Task missing point data, attempting to reconstruct...`);
        
        // Get the robot's available points
        const allPoints = await getAllMapPoints(robotId);
        console.log(`Retrieved ${allPoints.length} points for task data reconstruction`);
        
        // If we have metadata with point IDs, use those to reconstruct the points
        if (task.metadata) {
          if (!task.dropoffPoint && task.metadata.dropoffId) {
            const dropoffPoint = allPoints.find(p => p.poiId === task.metadata.dropoffId);
            if (dropoffPoint) {
              console.log(`Reconstructed dropoff point from ID ${task.metadata.dropoffId}`);
              task.dropoffPoint = dropoffPoint;
            }
          }
          
          if (!task.shelfPoint && task.metadata.shelfId) {
            const shelfPoint = allPoints.find(p => p.poiId === task.metadata.shelfId);
            if (shelfPoint) {
              console.log(`Reconstructed shelf point from ID ${task.metadata.shelfId}`);
              task.shelfPoint = shelfPoint;
            }
          }
          
          if (!task.returnPoint && task.metadata.returnId) {
            const returnPoint = allPoints.find(p => p.poiId === task.metadata.returnId);
            if (returnPoint) {
              console.log(`Reconstructed return point from ID ${task.metadata.returnId}`);
              task.returnPoint = returnPoint;
            }
          }
          
          // Update the task with the reconstructed points
          if (task.dropoffPoint || task.shelfPoint || task.returnPoint) {
            console.log(`Saving reconstructed point data to task`);
            await storage.updateTask(task);
          }
        }
      }
    }
    
    
    // For dropoff tasks, check if we need to reconstruct point data
    if (task.taskType === 'dropoff' && (!task.dropoffPoint || !task.shelfPoint || !task.returnPoint)) {
      console.log('Task missing point data, attempting to reconstruct...');
      
      if (task.metadata?.dropoffId || task.metadata?.shelfId || task.metadata?.returnId) {
        const allPoints = await getAllMapPoints(robotId);
        
        // Rebuild missing points from metadata IDs if available
        if (task.metadata?.dropoffId && !task.dropoffPoint) {
          task.dropoffPoint = allPoints.find(p => p.poiId === task.metadata.dropoffId);
          console.log(`Reconstructed dropoff point from metadata: ${task.dropoffPoint ? 'success' : 'failed'}`);
        }
        
        if (task.metadata?.shelfId && !task.shelfPoint) {
          task.shelfPoint = allPoints.find(p => p.poiId === task.metadata.shelfId);
          console.log(`Reconstructed shelf point from metadata: ${task.shelfPoint ? 'success' : 'failed'}`);
        }
        
        if (task.metadata?.returnId && !task.returnPoint) {
          task.returnPoint = allPoints.find(p => p.poiId === task.metadata.returnId);
          console.log(`Reconstructed return point from metadata: ${task.returnPoint ? 'success' : 'failed'}`);
        }
        
        // Update the task with the reconstructed data
        await storage.updateTask(task);
      }
    }
    
    // Execute the appropriate workflow based on task type
    switch (task.taskType) {
      case 'dropoff':
        return await dropoffWorkflow.executeDropoffWorkflow(robotId, task);
        
      // Add more task types here as they are implemented
      
      default:
        throw new Error(`Unknown task type: ${task.taskType}`);
    }
  } catch (error) {
    console.error(`Error executing task step for robot ${robotId}, task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Cancel a task
 * 
 * @param {string} robotId - The robot's serial number
 * @param {string} taskId - The ID of the task to cancel
 * @returns {Promise<Object>} The cancelled task
 */
export async function cancelTask(robotId, taskId) {
  try {
    // Get the task using the helper function
    const task = await getTaskFromStorage(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Verify task belongs to the specified robot
    if (task.robotId !== robotId) {
      throw new Error(`Task ${taskId} does not belong to robot ${robotId}`);
    }
    
    // If task is already completed or cancelled, return it
    if (task.status === 'completed' || task.status === 'cancelled') {
      return task;
    }
    
    // Cancel the appropriate workflow based on task type
    switch (task.taskType) {
      case 'dropoff':
        return await dropoffWorkflow.cancelDropoffTask(robotId, task);
        
      // Add more task types here as they are implemented
      
      default:
        throw new Error(`Unknown task type: ${task.taskType}`);
    }
  } catch (error) {
    console.error(`Error cancelling task for robot ${robotId}, task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Get all map points for a robot
 * 
 * @param {string} robotId - The robot's serial number
 * @returns {Promise<Array>} List of map points
 */
async function getAllMapPoints(robotId) {
  try {
    // Get the robot
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      throw new Error(`Robot ${robotId} not found`);
    }
    
    // Get robot API client
    const apiClient = await directApi.createRobotApiClient(
      robotId,
      robot.metadata?.connectionConfig?.publicIp,
      8090, // Always use port 8090 for AutoXing robots
      process.env.AUTOXING_SDK_API_KEY || '667a51a4d948433081a272c78d10a8a4'
    );
    
    // Get the current map
    const mapResult = await apiClient.getCurrentMap();
    if (!mapResult || (!mapResult.mapId && !mapResult.uid && !mapResult.id)) {
      throw new Error(`No current map found for robot ${robotId}`);
    }
    
    // Using apiClient's getAllMapPoints method since it has the implementation
    // to retrieve points from the current map
    const points = await apiClient.getAllMapPoints();
    if (!points || !Array.isArray(points)) {
      const mapId = mapResult.uid || mapResult.id || mapResult.mapId;
      throw new Error(`Could not get map points for robot ${robotId}, map ${mapId}`);
    }
    
    return points;
  } catch (error) {
    console.error(`Error getting map points for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Get filterable lists of points for a robot
 * 
 * @param {string} robotId - The robot's serial number
 * @returns {Promise<Object>} Object containing filtered point lists
 */
export async function getFilteredPoints(robotId) {
  try {
    // Get all points
    const allPoints = await getAllMapPoints(robotId);
    
    // Filter points
    const dropoffPoints = dropoffWorkflow.findDropoffPoints(allPoints);
    const pickupPoints = dropoffWorkflow.findPickupPoints(allPoints);
    const shelfPoints = dropoffWorkflow.findShelfPoints(allPoints);
    const chargingStation = dropoffWorkflow.findChargingStation(allPoints);
    
    // Return filtered points
    return {
      all: allPoints,
      dropoff: dropoffPoints,
      pickup: pickupPoints,
      shelf: shelfPoints,
      charger: chargingStation ? [chargingStation] : []
    };
  } catch (error) {
    console.error(`Error getting filtered points for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Get tasks for a robot
 * 
 * @param {string} robotId - The robot's serial number
 * @param {Object} filter - Filter options
 * @returns {Promise<Array>} List of tasks
 */
export async function getRobotTasks(robotId, filter = {}) {
  try {
    // Get tasks for the robot using the correct method name
    let tasks = await storage.getTasksByRobot(robotId);
    
    // Filter by status if specified
    if (filter.status) {
      tasks = tasks.filter(task => task.status === filter.status);
    }
    
    // Filter by type if specified
    if (filter.type) {
      tasks = tasks.filter(task => task.taskType === filter.type);
    }
    
    // Sort by createdAt (newest first)
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return tasks;
  } catch (error) {
    console.error(`Error getting tasks for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Get task details
 * 
 * @param {string} taskId - The ID of the task
 * @returns {Promise<Object>} The task
 */
export async function getTaskDetails(taskId) {
  try {
    // Get the task using the storage interface method
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    return task;
  } catch (error) {
    console.error(`Error getting task details for task ${taskId}:`, error);
    throw error;
  }
}