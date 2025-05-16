/**
 * Script to register robot L382502104987ir in our database
 */

import { db } from './server/db.js';
import { robots, sdkCredentials } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function registerRobot() {
  try {
    // Define robot data
    const robotData = {
      robotId: 'L382502104987ir',
      name: 'AutoXing Robot L382502104987ir',
      status: 'online',
      batteryLevel: 100, // Default value, will be updated when monitoring starts
      floor: 'Floor1',
      lastSeen: new Date()
    };
    
    // Define SDK credentials for this robot
    const credentialsData = {
      appId: '667a51a4d948433081a272c78d10a8a4',
      appSecret: '667a51a4d948433081a272c78d10a8a4',
      mode: 'WAN_APP',
      isActive: true
    };
    
    console.log('Checking if robot already exists in database...');
    
    // Check if robot already exists
    const existingRobot = await db.select()
      .from(robots)
      .where(eq(robots.robotId, robotData.robotId))
      .execute();
    
    if (existingRobot.length > 0) {
      console.log('Robot already exists in database, updating information...');
      
      // Update existing robot
      await db.update(robots)
        .set({
          name: robotData.name,
          status: robotData.status,
          lastSeen: robotData.lastSeen,
          floor: robotData.floor
        })
        .where(eq(robots.robotId, robotData.robotId))
        .execute();
      
      console.log('Robot information updated successfully.');
    } else {
      console.log('Robot does not exist in database, creating new entry...');
      
      // Create new robot
      await db.insert(robots)
        .values(robotData)
        .execute();
      
      console.log('Robot registered successfully.');
    }
    
    // Check if credentials already exist
    const existingCredentials = await db.select()
      .from(sdkCredentials)
      .where(eq(sdkCredentials.appId, credentialsData.appId))
      .execute();
    
    if (existingCredentials.length > 0) {
      console.log('SDK credentials already exist in database, updating information...');
      
      // Update existing credentials
      await db.update(sdkCredentials)
        .set({
          appSecret: credentialsData.appSecret,
          mode: credentialsData.mode,
          isActive: credentialsData.isActive
        })
        .where(eq(sdkCredentials.appId, credentialsData.appId))
        .execute();
      
      console.log('SDK credentials updated successfully.');
    } else {
      console.log('SDK credentials do not exist in database, creating new entry...');
      
      // Create new credentials
      await db.insert(sdkCredentials)
        .values(credentialsData)
        .execute();
      
      console.log('SDK credentials registered successfully.');
    }
    
    console.log('Robot registration complete.');
    
    // Verify registration by fetching robot and credentials
    const verifyRobot = await db.select()
      .from(robots)
      .where(eq(robots.robotId, robotData.robotId))
      .execute();
    
    const verifyCredentials = await db.select()
      .from(sdkCredentials)
      .where(eq(sdkCredentials.appId, credentialsData.appId))
      .execute();
    
    console.log('Verification - Robot:', verifyRobot[0]);
    console.log('Verification - SDK Credentials:', verifyCredentials[0]);
    
  } catch (error) {
    console.error('Error registering robot:', error);
  }
}

// Run the registration function
registerRobot();