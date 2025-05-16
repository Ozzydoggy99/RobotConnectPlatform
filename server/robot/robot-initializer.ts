import { storage } from '../storage';
import * as directApi from './direct-api';
import { robotMonitor } from './robot-monitor';

/**
 * Initialize robot for API access with proper connection settings
 * @param robotId Robot ID to initialize
 * @param config Optional connection configuration override
 * @returns Initialization result
 */
export async function initializeRobot(robotId: string, config?: {
  publicIp?: string;
  localIp?: string;
  port?: number;
  useSsl?: boolean;
  wsPort?: number;
  appCode?: string;
  appSecret?: string;
  appId?: string;
}) {
  try {
    // First, check if robot exists in database
    const robot = await storage.getRobot(robotId);
    
    if (!robot) {
      throw new Error(`Robot ${robotId} not found in database`);
    }
    
    // Get SDK credentials for the robot
    const credentials = await storage.getActiveSdkCredentials();
    
    if (!credentials) {
      console.warn('No active SDK credentials found, using default values');
    }
    
    // Configure robot connection with default values that match our L382502104987ir setup
    // Following AutoXing documentation, port 8090 is used for both REST API and WebSocket
    const defaultConfig = {
      publicIp: '47.180.91.99',  // Default public IP from our connection scripts
      localIp: '192.168.4.31',   // Default local IP from our connection scripts
      port: 8090,                // Default port from AutoXing documentation (correct port)
      useSsl: false,             // Default to no SSL
      wsPort: 8090,              // WebSocket port from documentation (same as HTTP port)
      appCode: credentials?.appSecret || '667a51a4d948433081a272c78d10a8a4', // Default app code/secret for test robot
      appSecret: credentials?.appSecret || '667a51a4d948433081a272c78d10a8a4',
      appId: credentials?.appId || '667a51a4d948433081a272c78d10a8a4'
    };
    
    // Merge with provided config (if any)
    const finalConfig = {
      ...defaultConfig,
      ...config
    };
    
    // Get existing metadata
    const robotMetadata = robot.metadata || {};
    
    // Store connection config in metadata
    await storage.updateRobotMetadata(robotId, { 
      ...robotMetadata,
      connectionConfig: finalConfig 
    });
    
    console.log(`Stored connection configuration in database for robot ${robotId}`);
    
    // Configure robot in the direct API module with proper authentication
    const configResult = directApi.configureRobot(robotId, finalConfig);
    
    console.log(`Robot ${robotId} configured with:`, {
      publicIp: finalConfig.publicIp,
      port: finalConfig.port,
      wsPort: finalConfig.wsPort
    });
    
    // Start monitoring the robot
    try {
      await robotMonitor.startMonitoring(robotId);
      console.log(`Started monitoring robot ${robotId}`);
    } catch (monitorError) {
      console.warn(`Warning: Could not start monitoring for robot ${robotId}:`, monitorError);
      // Don't fail initialization if monitoring fails
    }
    
    return {
      success: true,
      robotId,
      config: {
        publicIp: finalConfig.publicIp,
        port: finalConfig.port,
        wsPort: finalConfig.wsPort
      } // Don't include sensitive information like appCode in response
    };
  } catch (error) {
    console.error(`Failed to initialize robot ${robotId}:`, error);
    return {
      success: false,
      robotId,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}