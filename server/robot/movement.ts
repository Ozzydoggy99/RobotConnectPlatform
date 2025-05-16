import { storage } from '../storage';
import { RobotError, ErrorCode, logError } from './errors';
import * as sdk from './sdk';
import { TaskPoint, StepAction } from '@shared/schema';
import * as directApi from './direct-api';

// Command types for different movement operations
export interface MoveCommand {
  robotId: string;
  points: TaskPoint[];
  runMode?: number;
  runType?: number;
  routeMode?: number;
  ignorePublicSite?: boolean;
  speed?: number;
  type?: string; // 'standard', 'charge', 'along_given_route', etc.
  accuracy?: number; // Target accuracy in meters
}

export interface StopCommand {
  robotId: string;
  emergency?: boolean;
}

export interface ChargingCommand {
  robotId: string;
  floorId?: string;
}

export interface PoseCommand {
  robotId: string;
  x: number;
  y: number;
  yaw: number;
  adjustPosition?: boolean;
}

export interface MapCommand {
  robotId: string;
  mapId: string | number;
}

// Movement operations module
export class MovementModule {
  /**
   * Set robot's current map
   */
  static async setRobotMap(command: MapCommand): Promise<boolean> {
    try {
      // Verify robot availability
      await sdk.verifyRobotAvailability(command.robotId);
      
      // Get robot information
      const robot = await storage.getRobot(command.robotId);
      
      if (!robot) {
        throw new RobotError(`Robot not found: ${command.robotId}`, ErrorCode.ROBOT_UNAVAILABLE);
      }
      
      // Set current map using AutoXing API
      const setMapResult = await directApi.setCurrentMap(command.robotId, command.mapId);
      
      if (setMapResult.code !== 0) {
        throw new RobotError(`Failed to set map: ${setMapResult.message || 'Unknown error'}`, ErrorCode.MAP_OPERATION_FAILED);
      }
      
      // Update robot's map information in our database if needed
      const mapObj = await storage.getMap(command.mapId.toString());
      if (mapObj) {
        await storage.updateRobotStatus(command.robotId, robot.status || 'online', robot.batteryLevel || null, mapObj.floor);
      }
      
      return true;
    } catch (error) {
      logError(`Failed to set map for robot ${command.robotId}`, error);
      throw new RobotError(
        `Failed to set map: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.MAP_OPERATION_FAILED
      );
    }
  }
  
  /**
   * Set robot's pose (position)
   */
  static async setRobotPose(command: PoseCommand): Promise<boolean> {
    try {
      // Verify robot availability
      await sdk.verifyRobotAvailability(command.robotId);
      
      // Set pose using AutoXing API
      const setPoseResult = await directApi.setRobotPose(
        command.robotId, 
        command.x, 
        command.y, 
        command.yaw,
        command.adjustPosition !== undefined ? command.adjustPosition : true
      );
      
      if (setPoseResult.code !== 0) {
        throw new RobotError(`Failed to set pose: ${setPoseResult.message || 'Unknown error'}`, ErrorCode.ROBOT_OPERATION_FAILED);
      }
      
      // Update robot position in our database
      await storage.updateRobotPosition(command.robotId, {
        x: command.x,
        y: command.y,
        floor: (await storage.getRobot(command.robotId))?.floor || 'Floor1'
      });
      
      return true;
    } catch (error) {
      logError(`Failed to set pose for robot ${command.robotId}`, error);
      throw new RobotError(
        `Failed to set pose: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.ROBOT_OPERATION_FAILED
      );
    }
  }
  /**
   * Move robot to a series of points
   */
  static async moveRobot(command: MoveCommand): Promise<boolean> {
    try {
      // First verify robot availability
      await sdk.verifyRobotAvailability(command.robotId);
      
      // Check if the points are valid
      if (!command.points || command.points.length === 0) {
        throw new RobotError('No points provided for movement', ErrorCode.INVALID_POINT);
      }
      
      // Generate a task ID for this movement
      const taskId = sdk.generateTaskId();
      
      // Create a task in the database
      await storage.createTask({
        taskId,
        name: `Movement_${new Date().toISOString()}`,
        robotId: command.robotId,
        status: 'pending',
        taskType: 'movement',
        priority: 'normal',
        runMode: command.runMode || 0,
        runType: command.runType || 0,
        routeMode: command.routeMode || 1,
        ignorePublicSite: command.ignorePublicSite || false,
        speed: command.speed || -1,
        points: command.points,
        currentPoint: null,
        returnPoint: null
      });
      
      // Using AutoXing direct API to move the robot
      const firstPoint = command.points[0];
      
      // Create move action for the first point
      const moveResult = await directApi.createMoveAction(command.robotId, {
        x: firstPoint.x,
        y: firstPoint.y,
        yaw: firstPoint.yaw,
        type: command.type || 'standard',
        speed: command.speed,
        accuracy: command.accuracy || 0.2
      });
      
      // If we have more than one point, we'll need to queue the next moves
      // and monitor the current move's progress
      if (command.points.length > 1) {
        // Start a WebSocket connection to monitor progress
        return await new Promise((resolve, reject) => {
          let pointIndex = 0;
          let timeout: NodeJS.Timeout;
          
          const moveToNextPoint = async () => {
            pointIndex++;
            if (pointIndex < command.points.length) {
              const nextPoint = command.points[pointIndex];
              try {
                // Update the current point in the database
                await storage.updateTaskCurrentPoint(taskId, nextPoint);
                
                // Create the next move action
                await directApi.createMoveAction(command.robotId, {
                  x: nextPoint.x,
                  y: nextPoint.y,
                  yaw: nextPoint.yaw,
                  type: command.type || 'standard',
                  accuracy: command.accuracy || 0.2
                });
              } catch (error) {
                logError(`Failed to move to next point for robot ${command.robotId}`, error);
                clearTimeout(timeout);
                disconnectSocket();
                reject(new RobotError(`Failed to move to next point: ${error instanceof Error ? error.message : 'Unknown error'}`, ErrorCode.MOVEMENT_FAILED));
              }
            } else {
              // All points completed
              clearTimeout(timeout);
              disconnectSocket();
              resolve(true);
            }
          };
          
          const planningStateHandler = (message) => {
            if (message.topic === '/planning_state') {
              if (message.move_state === 'succeeded' && pointIndex < command.points.length) {
                moveToNextPoint();
              } else if (message.move_state === 'failed' || message.move_state === 'cancelled') {
                clearTimeout(timeout);
                disconnectSocket();
                reject(new RobotError(`Movement failed or cancelled: ${message.fail_reason_str || 'Unknown reason'}`, ErrorCode.MOVEMENT_FAILED));
              }
            }
          };
          
          const ws = directApi.connectToRobotWebSocket(command.robotId, ['/planning_state'], planningStateHandler);
          
          const disconnectSocket = () => {
            try {
              directApi.disconnectRobotWebSocket(command.robotId);
            } catch (e) {
              console.warn(`Error disconnecting WebSocket: ${e.message}`);
            }
          };
          
          // Set a timeout to prevent hanging
          timeout = setTimeout(() => {
            disconnectSocket();
            reject(new RobotError('Movement timed out', ErrorCode.MOVEMENT_FAILED));
          }, 300000); // 5 minutes timeout
        });
      }
      
      // For single point moves, we'll just return success after creating the move action
      return true;
    } catch (error) {
      logError(`Failed to move robot ${command.robotId}`, error);
      throw new RobotError(
        `Failed to move robot: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.MOVEMENT_FAILED
      );
    }
  }
  
  /**
   * Move robot across multiple floors
   */
  static async moveRobotMultiFloor(command: MoveCommand): Promise<boolean> {
    try {
      // First verify robot availability
      await sdk.verifyRobotAvailability(command.robotId);
      
      // Check if the points are valid
      if (!command.points || command.points.length === 0) {
        throw new RobotError('No points provided for movement', ErrorCode.INVALID_POINT);
      }
      
      // Check if points span multiple floors/areas
      const areas = new Set(command.points.map(point => point.areaId));
      if (areas.size < 2) {
        throw new RobotError('Multi-floor movement requires points from different floors/areas', ErrorCode.INVALID_POINT);
      }
      
      // Generate a task ID for this movement
      const taskId = sdk.generateTaskId();
      
      // Create a task in the database
      await storage.createTask({
        taskId,
        name: `MultiFloor_${new Date().toISOString()}`,
        robotId: command.robotId,
        status: 'pending',
        taskType: 'multi_floor',
        priority: 'normal',
        runMode: command.runMode || 0,
        runType: command.runType || 0,
        routeMode: command.routeMode || 1,
        ignorePublicSite: command.ignorePublicSite || false,
        speed: command.speed || -1,
        points: command.points,
        currentPoint: null,
        returnPoint: null
      });
      
      // Execute the task
      await sdk.executeTask(
        taskId,
        command.robotId,
        command.points,
        'multi_floor',
        {
          runMode: command.runMode,
          runType: command.runType,
          routeMode: command.routeMode,
          ignorePublicSite: command.ignorePublicSite,
          speed: command.speed
        }
      );
      
      return true;
    } catch (error) {
      logError(`Failed to move robot ${command.robotId} across multiple floors`, error);
      throw new RobotError(
        `Failed to move robot across multiple floors: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.MOVEMENT_FAILED
      );
    }
  }
  
  /**
   * Stop robot movement
   */
  static async stopRobot(command: StopCommand): Promise<boolean> {
    try {
      // Get robot information
      const robot = await storage.getRobot(command.robotId);
      
      if (!robot) {
        throw new RobotError(`Robot not found: ${command.robotId}`, ErrorCode.ROBOT_UNAVAILABLE);
      }
      
      // Cancel current move action using AutoXing API
      await directApi.cancelMoveAction(command.robotId);
      
      // Get active tasks for the robot
      const activeTasks = await storage.getActiveTasksByRobot(command.robotId);
      
      // Cancel all active tasks in our database
      for (const task of activeTasks) {
        // Update task status as cancelled
        await storage.updateTaskStatus(task.taskId, 'cancelled');
        
        // Also use our SDK to cancel any internal tasks
        try {
          await sdk.cancelTask(task.taskId);
        } catch (taskError) {
          console.warn(`Could not cancel task ${task.taskId} through SDK: ${taskError.message}`);
        }
      }
      
      // Update robot status
      await storage.updateRobotStatus(command.robotId, 'online');
      
      // If this is an emergency stop, we may need to take additional actions
      if (command.emergency) {
        try {
          // Using REST API to send emergency stop command
          await axios.post(
            `${directApi.getRobotApiUrl(command.robotId, '/services/wheel_control/set_emergency_stop_pressed')}`,
            { emergency_stop_pressed: true },
            {
              headers: {
                'Content-Type': 'application/json',
                'APPCODE': `APPCODE ${directApi.APPCODE}`
              }
            }
          );
        } catch (emergencyError) {
          console.error(`Failed to send emergency stop: ${emergencyError.message}`);
          // We won't throw an error here since the move action has already been cancelled
        }
      }
      
      return true;
    } catch (error) {
      logError(`Failed to stop robot ${command.robotId}`, error);
      throw new RobotError(
        `Failed to stop robot: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.MOVEMENT_FAILED
      );
    }
  }
  
  /**
   * Send robot to charging station
   */
  static async goToChargingStation(command: ChargingCommand): Promise<boolean> {
    try {
      // First verify robot availability
      await sdk.verifyRobotAvailability(command.robotId);
      
      // Get robot information
      const robot = await storage.getRobot(command.robotId);
      
      if (!robot) {
        throw new RobotError(`Robot not found: ${command.robotId}`, ErrorCode.ROBOT_UNAVAILABLE);
      }
      
      // Determine which floor to use
      const floorId = command.floorId || (robot.floor || 'Floor1');
      
      // Find charging points on the floor using both data from our database and from the robot directly
      let chargingPoints = await storage.getChargingPoints(floorId);
      
      // If no charging points found in database, try to get them from the robot directly
      if (chargingPoints.length === 0) {
        try {
          const robotPoints = await directApi.getActualFloorPoints(command.robotId, floorId);
          const robotChargingPoints = robotPoints.filter(point => point.type === 'charger');
          
          if (robotChargingPoints.length > 0) {
            chargingPoints = robotChargingPoints;
            
            // Save these points to our database for future use
            for (const point of robotChargingPoints) {
              try {
                await storage.createPoi({
                  name: point.name,
                  type: 'charger',
                  poiId: point.poiId,
                  x: point.x,
                  y: point.y,
                  yaw: point.yaw || 0,
                  areaId: point.areaId,
                  floor: point.floor,
                  metadata: point.metadata
                });
              } catch (saveError) {
                console.warn(`Could not save charging point to database: ${saveError.message}`);
              }
            }
          }
        } catch (robotPointsError) {
          console.warn(`Could not get charging points from robot: ${robotPointsError.message}`);
        }
      }
      
      if (chargingPoints.length === 0) {
        throw new RobotError(`No charging points found on floor: ${floorId}`, ErrorCode.INVALID_POINT);
      }
      
      // Use the first available charging point
      const chargingPoint = chargingPoints[0];
      
      // Create a task point for the charging station
      const taskPoint: TaskPoint = {
        x: chargingPoint.x,
        y: chargingPoint.y,
        yaw: chargingPoint.yaw || 0,
        areaId: chargingPoint.areaId,
        stopRadius: chargingPoint.metadata?.stopRadius || 1,
        ext: {
          id: chargingPoint.poiId,
          name: chargingPoint.name
        }
      };
      
      // Generate a task ID for this charging movement
      const taskId = sdk.generateTaskId();
      
      // Create a task in the database
      await storage.createTask({
        taskId,
        name: `Charging_${new Date().toISOString()}`,
        robotId: command.robotId,
        status: 'pending',
        taskType: 'charging',
        priority: 'high', // Charging is a high priority task
        runMode: 0,
        runType: 0,
        routeMode: 1,
        ignorePublicSite: false,
        speed: -1,
        points: [taskPoint],
        currentPoint: null,
        returnPoint: null
      });
      
      // Using AutoXing direct API to move the robot to charging station with charge type
      const chargeResult = await directApi.createMoveAction(command.robotId, {
        x: chargingPoint.x,
        y: chargingPoint.y,
        yaw: chargingPoint.yaw || 0,
        type: 'charge',
        accuracy: 0.1 // Better accuracy for docking at charging station
      });
      
      // Start monitoring the charging status via WebSocket
      const monitorChargingResult = await new Promise((resolve, reject) => {
        let timeout: NodeJS.Timeout;
        let batteryCheckInterval: NodeJS.Timeout;
        
        const batteryStateHandler = (message) => {
          if (message.topic === '/battery_state') {
            // Check if the robot is charging
            if (message.power_supply_status === 'charging') {
              // Robot is charging, update status
              storage.updateRobotStatus(command.robotId, 'charging', message.percentage * 100);
              
              // Update task status
              storage.updateTaskStatus(taskId, 'completed');
              
              // Clear timeout and interval
              clearTimeout(timeout);
              clearInterval(batteryCheckInterval);
              directApi.disconnectRobotWebSocket(command.robotId);
              
              resolve(true);
            }
          }
        };
        
        const planningStateHandler = (message) => {
          if (message.topic === '/planning_state') {
            if (message.move_state === 'succeeded') {
              // Move succeeded, but we need to verify charging
              console.log(`Robot ${command.robotId} arrived at charging station, checking if charging started...`);
              
              // Set up an interval to check battery status
              batteryCheckInterval = setInterval(() => {
                // If charging hasn't started after a minute, consider it a failure
                console.log(`Checking if robot ${command.robotId} charging has started...`);
              }, 10000); // Check every 10 seconds
              
              // Set up a shorter timeout for charging verification
              clearTimeout(timeout);
              timeout = setTimeout(() => {
                clearInterval(batteryCheckInterval);
                directApi.disconnectRobotWebSocket(command.robotId);
                reject(new RobotError('Robot arrived at charging station but failed to start charging', ErrorCode.CHARGING_FAILED));
              }, 120000); // 2 minutes timeout for charging to start
            } else if (message.move_state === 'failed' || message.move_state === 'cancelled') {
              // Move failed
              clearTimeout(timeout);
              clearInterval(batteryCheckInterval);
              directApi.disconnectRobotWebSocket(command.robotId);
              reject(new RobotError(`Movement to charging station failed: ${message.fail_reason_str || 'Unknown reason'}`, ErrorCode.MOVEMENT_FAILED));
            }
          }
        };
        
        // Subscribe to both planning state and battery state
        const ws = directApi.connectToRobotWebSocket(
          command.robotId, 
          ['/planning_state', '/battery_state'], 
          (message) => {
            batteryStateHandler(message);
            planningStateHandler(message);
          }
        );
        
        // Set a timeout to prevent hanging
        timeout = setTimeout(() => {
          if (batteryCheckInterval) {
            clearInterval(batteryCheckInterval);
          }
          
          directApi.disconnectRobotWebSocket(command.robotId);
          reject(new RobotError('Charging operation timed out', ErrorCode.CHARGING_FAILED));
        }, 300000); // 5 minutes timeout
      });
      
      return true;
    } catch (error) {
      logError(`Failed to send robot ${command.robotId} to charging station`, error);
      throw new RobotError(
        `Failed to send robot to charging station: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.MOVEMENT_FAILED
      );
    }
  }
}