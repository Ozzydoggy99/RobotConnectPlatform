import axios from 'axios';
import { logError } from './errors';

// Robot connection configuration
interface RobotConfig {
  publicIp: string;
  localIp: string;
  port?: number;
  useSsl?: boolean;
  apiKey?: string;
}

// Default robot configuration
const defaultConfig: RobotConfig = {
  publicIp: '47.180.91.99',  // Default public IP
  localIp: '192.168.4.31',   // Default local IP
  port: 80,                  // Default port
  useSsl: false              // Default to HTTP
};

// Active robot configurations
const robotConfigs: Map<string, RobotConfig> = new Map();

/**
 * Configure robot connection details
 */
export function configureRobot(robotId: string, config: Partial<RobotConfig>): void {
  // Get existing config or use default
  const existingConfig = robotConfigs.get(robotId) || { ...defaultConfig };
  
  // Update with new values
  robotConfigs.set(robotId, {
    ...existingConfig,
    ...config
  });
  
  console.log(`Robot ${robotId} configured with:`, robotConfigs.get(robotId));
}

/**
 * Get robot API URL
 */
function getRobotUrl(robotId: string, endpoint: string): string {
  const config = robotConfigs.get(robotId) || defaultConfig;
  const protocol = config.useSsl ? 'https' : 'http';
  const ip = isLocalNetwork() ? config.localIp : config.publicIp;
  const port = config.port ? `:${config.port}` : '';
  
  return `${protocol}://${ip}${port}${endpoint}`;
}

/**
 * Check if we're on the same local network as the robot
 */
function isLocalNetwork(): boolean {
  // This is a simplified check - in production you would verify
  // if the client IP is in the same subnet as the robot
  return false; // Default to using public IP for external access
}

/**
 * Send command to robot
 */
export async function sendRobotCommand(
  robotId: string, 
  endpoint: string, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  data?: any
): Promise<any> {
  try {
    const url = getRobotUrl(robotId, endpoint);
    const config = robotConfigs.get(robotId) || defaultConfig;
    
    // Set up request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add API key if available
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    
    // Make the request
    const response = await axios({
      method,
      url,
      data,
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    return response.data;
  } catch (error: any) {
    // Handle connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logError('Robot connection', `Failed to connect to robot ${robotId}: ${error.message}`);
      throw new Error(`Robot connection failed: ${error.message}`);
    }
    
    // Handle API errors
    if (error.response) {
      logError('Robot API', `Robot ${robotId} API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      throw new Error(`Robot API error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
    }
    
    // Handle other errors
    logError('Robot command', `Failed to send command to robot ${robotId}: ${error.message}`);
    throw error;
  }
}

/**
 * Get robot status
 */
export async function getRobotStatus(robotId: string): Promise<any> {
  return sendRobotCommand(robotId, '/api/status', 'GET');
}

/**
 * Get robot battery level
 */
export async function getRobotBattery(robotId: string): Promise<any> {
  return sendRobotCommand(robotId, '/api/battery', 'GET');
}

/**
 * Get robot position
 */
export async function getRobotPosition(robotId: string): Promise<any> {
  return sendRobotCommand(robotId, '/api/position', 'GET');
}

/**
 * Move robot to position
 */
export async function moveRobotToPosition(
  robotId: string, 
  x: number, 
  y: number, 
  yaw?: number,
  speed?: number
): Promise<any> {
  return sendRobotCommand(robotId, '/api/move', 'POST', {
    x,
    y,
    yaw,
    speed
  });
}

/**
 * Stop robot
 */
export async function stopRobot(robotId: string): Promise<any> {
  return sendRobotCommand(robotId, '/api/stop', 'POST');
}

/**
 * Execute robot action
 */
export async function executeRobotAction(
  robotId: string,
  actionType: string,
  actionParams?: any
): Promise<any> {
  return sendRobotCommand(robotId, '/api/action', 'POST', {
    type: actionType,
    ...actionParams
  });
}

/**
 * Initialize robot connection
 */
export async function initializeRobotConnection(robotId: string, apiKey?: string): Promise<boolean> {
  try {
    // Configure robot with API key if provided
    if (apiKey) {
      configureRobot(robotId, { apiKey });
    }
    
    // Attempt to get robot status to verify connection
    await getRobotStatus(robotId);
    
    console.log(`Successfully connected to robot ${robotId}`);
    return true;
  } catch (error) {
    logError('Robot initialization', `Failed to initialize robot ${robotId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

// Configure the default robot
configureRobot('robot_001', {
  publicIp: '47.180.91.99',
  localIp: '192.168.4.31'
});