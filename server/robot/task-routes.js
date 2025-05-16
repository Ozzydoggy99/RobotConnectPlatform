/**
 * Task Routes
 * 
 * API routes for robot task management
 */

import express from 'express';
import * as taskController from './task-controller.js';

// Initialize router
const router = express.Router();

/**
 * Get all tasks for a robot
 * 
 * GET /api/robot/:robotId/tasks
 */
router.get('/:robotId/tasks', async (req, res) => {
  try {
    const { robotId } = req.params;
    const { status, type } = req.query;
    
    // Create filter from query params
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    
    const tasks = await taskController.getRobotTasks(robotId, filter);
    res.json(tasks);
  } catch (error) {
    console.error(`Error getting tasks for robot:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get task details
 * 
 * GET /api/robot/:robotId/tasks/:taskId
 */
router.get('/:robotId/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await taskController.getTaskDetails(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    console.error(`Error getting task details:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a dropoff task
 * 
 * POST /api/robot/:robotId/tasks/dropoff
 * 
 * Request body:
 * {
 *   "dropoffPointId": "001_load",
 *   "shelfPointId": "115_load",
 *   "priority": "high" (optional)
 * }
 */
router.post('/:robotId/tasks/dropoff', async (req, res) => {
  try {
    const { robotId } = req.params;
    const { dropoffPointId, shelfPointId, priority } = req.body;
    
    if (!dropoffPointId || !shelfPointId) {
      return res.status(400).json({ 
        error: 'dropoffPointId and shelfPointId are required' 
      });
    }
    
    // Create options object
    const options = {
      priority: priority || 'normal',
      origin: 'api',
      originatorId: req.headers['x-user-id'] || null
    };
    
    const task = await taskController.createDropoffTask(
      robotId, 
      dropoffPointId, 
      shelfPointId, 
      options
    );
    
    res.status(201).json(task);
  } catch (error) {
    console.error(`Error creating dropoff task:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute the next step of a task
 * 
 * POST /api/robot/:robotId/tasks/:taskId/execute
 */
router.post('/:robotId/tasks/:taskId/execute', async (req, res) => {
  try {
    const { robotId, taskId } = req.params;
    const task = await taskController.executeTaskStep(robotId, taskId);
    res.json(task);
  } catch (error) {
    console.error(`Error executing task step:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel a task
 * 
 * POST /api/robot/:robotId/tasks/:taskId/cancel
 */
router.post('/:robotId/tasks/:taskId/cancel', async (req, res) => {
  try {
    const { robotId, taskId } = req.params;
    const task = await taskController.cancelTask(robotId, taskId);
    res.json(task);
  } catch (error) {
    console.error(`Error cancelling task:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get filterable lists of points for a robot
 * 
 * GET /api/robot/:robotId/points
 */
router.get('/:robotId/points', async (req, res) => {
  try {
    const { robotId } = req.params;
    const points = await taskController.getFilteredPoints(robotId);
    res.json(points);
  } catch (error) {
    console.error(`Error getting filtered points:`, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;