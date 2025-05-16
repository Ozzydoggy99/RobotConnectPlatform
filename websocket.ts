import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage';
import { ErrorCode, RobotError, logError } from './robot/errors';

// Client connection information
interface Client {
  id: string;
  ws: WebSocket;
  subscriptions: {
    robots: Set<string>;
    tasks: Set<string>;
    allRobots: boolean;
    allTasks: boolean;
  };
}

// WebSocket message types
type MessageType = 
  | 'subscribe_robot'
  | 'unsubscribe_robot'
  | 'subscribe_task'
  | 'unsubscribe_task'
  | 'subscribe_all_robots'
  | 'unsubscribe_all_robots'
  | 'subscribe_all_tasks'
  | 'unsubscribe_all_tasks'
  | 'get_robot_status'
  | 'get_task_status'
  | 'robot_update'
  | 'task_update'
  | 'ping'
  | 'pong';

// WebSocket message format
interface WebSocketMessage {
  type: MessageType;
  payload?: any;
  id?: string;
}

// WebSocket server class
export class WebSocketHandler {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Client> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  
  /**
   * Initialize WebSocket server
   */
  initialize(server: HttpServer): void {
    try {
      // Create WebSocket server
      this.wss = new WebSocketServer({ 
        server, 
        path: '/ws' // Use distinct path to avoid conflicts with Vite's HMR
      });
      
      // Set up connection handler
      this.wss.on('connection', this.handleConnection.bind(this));
      
      // Start status update interval
      this.startStatusUpdates();
      
      console.log('WebSocket server initialized');
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
    }
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    // Generate unique client ID
    const clientId = uuidv4();
    
    // Create client record
    const client: Client = {
      id: clientId,
      ws,
      subscriptions: {
        robots: new Set(),
        tasks: new Set(),
        allRobots: false,
        allTasks: false
      }
    };
    
    // Store client
    this.clients.set(clientId, client);
    
    // Send welcome message
    this.sendToClient(client, {
      type: 'pong',
      payload: {
        message: 'Connected to Robot Fleet Management System',
        clientId
      }
    });
    
    // Set up message handler
    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data) as WebSocketMessage;
        this.handleMessage(client, message);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        this.sendToClient(client, {
          type: 'pong',
          payload: {
            error: 'Invalid message format'
          }
        });
      }
    });
    
    // Set up close handler
    ws.on('close', () => {
      // Remove client from managed clients
      this.clients.delete(clientId);
      console.log(`Client ${clientId} disconnected`);
    });
    
    console.log(`Client ${clientId} connected`);
  }
  
  /**
   * Handle WebSocket message
   */
  private handleMessage(client: Client, message: WebSocketMessage): void {
    try {
      switch (message.type) {
        case 'subscribe_robot':
          if (message.payload?.robotId) {
            client.subscriptions.robots.add(message.payload.robotId);
            this.sendToClient(client, {
              type: 'pong',
              id: message.id,
              payload: {
                success: true,
                message: `Subscribed to robot ${message.payload.robotId}`
              }
            });
          }
          break;
          
        case 'unsubscribe_robot':
          if (message.payload?.robotId) {
            client.subscriptions.robots.delete(message.payload.robotId);
            this.sendToClient(client, {
              type: 'pong',
              id: message.id,
              payload: {
                success: true,
                message: `Unsubscribed from robot ${message.payload.robotId}`
              }
            });
          }
          break;
          
        case 'subscribe_task':
          if (message.payload?.taskId) {
            client.subscriptions.tasks.add(message.payload.taskId);
            this.sendToClient(client, {
              type: 'pong',
              id: message.id,
              payload: {
                success: true,
                message: `Subscribed to task ${message.payload.taskId}`
              }
            });
          }
          break;
          
        case 'unsubscribe_task':
          if (message.payload?.taskId) {
            client.subscriptions.tasks.delete(message.payload.taskId);
            this.sendToClient(client, {
              type: 'pong',
              id: message.id,
              payload: {
                success: true,
                message: `Unsubscribed from task ${message.payload.taskId}`
              }
            });
          }
          break;
          
        case 'subscribe_all_robots':
          client.subscriptions.allRobots = true;
          this.sendToClient(client, {
            type: 'pong',
            id: message.id,
            payload: {
              success: true,
              message: 'Subscribed to all robots'
            }
          });
          break;
          
        case 'unsubscribe_all_robots':
          client.subscriptions.allRobots = false;
          this.sendToClient(client, {
            type: 'pong',
            id: message.id,
            payload: {
              success: true,
              message: 'Unsubscribed from all robots'
            }
          });
          break;
          
        case 'subscribe_all_tasks':
          client.subscriptions.allTasks = true;
          this.sendToClient(client, {
            type: 'pong',
            id: message.id,
            payload: {
              success: true,
              message: 'Subscribed to all tasks'
            }
          });
          break;
          
        case 'unsubscribe_all_tasks':
          client.subscriptions.allTasks = false;
          this.sendToClient(client, {
            type: 'pong',
            id: message.id,
            payload: {
              success: true,
              message: 'Unsubscribed from all tasks'
            }
          });
          break;
          
        case 'get_robot_status':
          this.handleRobotStatusRequest(client, message);
          break;
          
        case 'get_task_status':
          this.handleTaskStatusRequest(client, message);
          break;
          
        case 'ping':
          this.sendToClient(client, {
            type: 'pong',
            id: message.id,
            payload: { timestamp: new Date().toISOString() }
          });
          break;
          
        default:
          this.sendToClient(client, {
            type: 'pong',
            id: message.id,
            payload: {
              error: `Unknown message type: ${message.type}`
            }
          });
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      this.sendToClient(client, {
        type: 'pong',
        id: message.id,
        payload: {
          error: 'Error processing message'
        }
      });
    }
  }
  
  /**
   * Handle robot status request
   */
  private async handleRobotStatusRequest(client: Client, message: WebSocketMessage): Promise<void> {
    try {
      const robotId = message.payload?.robotId;
      
      if (!robotId) {
        this.sendToClient(client, {
          type: 'pong',
          id: message.id,
          payload: {
            error: 'Robot ID is required'
          }
        });
        return;
      }
      
      // Get robot status
      const robot = await storage.getRobot(robotId);
      
      if (!robot) {
        this.sendToClient(client, {
          type: 'pong',
          id: message.id,
          payload: {
            error: `Robot not found: ${robotId}`
          }
        });
        return;
      }
      
      // Send robot status
      this.sendToClient(client, {
        type: 'pong',
        id: message.id,
        payload: {
          robotId,
          status: robot.status,
          batteryLevel: robot.batteryLevel,
          lastSeen: robot.lastSeen,
          error: robot.error,
          errorDetails: robot.errorDetails
        }
      });
    } catch (error) {
      console.error('Error handling robot status request:', error);
      this.sendToClient(client, {
        type: 'pong',
        id: message.id,
        payload: {
          error: 'Error getting robot status'
        }
      });
    }
  }
  
  /**
   * Handle task status request
   */
  private async handleTaskStatusRequest(client: Client, message: WebSocketMessage): Promise<void> {
    try {
      const taskId = message.payload?.taskId;
      
      if (!taskId) {
        this.sendToClient(client, {
          type: 'pong',
          id: message.id,
          payload: {
            error: 'Task ID is required'
          }
        });
        return;
      }
      
      // Get task status
      const task = await storage.getTask(taskId);
      
      if (!task) {
        this.sendToClient(client, {
          type: 'pong',
          id: message.id,
          payload: {
            error: `Task not found: ${taskId}`
          }
        });
        return;
      }
      
      // Send task status
      this.sendToClient(client, {
        type: 'pong',
        id: message.id,
        payload: {
          taskId,
          status: task.status,
          robotId: task.robotId,
          name: task.name,
          errorDetails: task.errorDetails,
          currentPoint: task.currentPoint,
          points: task.points,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt
        }
      });
    } catch (error) {
      console.error('Error handling task status request:', error);
      this.sendToClient(client, {
        type: 'pong',
        id: message.id,
        payload: {
          error: 'Error getting task status'
        }
      });
    }
  }
  
  /**
   * Send message to client
   */
  private sendToClient(client: Client, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Broadcast robot update to subscribed clients
   */
  broadcastRobotUpdate(robotId: string, data: any): void {
    // Convert iterator to array for compatibility
    Array.from(this.clients.values()).forEach(client => {
      if (client.subscriptions.allRobots || client.subscriptions.robots.has(robotId)) {
        this.sendToClient(client, {
          type: 'robot_update',
          payload: {
            robotId,
            ...data
          }
        });
      }
    });
  }
  
  /**
   * Broadcast task update to subscribed clients
   */
  broadcastTaskUpdate(taskId: string, data: any): void {
    // Convert iterator to array for compatibility
    Array.from(this.clients.values()).forEach(client => {
      if (client.subscriptions.allTasks || client.subscriptions.tasks.has(taskId)) {
        this.sendToClient(client, {
          type: 'task_update',
          payload: {
            taskId,
            ...data
          }
        });
      }
    });
  }
  
  /**
   * Start periodic status updates
   */
  private startStatusUpdates(): void {
    // Send status updates every 5 seconds
    this.updateInterval = setInterval(async () => {
      try {
        // Only proceed if we have clients with subscriptions
        if (this.clients.size === 0) {
          return;
        }
        
        const hasAllRobotsSubscribers = Array.from(this.clients.values()).some(client => 
          client.subscriptions.allRobots);
          
        const hasAllTasksSubscribers = Array.from(this.clients.values()).some(client => 
          client.subscriptions.allTasks);
        
        // Get all robot IDs with subscribers
        const subscribedRobotIds = new Set<string>();
        if (hasAllRobotsSubscribers) {
          // If someone subscribed to all robots, fetch all
          const robots = await storage.getAllRobots();
          robots.forEach(robot => subscribedRobotIds.add(robot.robotId));
        } else {
          // Otherwise just collect subscribed robot IDs
          Array.from(this.clients.values()).forEach(client => {
            Array.from(client.subscriptions.robots).forEach(robotId => {
              subscribedRobotIds.add(robotId);
            });
          });
        }
        
        // Get all task IDs with subscribers
        const subscribedTaskIds = new Set<string>();
        if (hasAllTasksSubscribers) {
          // If someone subscribed to all tasks, fetch all active ones
          const tasks = await storage.getActiveTasks();
          tasks.forEach(task => subscribedTaskIds.add(task.taskId));
        } else {
          // Otherwise just collect subscribed task IDs
          Array.from(this.clients.values()).forEach(client => {
            Array.from(client.subscriptions.tasks).forEach(taskId => {
              subscribedTaskIds.add(taskId);
            });
          });
        }
        
        // Fetch and broadcast robot updates
        Array.from(subscribedRobotIds).forEach(async (robotId) => {
          try {
            const robot = await storage.getRobot(robotId);
            if (robot) {
              this.broadcastRobotUpdate(robotId, {
                status: robot.status,
                batteryLevel: robot.batteryLevel,
                lastSeen: robot.lastSeen,
                error: robot.error,
                errorDetails: robot.errorDetails
              });
            }
          } catch (err) {
            console.error(`Error fetching robot ${robotId} for status update:`, err);
          }
        });
        
        // Fetch and broadcast task updates
        Array.from(subscribedTaskIds).forEach(async (taskId) => {
          try {
            const task = await storage.getTask(taskId);
            if (task) {
              this.broadcastTaskUpdate(taskId, {
                status: task.status,
                currentPoint: task.currentPoint,
                errorDetails: task.errorDetails,
                startedAt: task.startedAt,
                completedAt: task.completedAt
              });
            }
          } catch (err) {
            console.error(`Error fetching task ${taskId} for status update:`, err);
          }
        });
      } catch (error) {
        console.error('Error sending periodic status updates:', error);
      }
    }, 5000);
  }
  
  /**
   * Stop WebSocket server
   */
  stop(): void {
    // Clear update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Close all connections
    if (this.wss) {
      this.wss.clients.forEach(client => {
        client.terminate();
      });
      
      this.wss.close();
      this.wss = null;
    }
    
    // Clear clients
    this.clients.clear();
    
    console.log('WebSocket server stopped');
  }
}

// Create singleton instance
export const websocketHandler = new WebSocketHandler();