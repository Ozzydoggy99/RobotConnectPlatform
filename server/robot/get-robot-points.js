// Module to retrieve actual points from the robot's map
import * as directApi from './direct-api.js';
import { storage } from '../storage';

/**
 * Get the actual points from the robot's current map
 * @param {string} robotId - Robot ID
 * @returns {Promise<Array>} - List of points on the robot's current map
 */
export async function getRobotMapPoints(robotId) {
  try {
    console.log(`Retrieving map points for robot ${robotId}...`);
    
    // Get robot information from database
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      throw new Error(`Robot ${robotId} not found`);
    }
    
    // Get the robot's current floor
    const floor = robot.floor || 'Floor1';
    
    // Use the direct API to get actual points from the robot's map
    const points = await directApi.getActualFloorPoints(robotId, floor);
    
    console.log(`Retrieved ${points?.length || 0} points from robot ${robotId}'s map`);
    return points || [];
  } catch (error) {
    console.error(`Error retrieving map points for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Get points of specific type from robot's map
 * @param {string} robotId - Robot ID
 * @param {string} pointType - Type of point (e.g., "charger", "shelf", etc.)
 * @returns {Promise<Array>} - List of points of specified type
 */
export async function getPointsByType(robotId, pointType) {
  try {
    const allPoints = await getRobotMapPoints(robotId);
    return allPoints.filter(point => 
      point.type.toLowerCase() === pointType.toLowerCase()
    );
  } catch (error) {
    console.error(`Error retrieving ${pointType} points for robot ${robotId}:`, error);
    throw error;
  }
}

/**
 * Get all charging points for a robot
 * @param {string} robotId - Robot ID
 * @returns {Promise<Array>} - List of charging points
 */
export async function getChargingPoints(robotId) {
  return getPointsByType(robotId, 'charger');
}

/**
 * Get all shelf points for a robot
 * @param {string} robotId - Robot ID
 * @returns {Promise<Array>} - List of shelf points
 */
export async function getShelfPoints(robotId) {
  return getPointsByType(robotId, 'shelf');
}

/**
 * Update database with points from robot's map
 * @param {string} robotId - Robot ID
 * @returns {Promise<{success: boolean, count: number}>} - Result with count of points updated
 */
export async function updateDatabaseWithRobotPoints(robotId) {
  try {
    console.log(`Updating database with points from robot ${robotId}'s map...`);
    
    // Get points from robot's map
    const points = await getRobotMapPoints(robotId);
    if (!points || points.length === 0) {
      return { success: false, count: 0, message: 'No points found on robot map' };
    }
    
    let updatedCount = 0;
    
    // Update each point in the database
    for (const point of points) {
      try {
        // First check if the point already exists
        const existingPoint = await storage.getPoi(point.poiId);
        
        if (existingPoint) {
          // Update existing point - would need to implement updatePoi in storage
          console.log(`Point ${point.name} (${point.poiId}) already exists in database`);
        } else {
          // Create new point
          await storage.createPoi({
            name: point.name,
            type: point.type,
            poiId: point.poiId,
            x: point.x,
            y: point.y,
            yaw: point.yaw || 0,
            areaId: point.areaId,
            floor: point.floor,
            metadata: point.metadata
          });
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating point ${point.name} (${point.poiId}):`, error);
      }
    }
    
    console.log(`Updated ${updatedCount} points in database from robot ${robotId}'s map`);
    return { success: true, count: updatedCount };
  } catch (error) {
    console.error(`Error updating database with robot ${robotId}'s map points:`, error);
    throw error;
  }
}