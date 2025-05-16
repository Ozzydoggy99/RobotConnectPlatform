import { eq } from "drizzle-orm";
import { db } from '../db';
import { robots, type Robot, type InsertRobot } from '@shared/schema';

/**
 * Update robot data in database
 */
export async function updateRobot(robotId: string, data: Partial<InsertRobot>): Promise<Robot> {
  const [updatedRobot] = await db
    .update(robots)
    .set({
      ...data,
      lastSeen: new Date() // Always update lastSeen when robot is updated
    })
    .where(eq(robots.robotId, robotId))
    .returning();
    
  if (!updatedRobot) {
    throw new Error(`Robot not found: ${robotId}`);
  }
  
  return updatedRobot;
}

/**
 * Update task data in database
 * This is a placeholder until we implement the actual method in DatabaseStorage
 */
export async function updateTask(taskId: string, data: any): Promise<any> {
  // This will be replaced by the actual implementation
  console.log(`Updating task ${taskId} with data:`, data);
  return { id: 1, taskId, ...data };
}