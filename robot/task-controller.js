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
 * This ensures we use the correct method from storage
 */
async function getTaskFromStorage(taskId) {
  return await storage.getTask(taskId);
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
    
    // Generate and return the dropoff task
    return await dropoffWorkflow.generateDropoffTask(
      robotId, 
      dropoffPoint, 
      shelfPoint, 
      returnPoint,
      options
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