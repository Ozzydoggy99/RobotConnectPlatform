import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import { TaskWorkflowFactory } from './task-workflows';
import { Task, TaskType, TaskStatus, TaskPoint } from '@shared/schema';
import { ErrorCode, RobotError, logError } from './errors';

// Create router
const router = Router();

/**
 * Create a new task
 * POST /api/tasks
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      robotId,
      taskType,
      priority,
      points,
      payload,
      runMode,
      runNum
    } = req.body;
    
    // Validate required fields
    if (!robotId) {
      return res.status(400).json({ error: 'Robot ID is required' });
    }
    
    if (!taskType) {
      return res.status(400).json({ error: 'Task type is required' });
    }
    
    if (!points || !Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ error: 'Task must include at least one point' });
    }
    
    // Validate task type
    if (!Object.values(TaskType).includes(taskType)) {
      return res.status(400).json({ 
        error: `Invalid task type. Must be one of: ${Object.values(TaskType).join(', ')}`
      });
    }
    
    // Create task
    const task = await TaskWorkflowFactory.createTask({
      taskId: uuidv4(),
      name: name || `${taskType} Task`,
      robotId,
      taskType: taskType as TaskType,
      priority: priority || 'medium',
      points,
      payload,
      runMode,
      runNum
    });
    
    // Return task
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    
    if (error instanceof RobotError) {
      return res.status(400).json({ 
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all tasks
 * GET /api/tasks
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const tasks = await storage.getAllTasks();
    res.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ 
      error: 'Failed to get tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get active tasks
 * GET /api/tasks/active
 */
router.get('/active', async (_req: Request, res: Response) => {
  try {
    const tasks = await storage.getActiveTasks();
    res.json(tasks);
  } catch (error) {
    console.error('Error getting active tasks:', error);
    res.status(500).json({ 
      error: 'Failed to get active tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get pending tasks
 * GET /api/tasks/pending
 */
router.get('/pending', async (_req: Request, res: Response) => {
  try {
    const tasks = await storage.getPendingTasks();
    res.json(tasks);
  } catch (error) {
    console.error('Error getting pending tasks:', error);
    res.status(500).json({ 
      error: 'Failed to get pending tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get task by ID
 * GET /api/tasks/:taskId
 */
router.get('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: `Task not found: ${taskId}` });
    }
    
    res.json(task);
  } catch (error) {
    console.error(`Error getting task ${req.params.taskId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Start a task
 * POST /api/tasks/:taskId/start
 */
router.post('/:taskId/start', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    // Get task
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: `Task not found: ${taskId}` });
    }
    
    // Validate task status
    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.PAUSED) {
      return res.status(400).json({ 
        error: `Cannot start task with status: ${task.status}`
      });
    }
    
    // Start task execution in background
    TaskWorkflowFactory.executeTask(taskId).catch(error => {
      console.error(`Background task execution error for task ${taskId}:`, error);
    });
    
    // Update status to assigned (will be updated to in_progress when execution starts)
    await storage.updateTaskStatus(taskId, TaskStatus.ASSIGNED);
    
    // Get updated task
    const updatedTask = await storage.getTask(taskId);
    
    res.json({
      success: true,
      message: `Task ${taskId} started`,
      task: updatedTask
    });
  } catch (error) {
    console.error(`Error starting task ${req.params.taskId}:`, error);
    
    if (error instanceof RobotError) {
      return res.status(400).json({ 
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to start task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Pause a task
 * POST /api/tasks/:taskId/pause
 */
router.post('/:taskId/pause', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    // Get task
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: `Task not found: ${taskId}` });
    }
    
    // Validate task status
    if (task.status !== TaskStatus.IN_PROGRESS) {
      return res.status(400).json({ 
        error: `Cannot pause task with status: ${task.status}`
      });
    }
    
    // Update status
    await storage.updateTaskStatus(taskId, TaskStatus.PAUSED);
    
    // Get updated task
    const updatedTask = await storage.getTask(taskId);
    
    res.json({
      success: true,
      message: `Task ${taskId} paused`,
      task: updatedTask
    });
  } catch (error) {
    console.error(`Error pausing task ${req.params.taskId}:`, error);
    res.status(500).json({ 
      error: 'Failed to pause task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel a task
 * POST /api/tasks/:taskId/cancel
 */
router.post('/:taskId/cancel', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    // Get task
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: `Task not found: ${taskId}` });
    }
    
    // Validate task status
    if (task.status === TaskStatus.COMPLETED || 
        task.status === TaskStatus.FAILED || 
        task.status === TaskStatus.CANCELED) {
      return res.status(400).json({ 
        error: `Cannot cancel task with status: ${task.status}`
      });
    }
    
    // Cancel task in background
    TaskWorkflowFactory.cancelTask(taskId).catch(error => {
      console.error(`Background task cancellation error for task ${taskId}:`, error);
    });
    
    // Return success (status will be updated by cancelTask)
    res.json({
      success: true,
      message: `Task ${taskId} cancellation initiated`,
    });
  } catch (error) {
    console.error(`Error canceling task ${req.params.taskId}:`, error);
    
    if (error instanceof RobotError) {
      return res.status(400).json({ 
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to cancel task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a task
 * DELETE /api/tasks/:taskId
 */
router.delete('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    // Get task
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: `Task not found: ${taskId}` });
    }
    
    // Validate task is not active
    if (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.ASSIGNED) {
      return res.status(400).json({ 
        error: `Cannot delete active task. Cancel the task first.`
      });
    }
    
    // Delete task
    await storage.deleteTask(taskId);
    
    res.json({
      success: true,
      message: `Task ${taskId} deleted`
    });
  } catch (error) {
    console.error(`Error deleting task ${req.params.taskId}:`, error);
    res.status(500).json({ 
      error: 'Failed to delete task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get tasks for robot
 * GET /api/tasks/robot/:robotId
 */
router.get('/robot/:robotId', async (req: Request, res: Response) => {
  try {
    const { robotId } = req.params;
    
    const tasks = await storage.getTasksByRobot(robotId);
    
    res.json(tasks);
  } catch (error) {
    console.error(`Error getting tasks for robot ${req.params.robotId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get robot tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get active tasks for robot
 * GET /api/tasks/robot/:robotId/active
 */
router.get('/robot/:robotId/active', async (req: Request, res: Response) => {
  try {
    const { robotId } = req.params;
    
    const tasks = await storage.getActiveTasksByRobot(robotId);
    
    res.json(tasks);
  } catch (error) {
    console.error(`Error getting active tasks for robot ${req.params.robotId}:`, error);
    res.status(500).json({ 
      error: 'Failed to get active robot tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create a task using the direct AutoXing Task API
 * POST /api/tasks/direct
 */
router.post('/direct', async (req: Request, res: Response) => {
  try {
    const {
      robotId,
      name,
      taskType,
      taskPts,
      returnPoint
    } = req.body;
    
    if (!robotId) {
      return res.status(400).json({ error: 'Robot ID is required' });
    }
    
    // Get robot API client
    const { getRobotApiClient } = await import('./direct-api');
    
    try {
      const robotClient = getRobotApiClient(robotId);
      
      // Prepare task data directly for AutoXing API
      const taskData = {
        name: name || `Task ${new Date().toISOString()}`,
        robotId,
        routeMode: 1, // Calculate route in order of task points
        runMode: 1, // Flexible obstacle avoidance
        runNum: 1, // Execute once
        taskType: taskType || 2, // Default to restaurant type
        runType: 21, // Multi-point delivery
        taskPts: taskPts || [],
        backPt: returnPoint || {}
      };
      
      // Create task using direct API
      console.log(`Creating direct task for robot ${robotId} with data:`, JSON.stringify(taskData, null, 2));
      const taskId = await robotClient.createTask(taskData);
      
      // Store task in our database for tracking
      const dbTask = await storage.createTask({
        taskId,
        name: taskData.name,
        robotId,
        taskType: String(taskData.taskType),
        status: 'assigned',
        priority: 'high',
        runMode: taskData.runMode,
        runNum: taskData.runNum,
        points: taskPts.map((pt: any, index: number) => ({
          index,
          x: pt.x,
          y: pt.y,
          poiId: pt.poiId || `point_${index}`,
          areaId: pt.areaId || '',
          type: 'waypoint'
        })),
        returnPoint
      });
      
      // Return success
      res.status(201).json({
        success: true,
        message: `Direct task created with ID ${taskId}`,
        taskId,
        task: dbTask
      });
    } catch (apiError) {
      console.error(`Error with direct API for robot ${robotId}:`, apiError);
      return res.status(500).json({
        error: 'Failed to create task using direct API',
        details: apiError instanceof Error ? apiError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error creating direct task:', error);
    res.status(500).json({
      error: 'Failed to create direct task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get current task status from the robot using direct API
 * GET /api/tasks/robot/:robotId/direct-status
 */
router.get('/robot/:robotId/direct-status', async (req: Request, res: Response) => {
  try {
    const { robotId } = req.params;
    
    // Get robot API client
    const { getRobotApiClient, getRobotTaskStatus } = await import('./direct-api');
    
    try {
      // First check if we have real-time status from WebSocket
      const wsStatus = getRobotTaskStatus(robotId);
      
      if (wsStatus) {
        return res.json({
          source: 'websocket',
          status: wsStatus
        });
      }
      
      // If not, try to get current task from API
      const robotClient = getRobotApiClient(robotId);
      const currentTask = await robotClient.getCurrentTask();
      
      if (currentTask) {
        return res.json({
          source: 'api',
          task: currentTask
        });
      }
      
      // No current task
      return res.json({
        source: 'api',
        task: null
      });
    } catch (apiError) {
      console.error(`Error with direct API for robot ${robotId}:`, apiError);
      return res.status(500).json({
        error: 'Failed to get task status using direct API',
        details: apiError instanceof Error ? apiError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error(`Error getting direct task status for robot ${req.params.robotId}:`, error);
    res.status(500).json({
      error: 'Failed to get direct task status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all tasks from the robot using direct API
 * GET /api/tasks/robot/:robotId/direct-tasks
 */
router.get('/robot/:robotId/direct-tasks', async (req: Request, res: Response) => {
  try {
    const { robotId } = req.params;
    
    // Get robot API client
    const { getRobotApiClient } = await import('./direct-api');
    
    try {
      const robotClient = getRobotApiClient(robotId);
      const tasks = await robotClient.getTasks();
      
      return res.json({
        success: true,
        tasks
      });
    } catch (apiError) {
      console.error(`Error with direct API for robot ${robotId}:`, apiError);
      return res.status(500).json({
        error: 'Failed to get tasks using direct API',
        details: apiError instanceof Error ? apiError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error(`Error getting direct tasks for robot ${req.params.robotId}:`, error);
    res.status(500).json({
      error: 'Failed to get direct tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export router
export default router;