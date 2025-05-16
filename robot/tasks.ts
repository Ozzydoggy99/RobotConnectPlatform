import { v4 as uuidv4 } from 'uuid';
import { getRobotSdk } from './sdk';
import { handleError, logError } from './errors';
import { storage } from '../storage';
import { 
  Task, 
  TaskRequest, 
  TaskStatus, 
  TaskPoint, 
  StepAction,
  ErrorDetails 
} from '@shared/schema';

// Task management module that handles task creation and control
export class TaskManager {
  /**
   * Create a new task
   */
  static async createTask(taskRequest: TaskRequest): Promise<Task> {
    try {
      // Validate task data
      this.validateTaskRequest(taskRequest);
      
      // Generate task ID
      const taskId = `task_${uuidv4()}`;
      
      // Prepare task points
      const points = this.prepareTaskPoints(taskRequest.points);
      
      // Prepare current point if provided
      const currentPoint = taskRequest.currentPoint 
        ? this.prepareSinglePoint(taskRequest.currentPoint)
        : null;
      
      // Prepare return point if provided
      const returnPoint = taskRequest.returnPoint 
        ? this.prepareSinglePoint(taskRequest.returnPoint) 
        : null;
      
      // Create task in storage
      const task = await storage.createTask({
        taskId,
        name: taskRequest.name,
        robotId: taskRequest.robotId,
        status: TaskStatus.PENDING,
        priority: taskRequest.priority || 'normal',
        taskType: taskRequest.taskType,
        runMode: taskRequest.runMode || 1,
        runNum: taskRequest.runNum || 1,
        runType: taskRequest.runType,
        routeMode: taskRequest.routeMode || 1,
        ignorePublicSite: taskRequest.ignorePublicSite || false,
        speed: taskRequest.speed || -1,
        points,
        currentPoint,
        returnPoint,
        errorDetails: null
      });
      
      return task;
    } catch (error) {
      logError('Create Task Error', error);
      throw handleError(error, 'Failed to create task');
    }
  }
  
  /**
   * Start a task
   */
  static async startTask(taskId: string): Promise<boolean> {
    try {
      // Get task from storage
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Ensure task is in a valid state
      if (task.status !== TaskStatus.PENDING) {
        throw new Error(`Cannot start task in ${task.status} state`);
      }
      
      // Get robot SDK instance
      const robotSdk = await getRobotSdk(task.robotId);
      
      // Prepare task for robot SDK
      const sdkTask = this.prepareTaskForSdk(task);
      
      // Start task on robot
      const success = await robotSdk.startTask(sdkTask);
      
      if (success) {
        // Update task status
        await storage.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);
        
        // Update start time
        await storage.updateTaskStartTime(taskId, new Date());
      }
      
      return success;
    } catch (error) {
      logError('Start Task Error', error);
      throw handleError(error, 'Failed to start task');
    }
  }
  
  /**
   * Pause a task
   */
  static async pauseTask(taskId: string): Promise<boolean> {
    try {
      // Get task from storage
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Ensure task is in a valid state
      if (task.status !== TaskStatus.IN_PROGRESS) {
        throw new Error(`Cannot pause task in ${task.status} state`);
      }
      
      // Get robot SDK instance
      const robotSdk = await getRobotSdk(task.robotId);
      
      // Pause task on robot
      const success = await robotSdk.pauseTask();
      
      if (success) {
        // Update task status
        await storage.updateTaskStatus(taskId, TaskStatus.PAUSED);
      }
      
      return success;
    } catch (error) {
      logError('Pause Task Error', error);
      throw handleError(error, 'Failed to pause task');
    }
  }
  
  /**
   * Resume a task
   */
  static async resumeTask(taskId: string): Promise<boolean> {
    try {
      // Get task from storage
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Ensure task is in a valid state
      if (task.status !== TaskStatus.PAUSED) {
        throw new Error(`Cannot resume task in ${task.status} state`);
      }
      
      // Get robot SDK instance
      const robotSdk = await getRobotSdk(task.robotId);
      
      // Resume task on robot
      const success = await robotSdk.resumeTask();
      
      if (success) {
        // Update task status
        await storage.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);
      }
      
      return success;
    } catch (error) {
      logError('Resume Task Error', error);
      throw handleError(error, 'Failed to resume task');
    }
  }
  
  /**
   * Cancel a task
   */
  static async cancelTask(taskId: string): Promise<boolean> {
    try {
      // Get task from storage
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Check if task can be cancelled
      if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
        throw new Error(`Cannot cancel task in ${task.status} state`);
      }
      
      // Get robot SDK instance
      const robotSdk = await getRobotSdk(task.robotId);
      
      // Cancel task on robot
      const success = await robotSdk.cancelTask();
      
      if (success) {
        // Update task status
        await storage.updateTaskStatus(taskId, TaskStatus.CANCELLED);
      }
      
      return success;
    } catch (error) {
      logError('Cancel Task Error', error);
      throw handleError(error, 'Failed to cancel task');
    }
  }
  
  /**
   * Retry a failed task
   */
  static async retryTask(taskId: string): Promise<boolean> {
    try {
      // Get task from storage
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Ensure task is in a valid state
      if (task.status !== TaskStatus.FAILED) {
        throw new Error(`Cannot retry task in ${task.status} state`);
      }
      
      // Get robot SDK instance
      const robotSdk = await getRobotSdk(task.robotId);
      
      // Clear error details
      await storage.updateTaskErrorDetails(taskId, null);
      
      // Retry task on robot
      const success = await robotSdk.retryTask();
      
      if (success) {
        // Update task status
        await storage.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);
      }
      
      return success;
    } catch (error) {
      logError('Retry Task Error', error);
      throw handleError(error, 'Failed to retry task');
    }
  }
  
  /**
   * Complete a task (usually called internally or from webhook)
   */
  static async completeTask(taskId: string): Promise<boolean> {
    try {
      // Get task from storage
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Update task status
      await storage.updateTaskStatus(taskId, TaskStatus.COMPLETED);
      
      // Update completion time
      await storage.updateTaskCompletionTime(taskId, new Date());
      
      return true;
    } catch (error) {
      logError('Complete Task Error', error);
      throw handleError(error, 'Failed to complete task');
    }
  }
  
  /**
   * Handle task failure
   */
  static async failTask(taskId: string, errorDetails: ErrorDetails): Promise<boolean> {
    try {
      // Get task from storage
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Update task status
      await storage.updateTaskStatus(taskId, TaskStatus.FAILED);
      
      // Update error details
      await storage.updateTaskErrorDetails(taskId, errorDetails);
      
      return true;
    } catch (error) {
      logError('Fail Task Error', error);
      throw handleError(error, 'Failed to mark task as failed');
    }
  }
  
  /**
   * Pause all tasks for a specific robot
   */
  static async pauseAllTasks(robotId: string): Promise<boolean> {
    try {
      // Get active tasks for robot
      const activeTasks = await storage.getActiveTasksByRobot(robotId);
      
      // Get robot SDK instance
      const robotSdk = await getRobotSdk(robotId);
      
      // Pause current task on robot
      const success = await robotSdk.pauseTask();
      
      if (success) {
        // Update all active tasks to paused
        for (const task of activeTasks) {
          await storage.updateTaskStatus(task.taskId, TaskStatus.PAUSED);
        }
      }
      
      return success;
    } catch (error) {
      logError('Pause All Tasks Error', error);
      throw handleError(error, 'Failed to pause all tasks');
    }
  }
  
  /**
   * Get task progress based on completed points
   */
  static calculateTaskProgress(task: Task): number {
    if (!task.points || task.points.length === 0) {
      return 0;
    }
    
    // If task is completed, return 100%
    if (task.status === TaskStatus.COMPLETED) {
      return 100;
    }
    
    // If task hasn't started, return 0%
    if (!task.currentPoint || task.status === TaskStatus.PENDING) {
      return 0;
    }
    
    // Find current point index in points array
    let currentPointIndex = -1;
    
    for (let i = 0; i < task.points.length; i++) {
      const point = task.points[i];
      
      if (point.x === task.currentPoint.x && point.y === task.currentPoint.y && point.areaId === task.currentPoint.areaId) {
        currentPointIndex = i;
        break;
      }
    }
    
    // If current point not found in path, assume we're at the first point
    if (currentPointIndex === -1) {
      currentPointIndex = 0;
    }
    
    // Calculate progress percentage
    return Math.round((currentPointIndex / task.points.length) * 100);
  }
  
  // Helper methods
  private static validateTaskRequest(taskRequest: TaskRequest): void {
    // Ensure required fields are present
    if (!taskRequest.name) {
      throw new Error('Task name is required');
    }
    
    if (!taskRequest.robotId) {
      throw new Error('Robot ID is required');
    }
    
    if (!taskRequest.taskType) {
      throw new Error('Task type is required');
    }
    
    if (!taskRequest.points || !Array.isArray(taskRequest.points) || taskRequest.points.length === 0) {
      throw new Error('At least one point is required');
    }
  }
  
  private static prepareTaskPoints(points: any[]): TaskPoint[] {
    return points.map(point => this.prepareSinglePoint(point));
  }
  
  private static prepareSinglePoint(point: any): TaskPoint {
    return {
      x: point.x,
      y: point.y,
      yaw: point.yaw || 0,
      areaId: point.areaId,
      type: point.type !== undefined ? point.type : -1,
      stopRadius: point.stopRadius || point.dockingRadius || 1,
      ext: point.ext ? {
        id: point.ext.id || undefined,
        name: point.ext.name || undefined
      } : undefined,
      stepActs: point.stepActs ? this.prepareStepActions(point.stepActs) : undefined
    };
  }
  
  private static prepareStepActions(stepActs: any[]): StepAction[] {
    return stepActs.map(act => ({
      type: act.type,
      data: act.data || undefined
    }));
  }
  
  private static prepareTaskForSdk(task: Task): any {
    // Format task for SDK
    return {
      name: task.name,
      robotId: task.robotId,
      runNum: task.runNum,
      taskType: task.taskType,
      runType: task.runType,
      routeMode: task.routeMode,
      runMode: task.runMode,
      ignorePublicSite: task.ignorePublicSite,
      speed: task.speed,
      curPt: task.currentPoint || undefined,
      pts: task.points,
      backPt: task.returnPoint || undefined
    };
  }
}
