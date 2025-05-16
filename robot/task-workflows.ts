import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import * as directApi from './direct-api';
import { MovementModule } from './movement';
import { ErrorCode, RobotError, logError } from './errors';
import { websocketHandler } from '../websocket';
import { Task, TaskStatus, TaskType, TaskPoint } from '@shared/schema';

/**
 * Robot task interface - Using Task from shared/schema.ts
 * This is a placeholder interface for reference - we use the imported types
 */
interface WorkflowTask {
  taskId: string;            // Unique task ID
  name: string;              // Task name
  robotId: string;           // Robot ID assigned to task
  status: string;            // Current status (using TaskStatus constants)
  taskType: string;          // Type of task (using TaskType constants)
  priority: string;          // Priority
  createdAt: Date;           // Creation timestamp
  startedAt?: Date;          // Start timestamp
  completedAt?: Date;        // Completion timestamp
  currentStep?: number;      // Current workflow step
  currentPoint?: any;        // Current point robot is moving to
  runMode?: number;          // Run mode
  runNum?: number;           // Run number
  errorDetails?: any;        // Error details if failed
  points: any[];             // Points to visit
  payload?: any;             // Payload/item being transported
  returnPoint?: any;         // Return point for when tasks are canceled
}

/**
 * Task handler type
 */
type TaskHandler = (task: Task) => Promise<boolean>;

/**
 * Task workflow interface
 */
interface TaskWorkflow {
  name: string;
  taskType: TaskType;
  steps: TaskHandler[];
  initialize(task: Task): Promise<void>;
  execute(task: Task): Promise<boolean>;
}

/**
 * Base task workflow class
 */
abstract class BaseTaskWorkflow implements TaskWorkflow {
  name: string;
  taskType: TaskType;
  steps: TaskHandler[] = [];
  
  constructor(name: string, taskType: TaskType) {
    this.name = name;
    this.taskType = taskType;
  }
  
  /**
   * Add step to workflow
   */
  protected addStep(handler: TaskHandler): void {
    this.steps.push(handler);
  }
  
  /**
   * Initialize task
   */
  async initialize(task: Task): Promise<void> {
    // Override in subclasses if needed
  }
  
  /**
   * Execute task workflow
   */
  async execute(task: Task): Promise<boolean> {
    console.log(`Executing task ${task.taskId} workflow: ${this.name}`);
    
    // Get fresh task data
    const currentTask = await storage.getTask(task.taskId);
    if (!currentTask) {
      throw new RobotError(`Task not found: ${task.taskId}`, ErrorCode.TASK_NOT_FOUND);
    }
    
    // Skip already completed or failed tasks
    if (currentTask.status === TaskStatus.COMPLETED || 
        currentTask.status === TaskStatus.FAILED ||
        currentTask.status === TaskStatus.CANCELED) {
      return true;
    }
    
    try {
      // Get current step
      let currentStep = currentTask.currentStep || 0;
      
      // Mark as started if first step
      if (currentStep === 0) {
        await storage.updateTaskStatus(task.taskId, TaskStatus.IN_PROGRESS);
        await storage.updateTaskStartTime(task.taskId, new Date());
        
        // Broadcast task update
        websocketHandler.broadcastTaskUpdate(task.taskId, {
          status: TaskStatus.IN_PROGRESS,
          startedAt: new Date()
        });
      }
      
      // Execute remaining steps
      while (currentStep < this.steps.length) {
        console.log(`Executing step ${currentStep + 1}/${this.steps.length} for task ${task.taskId}`);
        
        // Get step handler
        const stepHandler = this.steps[currentStep];
        
        // Execute step
        const stepResult = await stepHandler(currentTask);
        
        // If step failed, stop workflow
        if (!stepResult) {
          console.log(`Step ${currentStep + 1} failed for task ${task.taskId}`);
          return false;
        }
        
        // Update current step
        currentStep++;
        await storage.updateTaskCurrentStep(task.taskId, currentStep);
        
        // Broadcast step update
        websocketHandler.broadcastTaskUpdate(task.taskId, {
          currentStep
        });
      }
      
      // Mark as completed
      await storage.updateTaskStatus(task.taskId, TaskStatus.COMPLETED);
      await storage.updateTaskCompletionTime(task.taskId, new Date());
      
      // Broadcast completion
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        status: TaskStatus.COMPLETED,
        completedAt: new Date()
      });
      
      console.log(`Task ${task.taskId} completed successfully`);
      return true;
    } catch (error) {
      console.error(`Error executing workflow for task ${task.taskId}:`, error);
      
      // Mark as failed
      await storage.updateTaskStatus(task.taskId, TaskStatus.FAILED);
      
      // Add error details
      const errorDetails = {
        code: error instanceof RobotError ? error.code : ErrorCode.TASK_EXECUTION_FAILED,
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 5, // Workflow error
        level: 2, // Error level
        priority: true
      };
      
      await storage.updateTaskErrorDetails(task.taskId, errorDetails);
      
      // Broadcast failure
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        status: TaskStatus.FAILED,
        errorDetails
      });
      
      return false;
    }
  }
}

/**
 * Dropoff task workflow (charger → dropoff → shelf → charger)
 */
class DropoffWorkflow extends BaseTaskWorkflow {
  constructor() {
    super('Dropoff Workflow', TaskType.DROPOFF);
    
    // Add workflow steps
    this.addStep(this.moveToDropoffPoint.bind(this));
    this.addStep(this.waitForLoad.bind(this));
    this.addStep(this.moveToShelf.bind(this));
    this.addStep(this.waitForUnload.bind(this));
    this.addStep(this.checkForPickupTasks.bind(this));
    this.addStep(this.returnToCharger.bind(this));
  }
  
  /**
   * Initialize dropoff task
   */
  async initialize(task: Task): Promise<void> {
    // Verify task has all required points
    if (!task.points || task.points.length < 3) {
      throw new RobotError(
        'Dropoff task requires at least 3 points: dropoff, shelf, and charger', 
        ErrorCode.INVALID_TASK_CONFIGURATION
      );
    }
    
    // Check point types
    const dropoffPoint = task.points.find(p => p.type === 'dropoff');
    const shelfPoint = task.points.find(p => p.type === 'shelf');
    const chargerPoint = task.points.find(p => p.type === 'charger');
    
    if (!dropoffPoint || !shelfPoint || !chargerPoint) {
      throw new RobotError(
        'Dropoff task requires dropoff, shelf, and charger points', 
        ErrorCode.INVALID_TASK_CONFIGURATION
      );
    }
    
    // Set return point (charger)
    await storage.updateTaskReturnPoint(task.taskId, chargerPoint);
  }
  
  /**
   * Move to dropoff point
   */
  private async moveToDropoffPoint(task: Task): Promise<boolean> {
    try {
      // Find dropoff point
      const dropoffPoint = task.points.find(p => p.type === 'dropoff');
      if (!dropoffPoint) {
        throw new RobotError('Dropoff point not found', ErrorCode.INVALID_TASK_CONFIGURATION);
      }
      
      // Update current point
      await storage.updateTaskCurrentPoint(task.taskId, dropoffPoint);
      
      // Move robot to dropoff point
      await MovementModule.moveRobot({
        robotId: task.robotId,
        points: [dropoffPoint],
        type: 'standard',
        speed: 0.5, // Moderate speed
        accuracy: 0.1 // 10cm accuracy
      });
      
      // Broadcast point update
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        currentPoint: dropoffPoint
      });
      
      return true;
    } catch (error) {
      logError(`Failed to move to dropoff point for task ${task.taskId}`, error);
      return false;
    }
  }
  
  /**
   * Wait for loading at dropoff point
   */
  private async waitForLoad(task: Task): Promise<boolean> {
    try {
      // Send notification that robot arrived at dropoff
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        status: 'waiting_for_load',
        message: 'Robot arrived at dropoff point. Please load item.'
      });
      
      // In a real implementation, this would wait for confirmation
      // For now, we'll simulate a wait
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second wait
      
      // Update payload information
      await storage.updateTaskPayload(task.taskId, {
        loaded: true,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      logError(`Failed to wait for load for task ${task.taskId}`, error);
      return false;
    }
  }
  
  /**
   * Move to shelf
   */
  private async moveToShelf(task: Task): Promise<boolean> {
    try {
      // Find shelf point
      const shelfPoint = task.points.find(p => p.type === 'shelf');
      if (!shelfPoint) {
        throw new RobotError('Shelf point not found', ErrorCode.INVALID_TASK_CONFIGURATION);
      }
      
      // Update current point
      await storage.updateTaskCurrentPoint(task.taskId, shelfPoint);
      
      // Move robot to shelf point
      await MovementModule.moveRobot({
        robotId: task.robotId,
        points: [shelfPoint],
        type: 'standard',
        speed: 0.3, // Slower speed because carrying item
        accuracy: 0.05 // 5cm accuracy for precise positioning
      });
      
      // Broadcast point update
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        currentPoint: shelfPoint
      });
      
      return true;
    } catch (error) {
      logError(`Failed to move to shelf for task ${task.taskId}`, error);
      return false;
    }
  }
  
  /**
   * Wait for unloading at shelf
   */
  private async waitForUnload(task: Task): Promise<boolean> {
    try {
      // Send notification that robot arrived at shelf
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        status: 'waiting_for_unload',
        message: 'Robot arrived at shelf. Please unload item.'
      });
      
      // In a real implementation, this would wait for confirmation
      // For now, we'll simulate a wait
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second wait
      
      // Update payload information
      await storage.updateTaskPayload(task.taskId, {
        loaded: false,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      logError(`Failed to wait for unload for task ${task.taskId}`, error);
      return false;
    }
  }
  
  /**
   * Check for pending pickup tasks before returning to charger
   */
  private async checkForPickupTasks(task: Task): Promise<boolean> {
    try {
      // Check for pending pickup tasks from the same floor
      const robot = await storage.getRobot(task.robotId);
      if (!robot) {
        return true; // Skip if robot not found
      }
      
      // Look for pending high-priority pickup tasks on this floor
      const pendingPickupTasks = await storage.getPendingTasksByType(TaskType.PICKUP);
      const sameFloorPickupTasks = pendingPickupTasks.filter(t => {
        // Check if pickup task is on same floor
        const firstPoint = t.points[0];
        return firstPoint && firstPoint.floor === robot.floor && t.priority === 'high';
      });
      
      // If found pending pickup tasks, assign the first one to this robot
      if (sameFloorPickupTasks.length > 0) {
        const pickupTask = sameFloorPickupTasks[0];
        await storage.updateTaskStatus(pickupTask.taskId, TaskStatus.ASSIGNED);
        await storage.updateTaskRobot(pickupTask.taskId, task.robotId);
        
        console.log(`Assigned pickup task ${pickupTask.taskId} to robot ${task.robotId}`);
        
        // Update current task with a note
        await storage.updateTaskNotes(task.taskId, `Next task: ${pickupTask.taskId}`);
      }
      
      return true;
    } catch (error) {
      logError(`Failed to check pending pickup tasks for task ${task.taskId}`, error);
      // Non-critical error, continue workflow
      return true;
    }
  }
  
  /**
   * Return to charging station
   */
  private async returnToCharger(task: Task): Promise<boolean> {
    try {
      // Find charger point
      const chargerPoint = task.points.find(p => p.type === 'charger');
      if (!chargerPoint) {
        throw new RobotError('Charger point not found', ErrorCode.INVALID_TASK_CONFIGURATION);
      }
      
      // Update current point
      await storage.updateTaskCurrentPoint(task.taskId, chargerPoint);
      
      // Move robot to charger
      await MovementModule.moveRobot({
        robotId: task.robotId,
        points: [chargerPoint],
        type: 'charge', // Special mode for docking
        speed: 0.3,
        accuracy: 0.05 // Precise docking
      });
      
      // Broadcast point update
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        currentPoint: chargerPoint
      });
      
      return true;
    } catch (error) {
      logError(`Failed to return to charger for task ${task.taskId}`, error);
      return false;
    }
  }
}

/**
 * Pickup task workflow (charger → shelf → pickup → charger)
 */
class PickupWorkflow extends BaseTaskWorkflow {
  constructor() {
    super('Pickup Workflow', TaskType.PICKUP);
    
    // Add workflow steps
    this.addStep(this.moveToShelf.bind(this));
    this.addStep(this.waitForLoad.bind(this));
    this.addStep(this.moveToPickupPoint.bind(this));
    this.addStep(this.waitForUnload.bind(this));
    this.addStep(this.returnToCharger.bind(this));
  }
  
  /**
   * Initialize pickup task
   */
  async initialize(task: Task): Promise<void> {
    // Verify task has all required points
    if (!task.points || task.points.length < 3) {
      throw new RobotError(
        'Pickup task requires at least 3 points: shelf, pickup, and charger', 
        ErrorCode.INVALID_TASK_CONFIGURATION
      );
    }
    
    // Check point types
    const shelfPoint = task.points.find(p => p.type === 'shelf');
    const pickupPoint = task.points.find(p => p.type === 'pickup');
    const chargerPoint = task.points.find(p => p.type === 'charger');
    
    if (!shelfPoint || !pickupPoint || !chargerPoint) {
      throw new RobotError(
        'Pickup task requires shelf, pickup, and charger points', 
        ErrorCode.INVALID_TASK_CONFIGURATION
      );
    }
    
    // Set return point (in case task is canceled while robot is carrying a bin)
    await storage.updateTaskReturnPoint(task.taskId, pickupPoint);
  }
  
  /**
   * Move to shelf
   */
  private async moveToShelf(task: Task): Promise<boolean> {
    try {
      // Find shelf point
      const shelfPoint = task.points.find(p => p.type === 'shelf');
      if (!shelfPoint) {
        throw new RobotError('Shelf point not found', ErrorCode.INVALID_TASK_CONFIGURATION);
      }
      
      // Update current point
      await storage.updateTaskCurrentPoint(task.taskId, shelfPoint);
      
      // Move robot to shelf point
      await MovementModule.moveRobot({
        robotId: task.robotId,
        points: [shelfPoint],
        type: 'standard',
        speed: 0.5, // Normal speed
        accuracy: 0.05 // 5cm accuracy for precise positioning
      });
      
      // Broadcast point update
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        currentPoint: shelfPoint
      });
      
      return true;
    } catch (error) {
      logError(`Failed to move to shelf for task ${task.taskId}`, error);
      return false;
    }
  }
  
  /**
   * Wait for loading at shelf
   */
  private async waitForLoad(task: Task): Promise<boolean> {
    try {
      // Send notification that robot arrived at shelf
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        status: 'waiting_for_load',
        message: 'Robot arrived at shelf. Please load item.'
      });
      
      // In a real implementation, this would wait for confirmation
      // For now, we'll simulate a wait
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second wait
      
      // Update payload information
      await storage.updateTaskPayload(task.taskId, {
        loaded: true,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      logError(`Failed to wait for load for task ${task.taskId}`, error);
      return false;
    }
  }
  
  /**
   * Move to pickup point
   */
  private async moveToPickupPoint(task: Task): Promise<boolean> {
    try {
      // Find pickup point
      const pickupPoint = task.points.find(p => p.type === 'pickup');
      if (!pickupPoint) {
        throw new RobotError('Pickup point not found', ErrorCode.INVALID_TASK_CONFIGURATION);
      }
      
      // Update current point
      await storage.updateTaskCurrentPoint(task.taskId, pickupPoint);
      
      // Move robot to pickup point
      await MovementModule.moveRobot({
        robotId: task.robotId,
        points: [pickupPoint],
        type: 'standard',
        speed: 0.3, // Slower because carrying item
        accuracy: 0.1 // 10cm accuracy
      });
      
      // Broadcast point update
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        currentPoint: pickupPoint
      });
      
      return true;
    } catch (error) {
      logError(`Failed to move to pickup point for task ${task.taskId}`, error);
      return false;
    }
  }
  
  /**
   * Wait for unloading at pickup point
   */
  private async waitForUnload(task: Task): Promise<boolean> {
    try {
      // Send notification that robot arrived at pickup
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        status: 'waiting_for_unload',
        message: 'Robot arrived at pickup point. Please unload item.'
      });
      
      // In a real implementation, this would wait for confirmation
      // For now, we'll simulate a wait
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second wait
      
      // Update payload information
      await storage.updateTaskPayload(task.taskId, {
        loaded: false,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      logError(`Failed to wait for unload for task ${task.taskId}`, error);
      return false;
    }
  }
  
  /**
   * Return to charging station
   */
  private async returnToCharger(task: Task): Promise<boolean> {
    try {
      // Find charger point
      const chargerPoint = task.points.find(p => p.type === 'charger');
      if (!chargerPoint) {
        throw new RobotError('Charger point not found', ErrorCode.INVALID_TASK_CONFIGURATION);
      }
      
      // Update current point
      await storage.updateTaskCurrentPoint(task.taskId, chargerPoint);
      
      // Move robot to charger
      await MovementModule.moveRobot({
        robotId: task.robotId,
        points: [chargerPoint],
        type: 'charge', // Special mode for docking
        speed: 0.3,
        accuracy: 0.05 // Precise docking
      });
      
      // Broadcast point update
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        currentPoint: chargerPoint
      });
      
      return true;
    } catch (error) {
      logError(`Failed to return to charger for task ${task.taskId}`, error);
      return false;
    }
  }
}

/**
 * Return-to-charger task workflow
 */
class ReturnWorkflow extends BaseTaskWorkflow {
  constructor() {
    super('Return Workflow', TaskType.RETURN);
    
    // Add workflow steps
    this.addStep(this.returnToCharger.bind(this));
  }
  
  /**
   * Initialize return task
   */
  async initialize(task: Task): Promise<void> {
    // Verify task has charger point
    if (!task.points || task.points.length < 1) {
      throw new RobotError(
        'Return task requires at least 1 point: charger', 
        ErrorCode.INVALID_TASK_CONFIGURATION
      );
    }
    
    // Check point types
    const chargerPoint = task.points.find(p => p.type === 'charger');
    
    if (!chargerPoint) {
      throw new RobotError(
        'Return task requires charger point', 
        ErrorCode.INVALID_TASK_CONFIGURATION
      );
    }
    
    // Set return point
    await storage.updateTaskReturnPoint(task.taskId, chargerPoint);
  }
  
  /**
   * Return to charging station
   */
  private async returnToCharger(task: Task): Promise<boolean> {
    try {
      // Find charger point
      const chargerPoint = task.points.find(p => p.type === 'charger');
      if (!chargerPoint) {
        throw new RobotError('Charger point not found', ErrorCode.INVALID_TASK_CONFIGURATION);
      }
      
      // Update current point
      await storage.updateTaskCurrentPoint(task.taskId, chargerPoint);
      
      // Move robot to charger
      await MovementModule.moveRobot({
        robotId: task.robotId,
        points: [chargerPoint],
        type: 'charge', // Special mode for docking
        speed: 0.5,
        accuracy: 0.05 // Precise docking
      });
      
      // Broadcast point update
      websocketHandler.broadcastTaskUpdate(task.taskId, {
        currentPoint: chargerPoint
      });
      
      return true;
    } catch (error) {
      logError(`Failed to return to charger for task ${task.taskId}`, error);
      return false;
    }
  }
}

/**
 * Task workflow factory
 */
class TaskWorkflowFactory {
  private static workflows: Map<TaskType, TaskWorkflow> = new Map();
  
  /**
   * Register task workflow
   */
  static registerWorkflow(workflow: TaskWorkflow): void {
    this.workflows.set(workflow.taskType, workflow);
    console.log(`Registered workflow: ${workflow.name}`);
  }
  
  /**
   * Get workflow for task type
   */
  static getWorkflow(taskType: TaskType): TaskWorkflow | undefined {
    return this.workflows.get(taskType);
  }
  
  /**
   * Create and initialize new task
   */
  static async createTask(taskData: Partial<Task>): Promise<Task> {
    // Generate task ID
    const taskId = taskData.taskId || uuidv4();
    
    // Validate required fields
    if (!taskData.robotId) {
      throw new RobotError('Robot ID is required', ErrorCode.INVALID_TASK_CONFIGURATION);
    }
    
    if (!taskData.taskType) {
      throw new RobotError('Task type is required', ErrorCode.INVALID_TASK_CONFIGURATION);
    }
    
    // Get workflow for task type
    const workflow = this.getWorkflow(taskData.taskType as TaskType);
    if (!workflow) {
      throw new RobotError(`No workflow registered for task type: ${taskData.taskType}`, ErrorCode.INVALID_TASK_CONFIGURATION);
    }
    
    // Create task
    const task: Task = {
      taskId,
      name: taskData.name || `${taskData.taskType} Task`,
      robotId: taskData.robotId,
      status: TaskStatus.PENDING,
      taskType: taskData.taskType as TaskType,
      priority: taskData.priority || 'medium',
      createdAt: new Date(),
      currentStep: 0,
      runMode: taskData.runMode,
      runNum: taskData.runNum,
      points: taskData.points || [],
      payload: taskData.payload || null,
      errorDetails: null
    };
    
    // Store task
    await storage.createTask(task);
    
    // Initialize workflow
    await workflow.initialize(task);
    
    // Broadcast task creation
    websocketHandler.broadcastTaskUpdate(taskId, {
      status: TaskStatus.PENDING,
      taskType: task.taskType,
      robotId: task.robotId,
      createdAt: task.createdAt
    });
    
    return task;
  }
  
  /**
   * Execute task by ID
   */
  static async executeTask(taskId: string): Promise<boolean> {
    // Get task
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new RobotError(`Task not found: ${taskId}`, ErrorCode.TASK_NOT_FOUND);
    }
    
    // Skip if already completed or failed
    if (task.status === TaskStatus.COMPLETED || 
        task.status === TaskStatus.FAILED ||
        task.status === TaskStatus.CANCELED) {
      console.log(`Task ${taskId} already in terminal state: ${task.status}`);
      return true;
    }
    
    // Get workflow for task type
    const workflow = this.getWorkflow(task.taskType as TaskType);
    if (!workflow) {
      throw new RobotError(`No workflow registered for task type: ${task.taskType}`, ErrorCode.INVALID_TASK_CONFIGURATION);
    }
    
    // Execute workflow
    return workflow.execute(task);
  }
  
  /**
   * Cancel task with safety checks
   */
  static async cancelTask(taskId: string): Promise<boolean> {
    // Get task
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new RobotError(`Task not found: ${taskId}`, ErrorCode.TASK_NOT_FOUND);
    }
    
    // Skip if already completed, failed, or canceled
    if (task.status === TaskStatus.COMPLETED || 
        task.status === TaskStatus.FAILED ||
        task.status === TaskStatus.CANCELED) {
      console.log(`Task ${taskId} already in terminal state: ${task.status}`);
      return true;
    }
    
    try {
      console.log(`Canceling task ${taskId}`);
      
      // Cancel current robot movement
      await directApi.cancelMoveAction(task.robotId);
      
      // Check if robot is carrying a bin (based on payload status)
      if (task.payload && task.payload.loaded === true) {
        console.log(`Robot is carrying bin for task ${taskId}, sending to return point first`);
        
        // If robot is carrying a bin, send it to the return point first
        if (task.returnPoint) {
          // Move robot to return point
          await MovementModule.moveRobot({
            robotId: task.robotId,
            points: [task.returnPoint],
            type: 'standard',
            speed: 0.3, // Slower because carrying item
            accuracy: 0.1
          });
          
          // Update task status
          await storage.updateTaskStatus(taskId, TaskStatus.CANCELED);
          await storage.updateTaskNotes(taskId, 'Task canceled; robot returned bin to return point');
        } else {
          // No return point set, update with error
          await storage.updateTaskStatus(taskId, TaskStatus.CANCELED);
          await storage.updateTaskNotes(taskId, 'Task canceled; WARNING: No return point set for bin return');
        }
      } else {
        // Robot not carrying bin, simply cancel
        await storage.updateTaskStatus(taskId, TaskStatus.CANCELED);
        await storage.updateTaskNotes(taskId, 'Task canceled');
      }
      
      // Broadcast task cancellation
      websocketHandler.broadcastTaskUpdate(taskId, {
        status: TaskStatus.CANCELED
      });
      
      return true;
    } catch (error) {
      logError(`Failed to cancel task ${taskId}`, error);
      
      // Mark as failed if cancellation fails
      await storage.updateTaskStatus(taskId, TaskStatus.FAILED);
      
      // Add error details
      const errorDetails = {
        code: error instanceof RobotError ? error.code : ErrorCode.TASK_CANCELLATION_FAILED,
        message: error instanceof Error ? error.message : 'Failed to cancel task',
        type: 5,
        level: 2,
        priority: true
      };
      
      await storage.updateTaskErrorDetails(taskId, errorDetails);
      
      return false;
    }
  }
}

// Register workflows
TaskWorkflowFactory.registerWorkflow(new DropoffWorkflow());
TaskWorkflowFactory.registerWorkflow(new PickupWorkflow());
TaskWorkflowFactory.registerWorkflow(new ReturnWorkflow());

// Export only TaskWorkflowFactory to avoid conflicts with shared/schema.ts
export {
  TaskWorkflowFactory
};