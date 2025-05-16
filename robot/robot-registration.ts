import { db } from '../db';
import { robots, sdkCredentials, RobotStatus, type InsertRobot, type InsertSdkCredentials } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { initializeRobot } from './robot-initializer';

/**
 * Register a robot in the database
 * @param robotData Robot data to register
 * @param credentialsData SDK credentials for the robot
 * @returns The registered robot
 */
export async function registerRobot(
  robotData: Omit<InsertRobot, 'id'>, 
  credentialsData: Omit<InsertSdkCredentials, 'id'>
) {
  try {
    // Check if robot already exists
    const existingRobot = await db.select()
      .from(robots)
      .where(eq(robots.robotId, robotData.robotId))
      .execute();
    
    let registeredRobot;
    
    if (existingRobot.length > 0) {
      console.log(`Robot ${robotData.robotId} already exists, updating information...`);
      
      // Update existing robot
      [registeredRobot] = await db.update(robots)
        .set({
          name: robotData.name,
          status: robotData.status || RobotStatus.OFFLINE,
          lastSeen: new Date(),
          floor: robotData.floor
        })
        .where(eq(robots.robotId, robotData.robotId))
        .returning();
      
      console.log(`Robot ${robotData.robotId} updated successfully.`);
    } else {
      console.log(`Registering new robot ${robotData.robotId}...`);
      
      // Create new robot
      [registeredRobot] = await db.insert(robots)
        .values({
          ...robotData,
          lastSeen: new Date()
        })
        .returning();
      
      console.log(`Robot ${robotData.robotId} registered successfully.`);
    }
    
    // Check if credentials already exist
    const existingCredentials = await db.select()
      .from(sdkCredentials)
      .where(eq(sdkCredentials.appId, credentialsData.appId))
      .execute();
    
    let registeredCredentials;
    
    if (existingCredentials.length > 0) {
      console.log(`SDK credentials for ${credentialsData.appId} already exist, updating...`);
      
      // Update existing credentials
      [registeredCredentials] = await db.update(sdkCredentials)
        .set({
          appSecret: credentialsData.appSecret,
          mode: credentialsData.mode || 'WAN_APP',
          isActive: credentialsData.isActive !== undefined ? credentialsData.isActive : true
        })
        .where(eq(sdkCredentials.appId, credentialsData.appId))
        .returning();
      
      console.log(`SDK credentials updated successfully.`);
    } else {
      console.log(`Registering new SDK credentials for ${credentialsData.appId}...`);
      
      // Create new credentials
      [registeredCredentials] = await db.insert(sdkCredentials)
        .values({
          ...credentialsData,
          mode: credentialsData.mode || 'WAN_APP',
          isActive: credentialsData.isActive !== undefined ? credentialsData.isActive : true
        })
        .returning();
      
      console.log(`SDK credentials registered successfully.`);
    }
    
    // Initialize the robot with API connection details
    try {
      const initResult = await initializeRobot(robotData.robotId);
      console.log(`Robot ${robotData.robotId} initialization result:`, initResult);
    } catch (initError) {
      console.warn(`Warning: Could not initialize robot ${robotData.robotId}:`, initError);
      // Don't fail registration if initialization fails
    }
    
    return {
      robot: registeredRobot,
      credentials: registeredCredentials
    };
  } catch (error) {
    console.error('Error registering robot:', error);
    throw error;
  }
}

/**
 * Register the specific L382502104987ir robot
 */
export async function registerL382502104987irRobot() {
  const robotData = {
    robotId: 'L382502104987ir',
    name: 'AutoXing Robot L382502104987ir',
    status: RobotStatus.ONLINE,
    batteryLevel: 100, // Will be updated when monitoring starts
    floor: 'Floor1',
  };
  
  const credentialsData = {
    appId: '667a51a4d948433081a272c78d10a8a4',
    appSecret: '667a51a4d948433081a272c78d10a8a4',
    mode: 'WAN_APP',
    isActive: true
  };
  
  const result = await registerRobot(robotData, credentialsData);
  
  // Configure specific connection settings for L382502104987ir
  // NOTE: Using port 8090 for both REST API and WebSocket as specified in AutoXing documentation
  await initializeRobot(robotData.robotId, {
    publicIp: '47.180.91.99',
    localIp: '192.168.4.31',
    port: 8090, // Updated to use correct port 8090 for REST API
    wsPort: 8090,
    appCode: '667a51a4d948433081a272c78d10a8a4', // Authentication code
    appSecret: '667a51a4d948433081a272c78d10a8a4',
    appId: '667a51a4d948433081a272c78d10a8a4'
  });
  
  console.log(`Robot L382502104987ir registered and initialized`);
  
  return result;
}