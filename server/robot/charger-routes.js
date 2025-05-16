/**
 * AutoXing Robot Charger Routes
 * 
 * This module implements API routes for robot charging operations
 * using the specialized charger action commands
 */

import express from 'express';
import { executeChargerWorkflow, getChargingStatus, undockFromCharger } from './charger-actions.js';
import { getRobotApiClient } from './direct-api.js';

const router = express.Router();

/**
 * Send robot to charger
 * POST /api/robot/charger/return
 * Request body: { robotId, chargerPoint }
 */
router.post('/charger/return', async (req, res) => {
  try {
    const { robotId, chargerPoint } = req.body;
    
    if (!robotId || !chargerPoint) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Start the return to charger workflow
    const taskId = `charge-${Date.now()}`;
    
    // Execute workflow in background
    executeChargerWorkflow(robotId, chargerPoint)
      .then(result => {
        console.log(`Return to charger task ${taskId} completed with status: ${result.success ? 'success' : 'failure'}`);
      })
      .catch(err => {
        console.error(`Error in return to charger task ${taskId}:`, err);
      });
    
    // Return immediately with task ID for tracking
    res.json({ 
      taskId,
      status: 'created',
      message: 'Return to charger task created and started'
    });
  } catch (error) {
    console.error('Error creating return to charger task:', error);
    res.status(500).json({ error: 'Failed to create return to charger task' });
  }
});

/**
 * Get robot charging status
 * GET /api/robot/charger/status/:robotId
 */
router.get('/charger/status/:robotId', async (req, res) => {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({ error: 'Missing robot ID' });
    }
    
    // Get charging status
    const status = await getChargingStatus(robotId);
    
    res.json(status);
  } catch (error) {
    console.error(`Error getting charging status for robot ${req.params.robotId}:`, error);
    res.status(500).json({ error: 'Failed to get charging status' });
  }
});

/**
 * Cancel a robot charging task
 * POST /api/robot/charger/cancel
 * Request body: { robotId, taskId }
 */
router.post('/charger/cancel', async (req, res) => {
  try {
    const { robotId, taskId } = req.body;
    
    if (!robotId) {
      return res.status(400).json({ error: 'Missing robot ID' });
    }
    
    const robot = getRobotApiClient(robotId);
    
    if (!robot) {
      return res.status(404).json({ error: `Robot ${robotId} not found` });
    }
    
    // Cancel the current move action
    await robot.moveApi.patch('/chassis/moves/current', { state: 'cancelled' });
    
    res.json({ 
      taskId: taskId || `charge-cancelled-${Date.now()}`,
      status: 'cancelled',
      message: 'Charging task cancelled successfully' 
    });
  } catch (error) {
    console.error(`Error cancelling charging task:`, error);
    res.status(500).json({ error: 'Failed to cancel charging task' });
  }
});

/**
 * Undock robot from charger
 * POST /api/robot/:robotId/undock
 */
router.post('/:robotId/undock', async (req, res) => {
  try {
    const { robotId } = req.params;
    
    if (!robotId) {
      return res.status(400).json({ error: 'Missing robot ID' });
    }
    
    console.log(`Received undock request for robot ${robotId}`);
    
    // Execute the undock operation
    const result = await undockFromCharger(robotId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        actionId: result.actionId || null
      });
    } else {
      console.error(`Failed to undock robot ${robotId}:`, result.message);
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error || 'Unknown error during undocking'
      });
    }
  } catch (error) {
    console.error(`Error undocking robot ${req.params.robotId}:`, error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to undock robot from charger',
      error: error.message
    });
  }
});

export default router;