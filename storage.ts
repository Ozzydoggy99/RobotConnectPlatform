import { 
  robots, type Robot, type InsertRobot,
  pois, type Poi, type InsertPoi,
  tasks, type Task, type InsertTask,
  errorLogs, type ErrorLog, type InsertErrorLog,
  maps, type Map, type InsertMap,
  sdkCredentials, type SdkCredentials, type InsertSdkCredentials,
  users, type User, type InsertUser,
  TaskStatus
} from '@shared/schema';

// Storage interface with all the methods needed for the application
export interface IStorage {
  // Robot operations
  getAllRobots(): Promise<Robot[]>;
  getRobot(robotId: string): Promise<Robot | undefined>;
  createRobot(robot: InsertRobot): Promise<Robot>;
  updateRobotStatus(robotId: string, status: string, batteryLevel?: number, floor?: string): Promise<boolean>;
  updateRobotPosition(robotId: string, position: { x: number; y: number; floor: string }): Promise<boolean>;
  updateRobotMetadata(robotId: string, metadata: any): Promise<boolean>;
  
  // POI operations
  getAllPois(): Promise<Poi[]>;
  getPoi(poiId: string): Promise<Poi | undefined>;
  createPoi(poi: InsertPoi): Promise<Poi>;
  getChargingPoints(floor: string): Promise<Poi[]>;
  
  // Task operations
  getAllTasks(): Promise<Task[]>;
  getTask(taskId: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(task: Task): Promise<Task>; // Add updateTask method
  updateTaskStatus(taskId: string, status: string): Promise<boolean>;
  updateTaskStartTime(taskId: string, startTime: Date): Promise<boolean>;
  updateTaskCompletionTime(taskId: string, completionTime: Date): Promise<boolean>;
  updateTaskErrorDetails(taskId: string, errorDetails: any): Promise<boolean>;
  updateTaskCurrentStep(taskId: string, currentStep: number): Promise<boolean>;
  updateTaskCurrentPoint(taskId: string, currentPoint: any): Promise<boolean>;
  updateTaskPayload(taskId: string, payload: any): Promise<boolean>;
  updateTaskReturnPoint(taskId: string, returnPoint: any): Promise<boolean>;
  updateTaskRobot(taskId: string, robotId: string): Promise<boolean>;
  updateTaskNotes(taskId: string, notes: string): Promise<boolean>;
  getTasksByStatus(status: string): Promise<Task[]>;
  getActiveTasks(): Promise<Task[]>;
  getPendingTasks(): Promise<Task[]>;
  getPendingTasksByType(taskType: string): Promise<Task[]>;
  getTasksByRobot(robotId: string): Promise<Task[]>;
  getActiveTasksByRobot(robotId: string): Promise<Task[]>;
  getTaskHistory(): Promise<Task[]>;
  deleteTask(taskId: string): Promise<boolean>;
  
  // Error log operations
  getAllErrorLogs(): Promise<ErrorLog[]>;
  getRecentErrorLogs(limit: number): Promise<ErrorLog[]>;
  createErrorLog(errorLog: InsertErrorLog): Promise<ErrorLog>;
  resolveErrorLog(id: number): Promise<boolean>;
  
  // Map operations
  getAllMaps(): Promise<Map[]>;
  getMap(areaId: string): Promise<Map | undefined>;
  createMap(map: InsertMap): Promise<Map>;
  
  // SDK credentials operations
  getAllSdkCredentials(): Promise<SdkCredentials[]>;
  getActiveSdkCredentials(): Promise<SdkCredentials | undefined>;
  createSdkCredentials(credentials: InsertSdkCredentials): Promise<SdkCredentials>;
  updateSdkCredentials(appId: string, appSecret: string, mode: string): Promise<boolean>;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

// In-memory storage implementation for development
export class MemStorage implements IStorage {
  private robots: Map<string, Robot>;
  private pois: Map<string, Poi>;
  private tasks: Map<string, Task>;
  private errorLogs: Map<number, ErrorLog>;
  private maps: Map<string, Map>;
  private sdkCredentials: Map<number, SdkCredentials>;
  private users: Map<number, User>;
  
  private robotIdCounter: number;
  private poiIdCounter: number;
  private taskIdCounter: number;
  private errorLogIdCounter: number;
  private mapIdCounter: number;
  private sdkCredentialsIdCounter: number;
  private userIdCounter: number;

  constructor() {
    this.robots = new Map();
    this.pois = new Map();
    this.tasks = new Map();
    this.errorLogs = new Map();
    this.maps = new Map();
    this.sdkCredentials = new Map();
    this.users = new Map();
    
    this.robotIdCounter = 1;
    this.poiIdCounter = 1;
    this.taskIdCounter = 1;
    this.errorLogIdCounter = 1;
    this.mapIdCounter = 1;
    this.sdkCredentialsIdCounter = 1;
    this.userIdCounter = 1;
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    // Sample robots
    const sampleRobots: InsertRobot[] = [
      {
        robotId: 'RBT-63yT',
        name: 'Delivery Bot 1',
        status: 'online',
        batteryLevel: 85,
        floor: 'Floor 3'
      },
      {
        robotId: 'RBT-817A',
        name: 'Warehouse Bot 1',
        status: 'online',
        batteryLevel: 42,
        floor: 'Floor 1'
      },
      {
        robotId: 'RBT-42X',
        name: 'Security Bot 1',
        status: 'error',
        batteryLevel: 12,
        floor: 'Floor 2',
        error: 'Positioning quality not reliable',
        errorDetails: {
          code: 7002,
          message: 'Positioning quality not reliable',
          type: 0,
          level: 0,
          priority: true
        }
      },
      {
        robotId: 'RBT-901B',
        name: 'Maintenance Bot 1',
        status: 'offline',
        floor: 'Floor 1'
      }
    ];
    
    for (const robot of sampleRobots) {
      this.createRobot(robot);
    }
    
    // Sample maps
    const sampleMaps: InsertMap[] = [
      {
        areaId: 'area_floor1',
        name: 'First Floor',
        floor: 'Floor 1',
        building: 'Main Building',
        isActive: true
      },
      {
        areaId: 'area_floor2',
        name: 'Second Floor',
        floor: 'Floor 2',
        building: 'Main Building',
        isActive: true
      },
      {
        areaId: 'area_floor3',
        name: 'Third Floor',
        floor: 'Floor 3',
        building: 'Main Building',
        isActive: true
      }
    ];
    
    for (const map of sampleMaps) {
      this.createMap(map);
    }
    
    // Sample POIs
    const samplePois: InsertPoi[] = [
      {
        poiId: 'poi_charging1',
        name: 'Charging Station 1',
        x: 3.7,
        y: 14.1,
        yaw: 180,
        areaId: 'area_floor1',
        type: 'charging',
        floor: 'Floor 1',
        metadata: {
          stopRadius: 1
        }
      },
      {
        poiId: 'poi_charging2',
        name: 'Charging Station 2',
        x: 5.2,
        y: 18.3,
        yaw: 90,
        areaId: 'area_floor2',
        type: 'charging',
        floor: 'Floor 2',
        metadata: {
          stopRadius: 1
        }
      },
      {
        poiId: 'poi_charging3',
        name: 'Charging Station 3',
        x: 2.3,
        y: 12.5,
        yaw: 270,
        areaId: 'area_floor3',
        type: 'charging',
        floor: 'Floor 3',
        metadata: {
          stopRadius: 1
        }
      },
      {
        poiId: 'poi_task1',
        name: 'TaskPoint1',
        x: 2.41,
        y: 14.8,
        yaw: 0,
        areaId: 'area_floor3',
        type: 'regular',
        floor: 'Floor 3',
        metadata: {
          stopRadius: 1
        }
      },
      {
        poiId: 'poi_task2',
        name: 'TaskPoint2',
        x: 2.41,
        y: 11.76,
        yaw: 0,
        areaId: 'area_floor3',
        type: 'regular',
        floor: 'Floor 3',
        metadata: {
          stopRadius: 1
        }
      },
      {
        poiId: 'poi_shelf1',
        name: 'Shelf Area A',
        x: 8.2,
        y: 15.1,
        yaw: 0,
        areaId: 'area_floor1',
        type: 'shelf',
        floor: 'Floor 1',
        metadata: {
          stopRadius: 1
        }
      },
      {
        poiId: 'poi_shelf2',
        name: 'Shelf Area B',
        x: 12.5,
        y: 9.8,
        yaw: 180,
        areaId: 'area_floor1',
        type: 'shelf',
        floor: 'Floor 1',
        metadata: {
          stopRadius: 1
        }
      }
    ];
    
    for (const poi of samplePois) {
      this.createPoi(poi);
    }
    
    // Sample error logs
    const sampleErrorLogs: InsertErrorLog[] = [
      {
        robotId: 'RBT-42X',
        errorCode: 7002,
        errorMessage: 'Positioning quality not reliable',
        errorType: 0,
        errorLevel: 0,
        priority: true,
        resolved: false
      },
      {
        robotId: 'RBT-63yT',
        errorCode: 8003,
        errorMessage: 'Battery level low (15%)',
        errorType: 0,
        errorLevel: 1,
        priority: false,
        resolved: false
      },
      {
        robotId: 'RBT-42X',
        errorCode: 10002,
        errorMessage: 'Charging dock not recognized',
        errorType: 0,
        errorLevel: 0,
        priority: true,
        resolved: false
      }
    ];
    
    for (const errorLog of sampleErrorLogs) {
      this.createErrorLog(errorLog);
    }
    
    // Sample SDK credentials
    this.createSdkCredentials({
      appId: process.env.APP_ID || 'default_app_id',
      appSecret: process.env.APP_SECRET || 'default_app_secret',
      mode: 'WAN_APP',
      isActive: true
    });
  }

  // Robot operations
  async getAllRobots(): Promise<Robot[]> {
    return Array.from(this.robots.values());
  }

  async getRobot(robotId: string): Promise<Robot | undefined> {
    return this.robots.get(robotId);
  }

  async createRobot(robot: InsertRobot): Promise<Robot> {
    const id = this.robotIdCounter++;
    const newRobot: Robot = { 
      ...robot, 
      id,
      lastSeen: new Date()
    };
    this.robots.set(robot.robotId, newRobot);
    return newRobot;
  }

  async updateRobotStatus(robotId: string, status: string, batteryLevel?: number, floor?: string): Promise<boolean> {
    const robot = this.robots.get(robotId);
    if (!robot) return false;
    
    robot.status = status;
    robot.lastSeen = new Date();
    
    if (batteryLevel !== undefined) {
      robot.batteryLevel = batteryLevel;
    }
    
    if (floor) {
      robot.floor = floor;
    }
    
    return true;
  }

  async updateRobotPosition(robotId: string, position: { x: number; y: number; floor: string }): Promise<boolean> {
    const robot = this.robots.get(robotId);
    if (!robot) return false;
    
    robot.floor = position.floor;
    robot.lastSeen = new Date();
    
    return true;
  }

  // POI operations
  async getAllPois(): Promise<Poi[]> {
    return Array.from(this.pois.values());
  }

  async getPoi(poiId: string): Promise<Poi | undefined> {
    return this.pois.get(poiId);
  }

  async createPoi(poi: InsertPoi): Promise<Poi> {
    const id = this.poiIdCounter++;
    const newPoi: Poi = { ...poi, id };
    this.pois.set(poi.poiId, newPoi);
    return newPoi;
  }

  async getChargingPoints(floor: string): Promise<Poi[]> {
    return Array.from(this.pois.values()).filter(poi => 
      poi.type === 'charging' && poi.floor === floor
    );
  }

  // Task operations
  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async getTask(taskId: string): Promise<Task | undefined> {
    return this.tasks.get(taskId);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const id = this.taskIdCounter++;
    const newTask: Task = { 
      ...task, 
      id,
      createdAt: new Date()
    };
    this.tasks.set(task.taskId, newTask);
    return newTask;
  }
  
  async updateTask(task: Task): Promise<Task> {
    if (!task.taskId) {
      throw new Error('Task ID is required for updating a task');
    }
    
    // Preserve the original ID
    const origTask = this.tasks.get(task.taskId);
    if (!origTask) {
      throw new Error(`Task ${task.taskId} not found`);
    }
    
    const updatedTask = {
      ...task,
      id: origTask.id // Make sure we keep the original ID
    };
    
    this.tasks.set(task.taskId, updatedTask);
    return updatedTask;
  }

  async updateTaskStatus(taskId: string, status: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.status = status;
    return true;
  }

  async updateTaskStartTime(taskId: string, startTime: Date): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.startedAt = startTime;
    return true;
  }

  async updateTaskCompletionTime(taskId: string, completionTime: Date): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.completedAt = completionTime;
    return true;
  }

  async updateTaskErrorDetails(taskId: string, errorDetails: any): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.errorDetails = errorDetails;
    return true;
  }

  async getTasksByStatus(status: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  async getActiveTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => 
      task.status === TaskStatus.IN_PROGRESS || 
      task.status === TaskStatus.PENDING || 
      task.status === TaskStatus.PAUSED
    );
  }

  async getTaskHistory(): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => 
      task.status === TaskStatus.COMPLETED || 
      task.status === TaskStatus.FAILED || 
      task.status === TaskStatus.CANCELLED
    );
  }

  async getActiveTasksByRobot(robotId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => 
      task.robotId === robotId && (
        task.status === TaskStatus.IN_PROGRESS || 
        task.status === TaskStatus.PENDING || 
        task.status === TaskStatus.PAUSED
      )
    );
  }

  // Error log operations
  async getAllErrorLogs(): Promise<ErrorLog[]> {
    return Array.from(this.errorLogs.values());
  }

  async getRecentErrorLogs(limit: number): Promise<ErrorLog[]> {
    return Array.from(this.errorLogs.values())
      .filter(log => !log.resolved)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async createErrorLog(errorLog: InsertErrorLog): Promise<ErrorLog> {
    const id = this.errorLogIdCounter++;
    const newErrorLog: ErrorLog = { 
      ...errorLog, 
      id,
      timestamp: new Date()
    };
    this.errorLogs.set(id, newErrorLog);
    return newErrorLog;
  }

  async resolveErrorLog(id: number): Promise<boolean> {
    const errorLog = this.errorLogs.get(id);
    if (!errorLog) return false;
    
    errorLog.resolved = true;
    errorLog.resolvedAt = new Date();
    return true;
  }

  // Map operations
  async getAllMaps(): Promise<Map[]> {
    return Array.from(this.maps.values());
  }

  async getMap(areaId: string): Promise<Map | undefined> {
    return this.maps.get(areaId);
  }

  async createMap(map: InsertMap): Promise<Map> {
    const id = this.mapIdCounter++;
    const newMap: Map = { ...map, id };
    this.maps.set(map.areaId, newMap);
    return newMap;
  }

  // SDK credentials operations
  async getAllSdkCredentials(): Promise<SdkCredentials[]> {
    return Array.from(this.sdkCredentials.values());
  }

  async getActiveSdkCredentials(): Promise<SdkCredentials | undefined> {
    const allCredentials = Array.from(this.sdkCredentials.values());
    return allCredentials.find(cred => cred.isActive);
  }

  async createSdkCredentials(credentials: InsertSdkCredentials): Promise<SdkCredentials> {
    const id = this.sdkCredentialsIdCounter++;
    const newCredentials: SdkCredentials = { ...credentials, id };
    this.sdkCredentials.set(id, newCredentials);
    return newCredentials;
  }

  async updateSdkCredentials(appId: string, appSecret: string, mode: string): Promise<boolean> {
    // Set all existing credentials to inactive
    for (const cred of this.sdkCredentials.values()) {
      cred.isActive = false;
    }
    
    // Create new active credentials
    await this.createSdkCredentials({
      appId,
      appSecret,
      mode,
      isActive: true
    });
    
    return true;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = { ...user, id };
    this.users.set(id, newUser);
    return newUser;
  }
}

// Database-backed storage implementation
import { eq, and, or, desc } from "drizzle-orm";
import { db } from './db';

export class DatabaseStorage implements IStorage {
  // Robot operations
  async getAllRobots(): Promise<Robot[]> {
    return await db.select().from(robots);
  }
  
  // Task operations
  async getTask(taskId: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.taskId, taskId));
    return task || undefined;
  }
  
  async updateTask(task: Task): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set(task)
      .where(eq(tasks.taskId, task.taskId))
      .returning();
    return updatedTask;
  }

  async getRobot(robotId: string): Promise<Robot | undefined> {
    const [robot] = await db.select().from(robots).where(eq(robots.robotId, robotId));
    return robot;
  }

  async createRobot(robot: InsertRobot): Promise<Robot> {
    const [newRobot] = await db.insert(robots).values(robot).returning();
    return newRobot;
  }

  async updateRobotStatus(robotId: string, status: string, batteryLevel?: number, floor?: string): Promise<boolean> {
    const updateData: Partial<Robot> = { 
      status, 
      lastSeen: new Date() 
    };
    
    if (batteryLevel !== undefined) {
      updateData.batteryLevel = batteryLevel;
    }
    
    if (floor) {
      updateData.floor = floor;
    }
    
    const result = await db.update(robots)
      .set(updateData)
      .where(eq(robots.robotId, robotId))
      .returning();
    
    return result.length > 0;
  }

  async updateRobotPosition(robotId: string, position: { x: number; y: number; floor: string }): Promise<boolean> {
    const result = await db.update(robots)
      .set({ 
        floor: position.floor,
        lastSeen: new Date()
      })
      .where(eq(robots.robotId, robotId))
      .returning();
    
    return result.length > 0;
  }
  
  async updateRobotMetadata(robotId: string, metadata: any): Promise<boolean> {
    // First get the current robot to merge with existing metadata
    const [robot] = await db.select().from(robots).where(eq(robots.robotId, robotId));
    
    if (!robot) {
      return false;
    }
    
    // Merge with existing metadata if available
    const currentMetadata = robot.metadata || {};
    const updatedMetadata = { ...currentMetadata, ...metadata };
    
    const result = await db.update(robots)
      .set({ 
        metadata: updatedMetadata,
        lastSeen: new Date()
      })
      .where(eq(robots.robotId, robotId))
      .returning();
    
    return result.length > 0;
  }

  // POI operations
  async getAllPois(): Promise<Poi[]> {
    return await db.select().from(pois);
  }

  async getPoi(poiId: string): Promise<Poi | undefined> {
    const [poi] = await db.select().from(pois).where(eq(pois.poiId, poiId));
    return poi;
  }

  async createPoi(poi: InsertPoi): Promise<Poi> {
    const [newPoi] = await db.insert(pois).values(poi).returning();
    return newPoi;
  }

  async getChargingPoints(floor: string): Promise<Poi[]> {
    return await db.select()
      .from(pois)
      .where(and(
        eq(pois.type, 'charging'),
        eq(pois.floor, floor)
      ));
  }

  // Task operations
  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks);
  }

  async getTask(taskId: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.taskId, taskId));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTaskStatus(taskId: string, status: string): Promise<boolean> {
    const result = await db.update(tasks)
      .set({ status })
      .where(eq(tasks.taskId, taskId))
      .returning();
    
    return result.length > 0;
  }

  async updateTaskStartTime(taskId: string, startTime: Date): Promise<boolean> {
    const result = await db.update(tasks)
      .set({ startedAt: startTime })
      .where(eq(tasks.taskId, taskId))
      .returning();
    
    return result.length > 0;
  }

  async updateTaskCompletionTime(taskId: string, completionTime: Date): Promise<boolean> {
    const result = await db.update(tasks)
      .set({ completedAt: completionTime })
      .where(eq(tasks.taskId, taskId))
      .returning();
    
    return result.length > 0;
  }

  async updateTaskErrorDetails(taskId: string, errorDetails: any): Promise<boolean> {
    const result = await db.update(tasks)
      .set({ errorDetails })
      .where(eq(tasks.taskId, taskId))
      .returning();
    
    return result.length > 0;
  }

  async getTasksByStatus(status: string): Promise<Task[]> {
    return await db.select()
      .from(tasks)
      .where(eq(tasks.status, status));
  }

  async getActiveTasks(): Promise<Task[]> {
    return await db.select()
      .from(tasks)
      .where(or(
        eq(tasks.status, TaskStatus.IN_PROGRESS),
        eq(tasks.status, TaskStatus.PENDING),
        eq(tasks.status, TaskStatus.PAUSED)
      ));
  }

  async getTaskHistory(): Promise<Task[]> {
    return await db.select()
      .from(tasks)
      .where(or(
        eq(tasks.status, TaskStatus.COMPLETED),
        eq(tasks.status, TaskStatus.FAILED),
        eq(tasks.status, TaskStatus.CANCELLED)
      ));
  }

  async getActiveTasksByRobot(robotId: string): Promise<Task[]> {
    return await db.select()
      .from(tasks)
      .where(and(
        eq(tasks.robotId, robotId),
        or(
          eq(tasks.status, TaskStatus.IN_PROGRESS),
          eq(tasks.status, TaskStatus.PENDING),
          eq(tasks.status, TaskStatus.PAUSED)
        )
      ));
  }

  // Error log operations
  async getAllErrorLogs(): Promise<ErrorLog[]> {
    return await db.select().from(errorLogs);
  }

  async getRecentErrorLogs(limit: number): Promise<ErrorLog[]> {
    return await db.select()
      .from(errorLogs)
      .where(eq(errorLogs.resolved, false))
      .orderBy(desc(errorLogs.timestamp))
      .limit(limit);
  }

  async createErrorLog(errorLog: InsertErrorLog): Promise<ErrorLog> {
    const [newErrorLog] = await db.insert(errorLogs)
      .values({
        ...errorLog,
        timestamp: new Date()
      })
      .returning();
    
    return newErrorLog;
  }

  async resolveErrorLog(id: number): Promise<boolean> {
    const result = await db.update(errorLogs)
      .set({ 
        resolved: true,
        resolvedAt: new Date()
      })
      .where(eq(errorLogs.id, id))
      .returning();
    
    return result.length > 0;
  }

  // Map operations
  async getAllMaps(): Promise<Map[]> {
    return await db.select().from(maps);
  }

  async getMap(areaId: string): Promise<Map | undefined> {
    const [map] = await db.select().from(maps).where(eq(maps.areaId, areaId));
    return map;
  }

  async createMap(map: InsertMap): Promise<Map> {
    const [newMap] = await db.insert(maps).values(map).returning();
    return newMap;
  }

  // SDK credentials operations
  async getAllSdkCredentials(): Promise<SdkCredentials[]> {
    return await db.select().from(sdkCredentials);
  }

  async getActiveSdkCredentials(): Promise<SdkCredentials | undefined> {
    const [credentials] = await db.select()
      .from(sdkCredentials)
      .where(eq(sdkCredentials.isActive, true));
    
    return credentials;
  }

  async createSdkCredentials(credentials: InsertSdkCredentials): Promise<SdkCredentials> {
    const [newCredentials] = await db.insert(sdkCredentials)
      .values(credentials)
      .returning();
    
    return newCredentials;
  }

  async updateSdkCredentials(appId: string, appSecret: string, mode: string): Promise<boolean> {
    // First set all to inactive
    await db.update(sdkCredentials)
      .set({ isActive: false });
    
    // Then create new active credentials
    await this.createSdkCredentials({
      appId,
      appSecret,
      mode,
      isActive: true
    });
    
    return true;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
}

export const storage = new DatabaseStorage();
