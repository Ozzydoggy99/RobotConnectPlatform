import type { Request, Response } from "express";
import { storage } from "../storage";
import * as directApi from './direct-api';

/**
 * Configure robot connection settings
 */
export async function configureRobotConnection(req: Request, res: Response) {
  try {
    const { robotId, publicIp, localIp, port, useSsl, appCode, appSecret, appId } = req.body;
    
    if (!robotId || !publicIp) {
      return res.status(400).json({ error: "Missing required connection parameters" });
    }
    
    const config = {
      publicIp,
      localIp: localIp || publicIp,
      port: port || 8090, // AutoXing robots use port 8090 by default
      useSsl: useSsl || false,
      wsPort: 8090, // WebSocket also uses port 8090
      appCode: appCode || '667a51a4d948433081a272c78d10a8a4', // Default for our test robot
      appSecret: appSecret || '',
      appId: appId || ''
    };
    
    // Configure robot in the DirectApi module
    directApi.configureRobot(robotId, config);
    console.log(`Robot ${robotId} configured with:`, config);
    
    // Store in database with proper metadata format
    try {
      await storage.updateRobotMetadata(robotId, { connectionConfig: config });
      console.log(`Saved connection configuration to database for robot ${robotId}`);
    } catch (dbError) {
      console.error(`Failed to save configuration to database: ${dbError}`);
    }
    
    return res.json({ message: "Robot connection configured", robotId, config: {
      publicIp: config.publicIp,
      port: config.port,
      wsPort: config.wsPort
    }}); // Don't return sensitive information like appCode
  } catch (error) {
    console.error("Error configuring robot connection:", error);
    return res.status(500).json({ error: "Failed to configure robot connection" });
  }
}

/**
 * Connect to a robot
 */
export async function connectToRobot(req: Request, res: Response) {
  try {
    const { robotId } = req.body;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const config = robotConfigs.get(robotId);
    if (!config) {
      return res.status(404).json({ error: "Robot connection not configured" });
    }
    
    // In a real implementation, this would use the SDK to connect to the robot
    // For demo purposes, we'll simulate a successful connection
    
    return res.json({ message: "Connected to robot", robotId, status: "connected" });
  } catch (error) {
    console.error("Error connecting to robot:", error);
    return res.status(500).json({ error: "Failed to connect to robot" });
  }
}

/**
 * Initialize a robot
 */
export async function initializeRobot(req: Request, res: Response) {
  try {
    const { robotId } = req.body;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    // In a real implementation, this would use the SDK to initialize the robot
    // For demo purposes, we'll simulate a successful initialization
    
    return res.json({ message: "Robot initialized", robotId, status: "initialized" });
  } catch (error) {
    console.error("Error initializing robot:", error);
    return res.status(500).json({ error: "Failed to initialize robot" });
  }
}

/**
 * Get status of all robots
 */
export async function getRobotsStatus(_req: Request, res: Response) {
  try {
    const robots = await storage.getAllRobots();
    const statusResponse = robots.map(robot => ({
      robotId: robot.robotId,
      name: robot.name,
      status: robot.status,
      batteryLevel: robot.batteryLevel,
      lastSeen: robot.lastSeen
    }));
    
    return res.json(statusResponse);
  } catch (error) {
    console.error("Error getting robots status:", error);
    return res.status(500).json({ error: "Failed to get robots status" });
  }
}

/**
 * Move robot to a location
 */
export async function moveRobot(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    const { x, y, areaId, yaw, speed } = req.body;
    
    if (!robotId || x === undefined || y === undefined || !areaId) {
      return res.status(400).json({ error: "Missing required movement parameters" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to move the robot
    // For demo purposes, we'll update the robot's position in the database
    
    await storage.updateRobotPosition(robotId, { x, y, floor: areaId });
    
    return res.json({ 
      message: "Robot movement initiated", 
      robotId, 
      position: { x, y, areaId, yaw: yaw || 0 },
      speed: speed || 1.0
    });
  } catch (error) {
    console.error("Error moving robot:", error);
    return res.status(500).json({ error: "Failed to move robot" });
  }
}

/**
 * Stop robot
 */
export async function stopRobot(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to stop the robot
    // For demo purposes, we'll just return a success response
    
    return res.json({ message: "Robot stopped", robotId });
  } catch (error) {
    console.error("Error stopping robot:", error);
    return res.status(500).json({ error: "Failed to stop robot" });
  }
}

/**
 * Execute a robot action
 */
export async function executeRobotAction(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    const { action, params } = req.body;
    
    if (!robotId || !action) {
      return res.status(400).json({ error: "Missing required action parameters" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to execute the action
    // For demo purposes, we'll just return a success response
    
    return res.json({ 
      message: `Robot action ${action} executed`, 
      robotId,
      action,
      params: params || {}
    });
  } catch (error) {
    console.error("Error executing robot action:", error);
    return res.status(500).json({ error: "Failed to execute robot action" });
  }
}