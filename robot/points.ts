import { storage } from '../storage';
import { Poi } from '@shared/schema';
import axios from 'axios';

/**
 * Get points from a specific robot's map using the official API via direct-api.js
 */
import * as directApi from './direct-api.js';

export async function getFloorPoints(floorId: string, robotId: string): Promise<any[]> {
  try {
    console.log(`Getting points for robot SN:${robotId} on floor ${floorId} via API`);
    
    // Get the robot's configuration
    const robot = await storage.getRobot(robotId);
    if (!robot || !robot.metadata?.connectionConfig) {
      throw new Error(`Robot SN:${robotId} not found or not configured properly`);
    }
    
    // Create API client if it doesn't already exist
    const apiClient = directApi.createRobotApiClient(
      robotId,
      robot.metadata.connectionConfig.publicIp,
      8090, // Always use port 8090 for all AutoXing robots
      process.env.AUTOXING_SDK_API_KEY || '667a51a4d948433081a272c78d10a8a4'
    );
    
    // Use the unified method to get all points from the map
    const points = await apiClient.getAllMapPoints();
    
    if (!points || points.length === 0) {
      console.warn(`No points found on map for robot ${robotId}`);
      return [];
    } else {
      console.log(`Successfully retrieved ${points.length} points from robot ${robotId}'s map`);
    }
    
    // Map points to our database structure
    const formattedPoints = points.map(point => {
      return {
        id: point.id,
        name: point.name,
        type: point.type,
        poiId: point.poiId,
        x: point.x,
        y: point.y,
        yaw: point.yaw,
        areaId: point.areaId || floorId,
        floor: point.floor || floorId,
        metadata: point.metadata || {}
      };
    });
    
    console.log(`Extracted ${formattedPoints.length} POIs for floor ${floorId} from robot ${robotId}`);
    
    return formattedPoints;
  } catch (error: any) {
    console.error(`Failed to get floor points from robot API for robot ${robotId} on floor ${floorId}`, error);
    console.error('Error details:', error.response?.data || error);
    
    // Don't use fallbacks - we need to indicate failure clearly
    throw new Error(`Failed to get points from robot ${robotId}: ${error.message}`);
  }
}

/**
 * Fetch all robot points and store them in the database
 */
export async function fetchAndStoreAllPoints(robotId: string): Promise<{ success: boolean; count: number }> {
  try {
    // Get robot information from the database
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      throw new Error(`Robot ${robotId} not found`);
    }
    
    // Use the floor from the robot's configuration
    const floorId = robot.floor || 'Floor1';
    
    // Get the points directly from the robot
    const points = await getFloorPoints(floorId, robotId);
    
    if (!points || points.length === 0) {
      throw new Error(`No points found for robot ${robotId} on floor ${floorId}`);
    }
    
    // Store the points in the database
    let storedCount = 0;
    for (const point of points) {
      try {
        // Since we don't have getPoiByPoiId yet, we'll just create POIs
        // and catch any duplicates at the database level
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
        storedCount++;
      } catch (error) {
        console.error(`Error storing point ${point.name}:`, error);
      }
    }
    
    console.log(`Successfully stored ${storedCount} points for robot ${robotId}`);
    return { success: true, count: storedCount };
  } catch (error: any) {
    console.error(`Failed to fetch and store points for robot ${robotId}:`, error);
    return { success: false, count: 0 };
  }
}