import * as directApi from './direct-api';
import { storage } from '../storage';
import { websocketHandler } from '../websocket';
import { ErrorCode, RobotError, logError } from './errors';

// Robot monitor interface
interface RobotMonitorInterface {
  startMonitoring(robotId: string): Promise<void>;
  stopMonitoring(robotId: string): Promise<void>;
  isMonitoring(robotId: string): boolean;
}

// Robot connection manager
class RobotMonitor implements RobotMonitorInterface {
  private monitoredRobots: Map<string, {
    webSocket?: WebSocket;
    batteryInterval?: NodeJS.Timeout;
    positionInterval?: NodeJS.Timeout;
    topics: string[];
  }> = new Map();

  /**
   * Start monitoring a robot
   * @param robotId Robot ID to monitor
   */
  async startMonitoring(robotId: string): Promise<void> {
    // Skip if already monitoring
    if (this.isMonitoring(robotId)) {
      console.log(`Already monitoring robot ${robotId}`);
      return;
    }

    try {
      // First verify the robot is available
      const robot = await storage.getRobot(robotId);
      if (!robot) {
        throw new RobotError(`Robot not found: ${robotId}`, ErrorCode.ROBOT_UNAVAILABLE);
      }

      // Topics to monitor
      const topics = [
        '/tracked_pose',         // Current position
        '/battery_state',        // Battery information
        '/planning_state',       // Movement state
        '/wheel_state',          // Control mode and emergency status
        '/slam/state',           // Positioning state
        '/nearby_robots',        // Nearby robots (if hardware available)
        '/alerts'                // Active alerts
      ];

      // Set up message handler for WebSocket
      const messageHandler = (message: any) => {
        // Process different message topics
        if (message.topic === '/battery_state') {
          // Handle battery state updates
          const batteryLevel = message.percentage * 100;
          const chargingStatus = message.power_supply_status === 'charging' ? 'charging' : 'discharging';
          
          // Update robot status in database
          storage.updateRobotStatus(robotId, chargingStatus, batteryLevel);
          
          // Broadcast update via WebSocket to clients
          websocketHandler.broadcastRobotUpdate(robotId, {
            batteryLevel,
            status: chargingStatus,
            voltage: message.voltage,
            current: message.current,
            lastSeen: new Date()
          });
        } 
        else if (message.topic === '/tracked_pose') {
          // Handle position updates
          const position = {
            x: message.pos[0],
            y: message.pos[1],
            floor: (robot.floor || 'Floor1')
          };
          
          // Update robot position in database
          storage.updateRobotPosition(robotId, position);
          
          // Broadcast position update
          websocketHandler.broadcastRobotUpdate(robotId, {
            position: {
              x: position.x,
              y: position.y,
              orientation: message.ori
            },
            lastSeen: new Date()
          });
        }
        else if (message.topic === '/planning_state') {
          // Handle planning/movement state updates
          const moveState = message.move_state;
          const actionType = message.action_type;
          
          // Find active tasks for this robot
          storage.getActiveTasksByRobot(robotId).then(tasks => {
            tasks.forEach(task => {
              // Update task status based on movement state
              if (moveState === 'succeeded') {
                // For completed movement, update task status
                storage.updateTaskStatus(task.taskId, 'completed');
                
                // Broadcast task update
                websocketHandler.broadcastTaskUpdate(task.taskId, {
                  status: 'completed',
                  completedAt: new Date()
                });
              } 
              else if (moveState === 'failed') {
                // For failed movement, update task with error details
                const errorDetails = {
                  code: message.fail_reason || 999,
                  message: message.fail_reason_str || 'Unknown failure',
                  type: 1, // Movement error
                  level: 2, // Error level
                  priority: true
                };
                
                storage.updateTaskErrorDetails(task.taskId, errorDetails);
                storage.updateTaskStatus(task.taskId, 'failed');
                
                // Broadcast task update
                websocketHandler.broadcastTaskUpdate(task.taskId, {
                  status: 'failed',
                  errorDetails,
                  completedAt: new Date()
                });
              }
            });
          }).catch(error => {
            console.error(`Error updating tasks for robot ${robotId}:`, error);
          });
          
          // Broadcast movement state update
          websocketHandler.broadcastRobotUpdate(robotId, {
            moveState,
            actionType,
            remainingDistance: message.remaining_distance,
            lastSeen: new Date()
          });
        }
        else if (message.topic === '/wheel_state') {
          // Handle wheel state updates
          const controlMode = message.control_mode;
          const emergencyStop = message.emergency_stop_pressed;
          
          // Update status if emergency stop is pressed
          if (emergencyStop) {
            storage.updateRobotStatus(robotId, 'emergency_stop');
          }
          
          // Broadcast wheel state
          websocketHandler.broadcastRobotUpdate(robotId, {
            controlMode,
            emergencyStop,
            lastSeen: new Date()
          });
        }
        else if (message.topic === '/slam/state') {
          // Handle positioning state updates
          const positioningState = message.state;
          const positioningReliable = message.reliable;
          
          // Broadcast positioning state
          websocketHandler.broadcastRobotUpdate(robotId, {
            positioningState,
            positioningReliable,
            positionQuality: message.position_quality,
            lastSeen: new Date()
          });
          
          // If position is lost, log an error
          if (!positioningReliable) {
            const errorDetails = {
              code: 4001,
              message: 'Robot position is lost',
              type: 4, // Positioning error
              level: 2, // Error level
              priority: true
            };
            
            storage.updateRobotStatus(robotId, 'position_lost');
            
            // Create error log
            storage.createErrorLog({
              robotId,
              errorCode: 4001,
              errorMessage: 'Robot position is lost',
              errorType: 4,
              errorLevel: 2,
              priority: true,
              timestamp: new Date(),
              resolved: false
            });
          }
        }
        else if (message.topic === '/alerts') {
          // Handle alerts
          if (message.alerts && message.alerts.length > 0) {
            message.alerts.forEach((alert: any) => {
              // Create error log for each alert
              storage.createErrorLog({
                robotId,
                errorCode: alert.code,
                errorMessage: alert.msg,
                errorType: 0, // System alert
                errorLevel: alert.level === 'error' ? 2 : (alert.level === 'warn' ? 1 : 0),
                priority: alert.level === 'error',
                timestamp: new Date(),
                resolved: false
              });
              
              // Update robot status for critical alerts
              if (alert.level === 'error') {
                storage.updateRobotStatus(robotId, 'error', null, null, alert.msg);
                
                const errorDetails = {
                  code: alert.code,
                  message: alert.msg,
                  type: 0,
                  level: 2,
                  priority: true
                };
                
                // Broadcast error details
                websocketHandler.broadcastRobotUpdate(robotId, {
                  status: 'error',
                  error: alert.msg,
                  errorDetails,
                  lastSeen: new Date()
                });
              }
            });
          }
        }
      };

      // Start WebSocket connection to robot
      const ws = directApi.connectToRobotWebSocket(robotId, topics, messageHandler);
      
      // Setup monitor info
      this.monitoredRobots.set(robotId, {
        webSocket: ws,
        topics
      });

      console.log(`Started monitoring robot ${robotId}`);
    } catch (error) {
      console.error(`Failed to start monitoring robot ${robotId}:`, error);
      throw error;
    }
  }

  /**
   * Stop monitoring a robot
   * @param robotId Robot ID to stop monitoring
   */
  async stopMonitoring(robotId: string): Promise<void> {
    if (!this.isMonitoring(robotId)) {
      return;
    }

    try {
      const monitor = this.monitoredRobots.get(robotId);
      
      // Clean up intervals
      if (monitor?.batteryInterval) {
        clearInterval(monitor.batteryInterval);
      }
      
      if (monitor?.positionInterval) {
        clearInterval(monitor.positionInterval);
      }
      
      // Close WebSocket connection
      directApi.disconnectRobotWebSocket(robotId);
      
      // Remove from monitored robots
      this.monitoredRobots.delete(robotId);
      
      console.log(`Stopped monitoring robot ${robotId}`);
    } catch (error) {
      console.error(`Error stopping monitoring for robot ${robotId}:`, error);
    }
  }

  /**
   * Check if a robot is being monitored
   * @param robotId Robot ID to check
   * @returns True if the robot is being monitored
   */
  isMonitoring(robotId: string): boolean {
    return this.monitoredRobots.has(robotId);
  }

  /**
   * Start monitoring all known robots
   */
  async startMonitoringAllRobots(): Promise<void> {
    try {
      // Get all robots
      const robots = await storage.getAllRobots();
      
      // Start monitoring each robot
      for (const robot of robots) {
        try {
          await this.startMonitoring(robot.robotId);
        } catch (error) {
          console.error(`Failed to start monitoring robot ${robot.robotId}:`, error);
        }
      }
      
      console.log(`Started monitoring ${robots.length} robots`);
    } catch (error) {
      console.error('Failed to start monitoring all robots:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring all robots
   */
  async stopMonitoringAllRobots(): Promise<void> {
    const robotIds = Array.from(this.monitoredRobots.keys());
    
    for (const robotId of robotIds) {
      await this.stopMonitoring(robotId);
    }
    
    console.log(`Stopped monitoring ${robotIds.length} robots`);
  }
}

// Create singleton instance
export const robotMonitor = new RobotMonitor();