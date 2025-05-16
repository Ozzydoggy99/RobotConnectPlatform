import type { Request, Response } from "express";
import { storage } from "../storage";

// Basic robot endpoints

/**
 * Get all robots
 */
export async function getAllRobots(_req: Request, res: Response) {
  try {
    const robots = await storage.getAllRobots();
    return res.json(robots);
  } catch (error) {
    console.error("Error getting robots:", error);
    return res.status(500).json({ error: "Failed to get robots" });
  }
}

/**
 * Get robot by ID
 */
export async function getRobotById(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    const robot = await storage.getRobot(robotId);
    
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    return res.json(robot);
  } catch (error) {
    console.error("Error getting robot:", error);
    return res.status(500).json({ error: "Failed to get robot" });
  }
}

/**
 * Get robot stats
 */
export async function getRobotStats(_req: Request, res: Response) {
  try {
    const robots = await storage.getAllRobots();
    
    const stats = {
      total: robots.length,
      online: robots.filter(robot => robot.status === 'online').length,
      offline: robots.filter(robot => robot.status === 'offline').length,
      charging: robots.filter(robot => robot.status === 'charging').length,
      error: robots.filter(robot => robot.status === 'error').length,
    };
    
    return res.json(stats);
  } catch (error) {
    console.error("Error getting robot stats:", error);
    return res.status(500).json({ error: "Failed to get robot stats" });
  }
}

/**
 * Get robot status
 */
export async function getRobotStatus(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    const robot = await storage.getRobot(robotId);
    
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    return res.json({
      robotId: robot.robotId,
      status: robot.status,
      batteryLevel: robot.batteryLevel,
      lastSeen: robot.lastSeen,
      error: robot.error,
      errorDetails: robot.errorDetails
    });
  } catch (error) {
    console.error("Error getting robot status:", error);
    return res.status(500).json({ error: "Failed to get robot status" });
  }
}

/**
 * Get robot battery level
 */
export async function getRobotBattery(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    const robot = await storage.getRobot(robotId);
    
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    return res.json({
      robotId: robot.robotId,
      batteryLevel: robot.batteryLevel
    });
  } catch (error) {
    console.error("Error getting robot battery:", error);
    return res.status(500).json({ error: "Failed to get robot battery" });
  }
}

/**
 * Get robot position
 */
export async function getRobotPosition(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    const robot = await storage.getRobot(robotId);
    
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would get the robot's position from the SDK
    
    return res.json({
      robotId: robot.robotId,
      position: {
        x: 0, // Placeholder
        y: 0, // Placeholder
        floor: robot.floor || 'unknown'
      }
    });
  } catch (error) {
    console.error("Error getting robot position:", error);
    return res.status(500).json({ error: "Failed to get robot position" });
  }
}

/**
 * Locate a robot
 */
export async function locateRobot(req: Request, res: Response) {
  try {
    const { robotId } = req.body;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to locate the robot
    
    return res.json({
      robotId: robot.robotId,
      position: {
        x: 0, // Placeholder
        y: 0, // Placeholder
        floor: robot.floor || 'unknown'
      }
    });
  } catch (error) {
    console.error("Error locating robot:", error);
    return res.status(500).json({ error: "Failed to locate robot" });
  }
}

/**
 * Start charging a robot
 */
export async function startCharging(req: Request, res: Response) {
  try {
    const { robotId } = req.body;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to start charging
    await storage.updateRobotStatus(robotId, 'charging');
    
    return res.json({
      robotId: robot.robotId,
      status: 'charging',
      message: 'Robot is now charging'
    });
  } catch (error) {
    console.error("Error starting charging:", error);
    return res.status(500).json({ error: "Failed to start charging" });
  }
}

/**
 * Guide robot to charging station
 */
export async function goToChargingStation(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to guide the robot to a charging station
    
    return res.json({
      robotId: robot.robotId,
      message: 'Robot is moving to charging station'
    });
  } catch (error) {
    console.error("Error guiding to charging station:", error);
    return res.status(500).json({ error: "Failed to guide to charging station" });
  }
}

/**
 * Move robot between floors
 */
export async function moveRobotMultiFloor(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    const { targetFloor, x, y } = req.body;
    
    if (!robotId || !targetFloor || x === undefined || y === undefined) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to move the robot between floors
    await storage.updateRobotStatus(robotId, 'moving');
    await storage.updateRobotPosition(robotId, { x, y, floor: targetFloor });
    
    return res.json({
      robotId: robot.robotId,
      message: `Robot is moving to floor ${targetFloor}`,
      targetPosition: { x, y, floor: targetFloor }
    });
  } catch (error) {
    console.error("Error moving robot between floors:", error);
    return res.status(500).json({ error: "Failed to move robot between floors" });
  }
}

/**
 * Align robot with rack
 */
export async function alignWithRack(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to align the robot with a rack
    
    return res.json({
      robotId: robot.robotId,
      message: 'Robot aligned with rack'
    });
  } catch (error) {
    console.error("Error aligning with rack:", error);
    return res.status(500).json({ error: "Failed to align with rack" });
  }
}

/**
 * Lift rack
 */
export async function liftRack(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to lift a rack
    
    return res.json({
      robotId: robot.robotId,
      message: 'Robot lifted rack'
    });
  } catch (error) {
    console.error("Error lifting rack:", error);
    return res.status(500).json({ error: "Failed to lift rack" });
  }
}

/**
 * Lower rack
 */
export async function lowerRack(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to lower a rack
    
    return res.json({
      robotId: robot.robotId,
      message: 'Robot lowered rack'
    });
  } catch (error) {
    console.error("Error lowering rack:", error);
    return res.status(500).json({ error: "Failed to lower rack" });
  }
}

/**
 * Open robot doors
 */
export async function openDoors(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to open robot doors
    
    return res.json({
      robotId: robot.robotId,
      message: 'Robot doors opened'
    });
  } catch (error) {
    console.error("Error opening doors:", error);
    return res.status(500).json({ error: "Failed to open doors" });
  }
}

/**
 * Close robot doors
 */
export async function closeDoors(req: Request, res: Response) {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({ error: "Missing required robotId parameter" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    // In a real implementation, this would use the SDK to close robot doors
    
    return res.json({
      robotId: robot.robotId,
      message: 'Robot doors closed'
    });
  } catch (error) {
    console.error("Error closing doors:", error);
    return res.status(500).json({ error: "Failed to close doors" });
  }
}

/**
 * Authenticate robot
 */
export async function authenticateRobot(req: Request, res: Response) {
  try {
    const { appId, appSecret } = req.body;
    
    if (!appId || !appSecret) {
      return res.status(400).json({ error: "Missing required authentication parameters" });
    }
    
    // In a real implementation, this would verify the credentials against the SDK
    
    return res.json({
      authenticated: true,
      expires: Date.now() + 3600000 // 1 hour token
    });
  } catch (error) {
    console.error("Error authenticating robot:", error);
    return res.status(500).json({ error: "Failed to authenticate robot" });
  }
}

// Task endpoints
/**
 * Get all tasks
 */
export async function getAllTasks(_req: Request, res: Response) {
  try {
    const tasks = await storage.getAllTasks();
    return res.json(tasks);
  } catch (error) {
    console.error("Error getting tasks:", error);
    return res.status(500).json({ error: "Failed to get tasks" });
  }
}

/**
 * Get active tasks
 */
export async function getActiveTasks(_req: Request, res: Response) {
  try {
    const tasks = await storage.getActiveTasks();
    return res.json(tasks);
  } catch (error) {
    console.error("Error getting active tasks:", error);
    return res.status(500).json({ error: "Failed to get active tasks" });
  }
}

/**
 * Get task stats
 */
export async function getTaskStats(_req: Request, res: Response) {
  try {
    const tasks = await storage.getAllTasks();
    
    const stats = {
      total: tasks.length,
      queued: tasks.filter(task => task.status === 'pending').length,
      inProgress: tasks.filter(task => task.status === 'in_progress').length,
      paused: tasks.filter(task => task.status === 'paused').length,
      completed: tasks.filter(task => task.status === 'completed').length,
      failed: tasks.filter(task => task.status === 'failed').length,
      cancelled: tasks.filter(task => task.status === 'cancelled').length,
    };
    
    return res.json(stats);
  } catch (error) {
    console.error("Error getting task stats:", error);
    return res.status(500).json({ error: "Failed to get task stats" });
  }
}

/**
 * Get task history
 */
export async function getTaskHistory(_req: Request, res: Response) {
  try {
    const tasks = await storage.getTaskHistory();
    return res.json(tasks);
  } catch (error) {
    console.error("Error getting task history:", error);
    return res.status(500).json({ error: "Failed to get task history" });
  }
}

/**
 * Get completed task stats
 */
export async function getCompletedTaskStats(_req: Request, res: Response) {
  try {
    const tasks = await storage.getTaskHistory();
    const completedTasks = tasks.filter(task => task.status === 'completed');
    
    // Group by day
    const tasksByDay = completedTasks.reduce((acc: any, task) => {
      const date = new Date(task.completedAt || Date.now()).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(task);
      return acc;
    }, {});
    
    // Calculate stats by day
    const stats = Object.entries(tasksByDay).map(([date, tasks]: [string, any]) => ({
      date,
      count: tasks.length,
      types: {
        dropoff: tasks.filter((t: any) => t.taskType === 'dropoff').length,
        pickup: tasks.filter((t: any) => t.taskType === 'pickup').length,
        other: tasks.filter((t: any) => t.taskType !== 'dropoff' && t.taskType !== 'pickup').length
      }
    }));
    
    return res.json(stats);
  } catch (error) {
    console.error("Error getting completed task stats:", error);
    return res.status(500).json({ error: "Failed to get completed task stats" });
  }
}

/**
 * Create a task
 */
export async function createTask(req: Request, res: Response) {
  try {
    const { robotId, name, taskType, points, priority } = req.body;
    
    if (!robotId || !name || !taskType || !points || !points.length) {
      return res.status(400).json({ error: "Missing required task parameters" });
    }
    
    const robot = await storage.getRobot(robotId);
    if (!robot) {
      return res.status(404).json({ error: "Robot not found" });
    }
    
    const task = await storage.createTask({
      taskId: `TASK-${Date.now()}`,
      robotId,
      name,
      taskType,
      status: 'pending',
      priority: priority || 'normal',
      points,
      speed: 1.0,
      runMode: 0,
      runNum: 1,
    });
    
    return res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    return res.status(500).json({ error: "Failed to create task" });
  }
}

/**
 * Pause a task
 */
export async function pauseTask(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    if (task.status !== 'in_progress') {
      return res.status(400).json({ error: "Task cannot be paused from its current state" });
    }
    
    await storage.updateTaskStatus(taskId, 'paused');
    
    return res.json({ message: "Task paused successfully" });
  } catch (error) {
    console.error("Error pausing task:", error);
    return res.status(500).json({ error: "Failed to pause task" });
  }
}

/**
 * Resume a task
 */
export async function resumeTask(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    if (task.status !== 'paused') {
      return res.status(400).json({ error: "Task cannot be resumed from its current state" });
    }
    
    await storage.updateTaskStatus(taskId, 'in_progress');
    
    return res.json({ message: "Task resumed successfully" });
  } catch (error) {
    console.error("Error resuming task:", error);
    return res.status(500).json({ error: "Failed to resume task" });
  }
}

/**
 * Retry a failed task
 */
export async function retryTask(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    if (task.status !== 'failed') {
      return res.status(400).json({ error: "Only failed tasks can be retried" });
    }
    
    await storage.updateTaskStatus(taskId, 'pending');
    
    return res.json({ message: "Task set for retry" });
  } catch (error) {
    console.error("Error retrying task:", error);
    return res.status(500).json({ error: "Failed to retry task" });
  }
}

/**
 * Pause all active tasks
 */
export async function pauseAllTasks(_req: Request, res: Response) {
  try {
    const activeTasks = await storage.getActiveTasks();
    
    // Only pause tasks that are in progress
    const inProgressTasks = activeTasks.filter(task => task.status === 'in_progress');
    
    for (const task of inProgressTasks) {
      await storage.updateTaskStatus(task.taskId, 'paused');
    }
    
    return res.json({ 
      message: `Paused ${inProgressTasks.length} tasks`,
      pausedTasks: inProgressTasks.length
    });
  } catch (error) {
    console.error("Error pausing all tasks:", error);
    return res.status(500).json({ error: "Failed to pause all tasks" });
  }
}

// Alert endpoints
/**
 * Get all alerts
 */
export async function getAllAlerts(_req: Request, res: Response) {
  try {
    const alerts = await storage.getAllErrorLogs();
    return res.json(alerts);
  } catch (error) {
    console.error("Error getting alerts:", error);
    return res.status(500).json({ error: "Failed to get alerts" });
  }
}

/**
 * Get recent alerts
 */
export async function getRecentAlerts(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const alerts = await storage.getRecentErrorLogs(limit);
    return res.json(alerts);
  } catch (error) {
    console.error("Error getting recent alerts:", error);
    return res.status(500).json({ error: "Failed to get recent alerts" });
  }
}

/**
 * Get alert stats
 */
export async function getAlertStats(_req: Request, res: Response) {
  try {
    const alerts = await storage.getAllErrorLogs();
    
    const stats = {
      total: alerts.length,
      open: alerts.filter(alert => !alert.resolved).length,
      resolved: alerts.filter(alert => alert.resolved).length,
      priority: alerts.filter(alert => alert.priority).length
    };
    
    return res.json(stats);
  } catch (error) {
    console.error("Error getting alert stats:", error);
    return res.status(500).json({ error: "Failed to get alert stats" });
  }
}

/**
 * Resolve alert
 */
export async function resolveAlert(req: Request, res: Response) {
  try {
    const { alertId } = req.params;
    const id = parseInt(alertId);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }
    
    const success = await storage.resolveErrorLog(id);
    
    if (!success) {
      return res.status(404).json({ error: "Alert not found or already resolved" });
    }
    
    return res.json({ message: "Alert resolved successfully" });
  } catch (error) {
    console.error("Error resolving alert:", error);
    return res.status(500).json({ error: "Failed to resolve alert" });
  }
}

// Map endpoints
/**
 * Get all maps
 */
export async function getAllMaps(_req: Request, res: Response) {
  try {
    const maps = await storage.getAllMaps();
    return res.json(maps);
  } catch (error) {
    console.error("Error getting maps:", error);
    return res.status(500).json({ error: "Failed to get maps" });
  }
}

/**
 * Create a map
 */
export async function createMap(req: Request, res: Response) {
  try {
    const { name, floor, areaId, building, isActive } = req.body;
    
    if (!name || !floor || !areaId) {
      return res.status(400).json({ error: "Missing required map parameters" });
    }
    
    const map = await storage.createMap({
      name,
      floor,
      areaId,
      building: building || null,
      isActive: isActive !== undefined ? isActive : true
    });
    
    return res.status(201).json(map);
  } catch (error) {
    console.error("Error creating map:", error);
    return res.status(500).json({ error: "Failed to create map" });
  }
}

/**
 * Get all POIs
 */
export async function getAllPois(_req: Request, res: Response) {
  try {
    const pois = await storage.getAllPois();
    return res.json(pois);
  } catch (error) {
    console.error("Error getting POIs:", error);
    return res.status(500).json({ error: "Failed to get POIs" });
  }
}

/**
 * Create a POI
 */
export async function createPoi(req: Request, res: Response) {
  try {
    const { name, type, x, y, floor, areaId, yaw, poiId, metadata } = req.body;
    
    if (!name || !type || x === undefined || y === undefined || !areaId || !poiId) {
      return res.status(400).json({ error: "Missing required POI parameters" });
    }
    
    const poi = await storage.createPoi({
      name,
      type,
      x,
      y,
      floor: floor || null,
      areaId,
      yaw: yaw || null,
      poiId,
      metadata: metadata || null
    });
    
    return res.status(201).json(poi);
  } catch (error) {
    console.error("Error creating POI:", error);
    return res.status(500).json({ error: "Failed to create POI" });
  }
}