import { Request, Response } from 'express';
import { storage } from '../storage';
import { errorResponse } from './errors';
import { 
  configureRobot, 
  initializeRobotConnection, 
  sendRobotCommand, 
  getRobotStatus as fetchRobotStatus,
  moveRobotToPosition,
  stopRobot as haltRobot
} from './connection';

/**
 * Configure robot connection details
 */
export async function configureRobotConnection(req: Request, res: Response) {
  try {
    const { robotId, publicIp, localIp, port } = req.body;
    
    if (!robotId) {
      return res.status(400).json({
        error: true,
        message: 'Robot ID is required'
      });
    }
    
    // Configure robot connection
    configureRobot(robotId, {
      publicIp: publicIp || '47.180.91.99',
      localIp: localIp || '192.168.4.31',
      port: port || 80
    });
    
    return res.json({
      success: true,
      message: `Robot ${robotId} connection configured successfully`
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

/**
 * Connect to robot
 */
export async function connectToRobot(req: Request, res: Response) {
  try {
    const { robotId, apiKey } = req.body;
    
    if (!robotId) {
      return res.status(400).json({
        error: true,
        message: 'Robot ID is required'
      });
    }
    
    // Initialize connection
    const connected = await initializeRobotConnection(robotId, apiKey);
    
    if (!connected) {
      return res.status(503).json({
        error: true,
        message: `Failed to connect to robot ${robotId}`
      });
    }
    
    // Get robot info to store in our system
    try {
      const robotInfo = await fetchRobotStatus(robotId);
      
      // Check if robot exists in our database
      const existingRobot = await storage.getRobot(robotId);
      
      if (existingRobot) {
        // Update robot data
        await storage.updateRobot(robotId, {
          status: 'online',
          lastSeen: new Date(),
          batteryLevel: robotInfo.batteryLevel || existingRobot.batteryLevel,
          floor: robotInfo.floor || existingRobot.floor
        });
      } else {
        // Create new robot entry
        await storage.createRobot({
          robotId,
          name: `Robot ${robotId}`,
          status: 'online',
          lastSeen: new Date(),
          batteryLevel: robotInfo.batteryLevel || 100,
          floor: robotInfo.floor || null
        });
      }
    } catch (error) {
      console.warn(`Couldn't fetch detailed robot info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return res.json({
      success: true,
      message: `Successfully connected to robot ${robotId}`
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

/**
 * Move robot to position
 */
export async function moveRobot(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    const { x, y, yaw, speed, areaId } = req.body;
    
    if (!robotId || x === undefined || y === undefined) {
      return res.status(400).json({
        error: true,
        message: 'Robot ID, x, and y are required'
      });
    }
    
    // Move robot
    const result = await moveRobotToPosition(robotId, x, y, yaw, speed);
    
    // Update robot status in our system
    await storage.updateRobot(robotId, {
      status: 'busy',
      lastSeen: new Date()
    });
    
    return res.json({
      success: true,
      message: `Robot ${robotId} is moving to (${x}, ${y})`,
      result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

/**
 * Stop robot
 */
export async function stopRobot(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({
        error: true,
        message: 'Robot ID is required'
      });
    }
    
    // Stop robot
    const result = await haltRobot(robotId);
    
    // Update robot status in our system
    await storage.updateRobot(robotId, {
      status: 'online',
      lastSeen: new Date()
    });
    
    return res.json({
      success: true,
      message: `Robot ${robotId} has been stopped`,
      result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

/**
 * Execute robot action
 */
export async function executeRobotAction(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    const { action, params } = req.body;
    
    if (!robotId || !action) {
      return res.status(400).json({
        error: true,
        message: 'Robot ID and action are required'
      });
    }
    
    // Execute action
    const result = await sendRobotCommand(robotId, `/api/action`, 'POST', {
      type: action,
      ...params
    });
    
    // Update robot status in our system
    await storage.updateRobot(robotId, {
      status: 'busy',
      lastSeen: new Date()
    });
    
    return res.json({
      success: true,
      message: `Robot ${robotId} is executing action: ${action}`,
      result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}