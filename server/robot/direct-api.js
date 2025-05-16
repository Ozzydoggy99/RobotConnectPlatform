/**
 * AutoXing Robot Direct API
 * This module implements the AutoXing Task API for robot control and movement.
 * Based on API documentation from AutoXing.
 */
import axios from 'axios';
import WebSocket from 'ws';

// Store configured robots and their connections
const robotConfigs = new Map();
const robotApiClients = new Map();
const robotWsConnections = new Map();
const robotTaskStatuses = new Map();

/**
 * Configure a robot for API connections
 * @param {string} robotId - Robot serial number
 * @param {Object} config - Configuration object
 * @returns {Object} - Result of configuration
 */
export function configureRobot(robotId, config) {
  // Store the configuration with proper defaults based on documentation
  robotConfigs.set(robotId, {
    publicIp: config.publicIp,
    localIp: config.localIp || config.publicIp,
    port: config.port || 8090, // Default port from documentation
    wsPort: config.wsPort || 8090, // Same port typically used for WebSocket
    useSsl: config.useSsl || false,
    appCode: config.appCode || '667a51a4d948433081a272c78d10a8a4', // Default from our test connection
    appId: config.appId || '',
    appSecret: config.appSecret || '',
    appMode: config.appMode || 'WAN_APP' // Wide Area Network application mode
  });
  
  console.log(`Robot ${robotId} configured with:`, {
    publicIp: config.publicIp,
    port: config.port || 8090,
    wsPort: config.wsPort || 8090
  });
  
  return {
    robotId,
    config: { 
      publicIp: config.publicIp,
      port: config.port || 8090,
      wsPort: config.wsPort || 8090
    }
  };
}

/**
 * Get robot API URL for a specific endpoint
 * @param {string} robotId - Robot identifier
 * @param {string} endpoint - API endpoint (with leading slash)
 * @returns {string} - Complete URL for the API endpoint
 */
export function getRobotApiUrl(robotId, endpoint) {
  const config = robotConfigs.get(robotId);
  if (!config) {
    throw new Error(`Robot ${robotId} not configured`);
  }
  
  const protocol = config.useSsl ? 'https' : 'http';
  return `${protocol}://${config.publicIp}:${config.port}${endpoint}`;
}

/**
 * Connect to robot's WebSocket for real-time data
 * 
 * @param {string} robotId - Robot identifier
 * @param {Array<string>} topics - Topics to subscribe to (see documentation for available topics)
 * @param {Function} messageHandler - Function to handle incoming messages
 * @returns {WebSocket} - WebSocket connection
 */
export function connectToRobotWebSocket(robotId, topics = ['/battery_state', '/tracked_pose'], messageHandler) {
  // Get robot configuration
  const config = robotConfigs.get(robotId);
  if (!config) {
    throw new Error(`Robot ${robotId} not configured`);
  }
  
  // Check if there's an existing connection
  if (robotWsConnections.has(robotId)) {
    console.log(`Using existing WebSocket connection for robot ${robotId}`);
    const existingWs = robotWsConnections.get(robotId);
    
    // If the connection is already open, subscribe to new topics
    if (existingWs.readyState === WebSocket.OPEN) {
      topics.forEach(topic => {
        console.log(`Subscribing to additional topic ${topic} for robot ${robotId}`);
        existingWs.send(JSON.stringify({
          "enable_topic": topic
        }));
      });
    }
    
    return existingWs;
  }
  
  // Create WebSocket URL with the correct path based on documentation
  const protocol = config.useSsl ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${config.publicIp}:${config.wsPort}/ws/v2/topics`;
  
  console.log(`Connecting to WebSocket for robot ${robotId} at ${wsUrl}`);
  
  // Create WebSocket connection
  const ws = new WebSocket(wsUrl);
  
  // Set up event handlers
  ws.on('open', () => {
    console.log(`WebSocket connection opened for robot ${robotId}`);
    
    // Subscribe to topics - using the exact format from documentation
    topics.forEach(topic => {
      console.log(`Subscribing to topic ${topic} for robot ${robotId}`);
      
      // Exact format from documentation: {"enable_topic": "/topic_name"}
      try {
        ws.send(JSON.stringify({
          "enable_topic": topic
        }));
      } catch (err) {
        console.error(`Error subscribing to topic ${topic}:`, err);
      }
    });
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Process special topics for monitoring
      if (message.topic === '/planning_state') {
        // Update task status information
        updateTaskStatus(robotId, message);
      } else if (message.topic === '/battery_state') {
        // Store battery information
        updateBatteryStatus(robotId, message);
      } else if (message.topic === '/tracked_pose') {
        // Store position information
        updatePoseStatus(robotId, message);
      } else if (message.topic === '/alerts') {
        // Store alerts information
        updateAlerts(robotId, message);
      } else if (message.enabled_topics) {
        // Handle topic subscription confirmation
        console.log(`Robot ${robotId} subscribed to topics:`, message.enabled_topics);
      }
      
      // Pass to external handler if provided
      if (messageHandler) {
        messageHandler(message);
      }
    } catch (error) {
      console.error(`Error parsing WebSocket message for robot ${robotId}:`, error.message);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for robot ${robotId}:`, error.message);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket connection closed for robot ${robotId}:`, code, reason.toString());
    // Remove from connections map
    robotWsConnections.delete(robotId);
  });
  
  // Store the connection for later use
  robotWsConnections.set(robotId, ws);
  
  return ws;
}

/**
 * Process and store task status updates from WebSocket
 * @param {string} robotId - Robot identifier
 * @param {Object} data - WebSocket message data
 */
function updateTaskStatus(robotId, data) {
  // Extract relevant task information
  const taskStatus = {
    actionId: data.action_id,
    actionType: data.action_type,
    moveState: data.move_state,
    failReason: data.fail_reason,
    failReasonStr: data.fail_reason_str,
    remainingDistance: data.remaining_distance,
    targetPoses: data.target_poses,
    stuckState: data.stuck_state,
    timestamp: new Date(),
    rawData: data
  };
  
  // Get or create status info for this robot
  let statusInfo = robotTaskStatuses.get(robotId) || {};
  
  // Update with latest task status
  statusInfo.taskStatus = taskStatus;
  
  // Store the updated status
  robotTaskStatuses.set(robotId, statusInfo);
  
  // Log task status updates for monitoring
  console.log(`Task status update for robot ${robotId}: ${taskStatus.moveState || 'unknown'} (${taskStatus.actionType || 'none'})`);
}

/**
 * Process and store battery status updates from WebSocket
 * @param {string} robotId - Robot identifier
 * @param {Object} data - WebSocket message data
 */
function updateBatteryStatus(robotId, data) {
  // Extract battery information from message
  const batteryStatus = {
    voltage: data.voltage,
    current: data.current,
    percentage: data.percentage,
    power_supply_status: data.power_supply_status,
    timestamp: new Date()
  };
  
  // Get or create status info for this robot
  let statusInfo = robotTaskStatuses.get(robotId) || {};
  
  // Update with latest battery status
  statusInfo.batteryStatus = batteryStatus;
  
  // Store the updated status
  robotTaskStatuses.set(robotId, statusInfo);
  
  // Log battery updates
  const percentageStr = data.percentage ? `${(data.percentage * 100).toFixed(1)}%` : 'unknown';
  console.log(`Battery update for robot ${robotId}: ${percentageStr} (${data.power_supply_status || 'unknown'})`);
}

/**
 * Process and store pose updates from WebSocket
 * @param {string} robotId - Robot identifier
 * @param {Object} data - WebSocket message data
 */
function updatePoseStatus(robotId, data) {
  // Extract pose information from message
  const poseStatus = {
    position: data.pos,
    orientation: data.ori,
    timestamp: new Date()
  };
  
  // Get or create status info for this robot
  let statusInfo = robotTaskStatuses.get(robotId) || {};
  
  // Update with latest pose status
  statusInfo.poseStatus = poseStatus;
  
  // Store the updated status
  robotTaskStatuses.set(robotId, statusInfo);
}

/**
 * Process and store alerts from WebSocket
 * @param {string} robotId - Robot identifier
 * @param {Object} data - WebSocket message data
 */
function updateAlerts(robotId, data) {
  if (!data.alerts || !Array.isArray(data.alerts)) {
    return;
  }
  
  // Extract alert information from message
  const alertsList = data.alerts.map(alert => ({
    code: alert.code,
    level: alert.level,
    message: alert.msg,
    timestamp: new Date()
  }));
  
  // Get or create status info for this robot
  let statusInfo = robotTaskStatuses.get(robotId) || {};
  
  // Update with latest alerts
  statusInfo.alerts = alertsList;
  
  // Store the updated status
  robotTaskStatuses.set(robotId, statusInfo);
  
  // Log alerts
  if (alertsList.length > 0) {
    console.log(`Received ${alertsList.length} alerts for robot ${robotId}:`, 
      alertsList.map(a => `[${a.level}] ${a.code}: ${a.message}`).join(', '));
  }
}

/**
 * Disconnect robot's WebSocket
 * @param {string} robotId - Robot identifier
 */
export function disconnectRobotWebSocket(robotId) {
  const ws = robotWsConnections.get(robotId);
  if (ws) {
    ws.close();
    robotWsConnections.delete(robotId);
    console.log(`WebSocket connection for robot ${robotId} closed`);
  }
}

/**
 * Get the current task status for a robot
 * @param {string} robotId - Robot identifier
 * @returns {Object|null} - Current task status or null if no status available
 */
export function getRobotTaskStatus(robotId) {
  return robotTaskStatuses.get(robotId) || null;
}

/**
 * Create an API client for a specific robot
 * @param {string} serialNumber - Robot serial number
 * @param {string} publicIp - Robot public IP address
 * @param {number} port - Robot API port (usually 8090)
 * @param {string} appCode - Authentication app code
 * @returns {Object} - API client object with methods for robot control
 */
export function createRobotApiClient(serialNumber, publicIp, port, appCode) {
  // Check if we already have a client for this robot
  if (robotApiClients.has(serialNumber)) {
    return robotApiClients.get(serialNumber);
  }
  
  // Base URL for all API requests
  const baseUrl = `http://${publicIp}:${port}`;
  
  // Headers for authentication
  const headers = {
    'APPCODE': `APPCODE ${appCode}`,
    'Content-Type': 'application/json'
  };
  
  // Create axios instance with default config
  const axiosInstance = axios.create({
    baseURL: baseUrl,
    headers,
    timeout: 10000
  });
  
  const apiClient = {
    /**
     * Get current map information
     * This endpoint is still valid and required before creating tasks
     */
    async getCurrentMap() {
      try {
        const response = await axiosInstance.get('/chassis/current-map');
        return response.data;
      } catch (error) {
        console.error(`Error getting current map for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Get map details with all overlays including POIs
     * @param {string} mapId - Map ID to get details for
     * @returns {Object} - Map details with overlays
     */
    async getMapDetails(mapId) {
      try {
        const response = await axiosInstance.get(`/maps/${mapId}`);
        return response.data;
      } catch (error) {
        console.error(`Error getting map details for robot ${serialNumber}, map ${mapId}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Get all map points (POIs) from the current map
     * This combines getCurrentMap and getMapDetails into a single operation
     * @returns {Array} - Array of point objects from the map
     */
    async getAllMapPoints() {
      try {
        // First get the current map ID
        const currentMap = await this.getCurrentMap();
        if (!currentMap || !currentMap.id) {
          throw new Error('Failed to get current map ID');
        }
        
        // Now get the map details including overlays
        const mapDetails = await this.getMapDetails(currentMap.id);
        if (!mapDetails || !mapDetails.overlays) {
          throw new Error('Failed to get map overlays');
        }
        
        // Parse the overlays JSON
        let overlays;
        try {
          overlays = JSON.parse(mapDetails.overlays);
        } catch (error) {
          throw new Error('Failed to parse map overlays JSON');
        }
        
        if (!overlays || !overlays.features || !Array.isArray(overlays.features)) {
          throw new Error('Invalid overlay format in map data');
        }
        
        // Extract POIs (points) from the overlays
        const points = [];
        for (const feature of overlays.features) {
          // Only process point features
          if (feature.geometry && feature.geometry.type === 'Point') {
            // Extract coordinates
            const [x, y] = feature.geometry.coordinates;
            
            // Determine the point type based on properties
            let pointType = 'unknown';
            if (feature.properties && feature.properties.type) {
              // Map numeric type codes to descriptive names
              switch (feature.properties.type.toString()) {
                case '9':
                  pointType = 'charger';
                  break;
                case '11':
                  pointType = 'docking';
                  break;
                case '34':
                  pointType = 'rack';
                  break;
                case '36':
                  pointType = 'docker';
                  break;
                default:
                  pointType = feature.properties.type.toString();
              }
            }
            
            // Use the subtype property if available
            if (feature.properties && feature.properties.subtype) {
              pointType = pointType + '_' + feature.properties.subtype;
            }
            
            // Extract the name or generate one
            const name = feature.properties?.name || feature.id || `Point at (${x}, ${y})`;
            
            // Create a standardized point object
            points.push({
              id: feature.id || `map_${currentMap.id}_${x}_${y}`,
              name: name,
              type: pointType,
              poiId: feature.id || `map_${currentMap.id}_${x}_${y}`,
              x: x,
              y: y,
              yaw: feature.properties?.yaw || 0,
              areaId: currentMap.map_name,
              floor: currentMap.map_name,
              metadata: {
                stopRadius: feature.properties?.stopRadius || 0.5,
                dockingRadius: feature.properties?.dockingRadius || 0.5,
                mapId: currentMap.id,
                mapName: currentMap.map_name,
                mapUid: currentMap.uid,
                rawFeature: feature
              }
            });
          }
        }
        
        return points;
      } catch (error) {
        console.error(`Error getting map points for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Set current map by map ID
     * This endpoint is still valid and required before creating tasks
     * @param {string} mapId - Map ID to set as current
     */
    async setCurrentMap(mapId) {
      try {
        const response = await axiosInstance.post('/chassis/current-map', { map_id: mapId });
        return response.data;
      } catch (error) {
        console.error(`Error setting current map for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Get robot's current pose (position) information
     * This endpoint is still valid and required before creating tasks
     */
    async getCurrentPose() {
      try {
        const response = await axiosInstance.get('/chassis/pose');
        return response.data;
      } catch (error) {
        console.error(`Error getting pose for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Set robot's current pose (position)
     * This endpoint is still valid and required before creating tasks
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} orientation - Orientation angle in radians
     */
    async setCurrentPose(x, y, orientation) {
      try {
        const payload = {
          pos: [x, y],
          ori: orientation
        };
        const response = await axiosInstance.post('/chassis/pose', payload);
        return response.data;
      } catch (error) {
        console.error(`Error setting pose for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Get robot status information
     */
    async getStatus() {
      try {
        const response = await axiosInstance.get('/chassis/');
        return response.data;
      } catch (error) {
        console.error(`Error getting status for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Get battery status
     * Note: According to AutoXing documentation, battery information is primarily 
     * available through WebSocket topic /battery_state, not a REST endpoint
     */
    async getBatteryStatus() {
      try {
        // First check if we have cached battery data from WebSocket
        const storedStatus = taskStatusMap.get(serialNumber)?.batteryStatus;
        
        if (storedStatus) {
          return storedStatus;
        }
        
        // Try device info as fallback - some robot models expose battery info here
        try {
          const response = await axiosInstance.get('/device/info');
          if (response.data && response.data.battery) {
            return response.data.battery;
          }
        } catch (infoError) {
          console.log(`No battery info in device/info for robot ${serialNumber}`);
        }
        
        return {
          status: "unknown",
          message: "Battery information is only available via WebSocket /battery_state topic"
        };
      } catch (error) {
        console.error(`Error getting battery status for robot ${serialNumber}:`, error.message);
        return {
          status: "error",
          message: error.message
        };
      }
    },
    
    /**
     * Get list of available maps
     */
    async getMaps() {
      try {
        const response = await axiosInstance.get('/maps/');
        return response.data;
      } catch (error) {
        console.error(`Error getting maps for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Get specific map by ID
     * @param {string} mapId - Map ID
     */
    async getMap(mapId) {
      try {
        const response = await axiosInstance.get(`/maps/${mapId}`);
        return response.data;
      } catch (error) {
        console.error(`Error getting map ${mapId} for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Create a new task 
     * @param {Object} taskInfo - Task information object
     * @returns {Promise<string>} - Returns the task ID 
     */
    async createTask(taskInfo) {
      try {
        // Ensure robotId is set to this robot's serial number
        const taskData = {
          ...taskInfo,
          robotId: serialNumber,
          sn: serialNumber // Ensure the serial number is passed correctly as 'sn'
        };
        
        // According to the documentation, we need to use the /chassis/moves endpoint
        // with the properly formatted move command
        console.log(`Creating task using /chassis/moves endpoint for robot ${serialNumber}`);
        try {
          // Convert task data to the proper Move API format
          const moveData = {
            creator: "robot-platform",
            type: "standard", // standard move
            target_x: taskData.pts && taskData.pts.length > 0 ? Number(taskData.pts[0].x) || 0 : 0,
            target_y: taskData.pts && taskData.pts.length > 0 ? Number(taskData.pts[0].y) || 0 : 0,
          };
          
          // Add target orientation if available
          if (taskData.pts && taskData.pts.length > 0 && taskData.pts[0].yaw !== undefined) {
            moveData.target_ori = Number(taskData.pts[0].yaw);
          }
          
          console.log(`Sending move command to robot ${serialNumber} with data:`, JSON.stringify(moveData));
          
          // Check if robot is currently charging, if so, need to undock first
          try {
            const status = await axiosInstance.get('/chassis/state');
            if (status.data && status.data.is_charging) {
              console.log(`Robot ${serialNumber} is currently charging, sending undock command...`);
              await axiosInstance.post('/services/undock');
              // Wait a moment for the undock operation to complete
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (statusError) {
            // Continue even if we can't check charging status
            console.log(`Couldn't check charging status: ${statusError.message}, continuing with move command`);
          }
          
          // Make the API request to the Move API
          const moveResponse = await axiosInstance.post('/chassis/moves', moveData);
          
          if (moveResponse.data && moveResponse.data.id) {
            console.log(`Move created successfully for robot ${serialNumber}, ID: ${moveResponse.data.id}`);
            return moveResponse.data.id;
          } else {
            console.log(`Unexpected response format from move creation, data:`, moveResponse.data);
            return moveResponse.data ? JSON.stringify(moveResponse.data) : 'move-created-no-id';
          }
        } catch (moveError) {
          console.error(`Move endpoint failed: ${moveError.message}`);
          throw moveError;
        }
        
        // Try with the correct task API endpoint based on the documentation
        try {
          // The Django error response showed the available endpoints, and task was not there
          // Try using the moves endpoint with the correct task format
          console.log(`Using /chassis/moves endpoint for task creation for robot ${serialNumber}`);
          const response = await axiosInstance.post('/chassis/moves', taskData);
          
          if (response.data && response.data.move_id) {
            console.log(`Task created successfully for robot ${serialNumber}, ID: ${response.data.move_id}`);
            return response.data.move_id;
          } else if (response.data && response.data.data && response.data.data.taskId) {
            console.log(`Task created successfully for robot ${serialNumber}, ID: ${response.data.data.taskId}`);
            return response.data.data.taskId;
          } else if (response.data && response.data.taskId) {
            console.log(`Task created successfully for robot ${serialNumber}, ID: ${response.data.taskId}`);
            return response.data.taskId;
          } else {
            console.error(`Unexpected response format from task creation for robot ${serialNumber}:`, response.data);
            return response.data ? JSON.stringify(response.data) : 'task-created-no-id';
          }
        } catch (taskError) {
          console.error(`Task create endpoint failed: ${taskError.message}`);
          throw taskError;
        }
      } catch (error) {
        console.error(`Error creating task for robot ${serialNumber}:`, error.message);
        if (error.response) {
          console.error('Response:', error.response.data);
        }
        throw error;
      }
    },
    
    /**
     * Get all tasks for a robot
     * @returns {Promise<Array>} - List of tasks
     */
    async getTasks() {
      try {
        // Try first with the available moves endpoint
        try {
          const response = await axiosInstance.get('/chassis/moves');
          console.log(`Retrieved tasks via moves API for robot ${serialNumber}`);
          // Transform moves data to match task format
          return response.data.moves || [];
        } catch (moveError) {
          console.log(`Moves list endpoint failed: ${moveError.message}`);
        }
        
        // Try alternate endpoints
        try {
          const response = await axiosInstance.get('/task/list');
          return response.data.data || [];
        } catch (taskListError) {
          console.log(`Task list endpoint failed: ${taskListError.message}`);
          // Try v1.1 as last resort
          const v1Response = await axiosInstance.get('/task/v1.1/list');
          return v1Response.data.data || [];
        }
      } catch (error) {
        console.error(`Error getting tasks for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Get information about the currently executing task
     * @returns {Promise<Object>} - Returns the current task information
     */
    async getCurrentTask() {
      try {
        // Try using the websocket status information first
        const status = robotTaskStatuses.get(serialNumber);
        if (status && status.actionId) {
          // If we have actionId, we can get the full task details
          return this.getTaskDetails(status.actionId);
        }
        
        // Fall back to listing all tasks and finding the executing one
        const tasks = await this.getTasks();
        const currentTask = tasks.find(task => 
          task.isExcute === true && task.isCancel === false && task.isDel === false
        );
        
        return currentTask || null;
      } catch (error) {
        console.error(`Error getting current task for robot ${serialNumber}:`, error.message);
        return null;
      }
    },
    
    /**
     * Get details about a specific task by ID
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} - Returns the task information
     */
    async getTaskDetails(taskId) {
      try {
        const response = await axiosInstance.get(`/task/v1.1/${taskId}`);
        return response.data.data;
      } catch (error) {
        console.error(`Error getting task details for task ${taskId} on robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Start an existing task
     * @param {string} taskId - Task ID to start
     * @returns {Promise<Object>} - Returns the execution result
     */
    async startTask(taskId) {
      try {
        const response = await axiosInstance.post(`/task/v1.1/${taskId}/execute`);
        
        // Connect to WebSocket to monitor task execution if not already connected
        if (!robotWsConnections.has(serialNumber)) {
          connectToRobotWebSocket(serialNumber, ['/planning_state']);
        }
        
        return response.data;
      } catch (error) {
        console.error(`Error starting task ${taskId} on robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Cancel a task in progress
     * @param {string} taskId - Task ID to cancel
     * @returns {Promise<Object>} - Returns the cancellation result
     */
    async cancelTask(taskId) {
      try {
        const response = await axiosInstance.post(`/task/v1.1/${taskId}/cancel`);
        return response.data;
      } catch (error) {
        console.error(`Error canceling task ${taskId} on robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Get the state/status of a task
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} - Task state information
     */
    async getTaskState(taskId) {
      try {
        const response = await axiosInstance.get(`/task/v2.0/${taskId}/state`);
        return response.data;
      } catch (error) {
        console.error(`Error getting state for task ${taskId} on robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Create and immediately start a dropoff task
     * @param {Object} dropoffPoint - Dropoff point coordinates
     * @param {Object} shelfPoint - Shelf point coordinates
     * @param {Object} returnPoint - Return point coordinates
     * @returns {Promise<string>} - Returns the task ID
     */
    async createDropoffTask(dropoffPoint, shelfPoint, returnPoint) {
      try {
        const taskInfo = {
          name: `Dropoff Task ${new Date().toISOString()}`,
          robotId: serialNumber,
          routeMode: 1, // Calculate route in order of task points
          runMode: 1, // Flexible obstacle avoidance
          runNum: 1, // Execute once
          taskType: 2, // Restaurant type
          runType: 21, // Multi-point delivery
          taskPts: [ // Note: correct property name is taskPts, not pts
            {
              // First go to dropoff point
              x: dropoffPoint.x,
              y: dropoffPoint.y,
              yaw: dropoffPoint.yaw || 0,
              areaId: dropoffPoint.areaId,
              type: -1,
              ext: {
                name: "Dropoff Point"
              },
              stepActs: [] // Actions to perform at this point
            },
            {
              // Then go to shelf point
              x: shelfPoint.x,
              y: shelfPoint.y, 
              yaw: shelfPoint.yaw || 0,
              areaId: shelfPoint.areaId,
              type: -1,
              ext: {
                name: "Shelf Point"
              },
              stepActs: [] // Actions to perform at this point
            }
          ],
          backPt: {
            // Finally return to charging or standby point
            type: returnPoint.type || 9, // 9 = charging station, 10 = standby point
            x: returnPoint.x,
            y: returnPoint.y,
            yaw: returnPoint.yaw || 0,
            areaId: returnPoint.areaId,
            ext: {
              name: "Return Point"
            }
          }
        };
        
        // Create the task
        const taskId = await this.createTask(taskInfo);
        
        // Start the task (not needed for v3 API which auto-starts)
        try {
          await this.startTask(taskId);
        } catch (startError) {
          console.log(`Note: Task ${taskId} may have already been started automatically`);
        }
        
        return taskId;
      } catch (error) {
        console.error(`Error creating and starting dropoff task for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Create and immediately start a pickup task
     * @param {Object} shelfPoint - Shelf point coordinates
     * @param {Object} pickupPoint - Pickup point coordinates
     * @param {Object} returnPoint - Return point coordinates
     * @returns {Promise<string>} - Returns the task ID
     */
    async createPickupTask(shelfPoint, pickupPoint, returnPoint) {
      try {
        const taskInfo = {
          name: `Pickup Task ${new Date().toISOString()}`,
          robotId: serialNumber,
          routeMode: 1, // Calculate route in order of task points
          runMode: 1, // Flexible obstacle avoidance
          runNum: 1, // Execute once
          taskType: 2, // Restaurant type
          runType: 21, // Multi-point delivery
          taskPts: [ // Note: correct property name is taskPts, not pts
            {
              // First go to shelf point
              x: shelfPoint.x,
              y: shelfPoint.y,
              yaw: shelfPoint.yaw || 0,
              areaId: shelfPoint.areaId,
              type: -1,
              ext: {
                name: "Shelf Point"
              },
              stepActs: [] // Actions to perform at this point
            },
            {
              // Then go to pickup point
              x: pickupPoint.x,
              y: pickupPoint.y,
              yaw: pickupPoint.yaw || 0,
              areaId: pickupPoint.areaId,
              type: -1,
              ext: {
                name: "Pickup Point"
              },
              stepActs: [] // Actions to perform at this point
            }
          ],
          backPt: {
            // Finally return to charging or standby point
            type: returnPoint.type || 9, // 9 = charging station, 10 = standby point
            x: returnPoint.x,
            y: returnPoint.y,
            yaw: returnPoint.yaw || 0,
            areaId: returnPoint.areaId,
            ext: {
              name: "Return Point"
            }
          }
        };
        
        // Create the task
        const taskId = await this.createTask(taskInfo);
        
        // Start the task (not needed for v3 API which auto-starts)
        try {
          await this.startTask(taskId);
        } catch (startError) {
          console.log(`Note: Task ${taskId} may have already been started automatically`);
        }
        
        return taskId;
      } catch (error) {
        console.error(`Error creating and starting pickup task for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Create and immediately start a return-to-charging task
     * @param {Object} returnPoint - Return point coordinates
     * @returns {Promise<string>} - Returns the task ID
     */
    async createReturnTask(returnPoint) {
      try {
        const taskInfo = {
          name: `Return Task ${new Date().toISOString()}`,
          robotId: serialNumber,
          routeMode: 1, // Calculate route in order of task points
          runMode: 1, // Flexible obstacle avoidance
          runNum: 1, // Execute once
          taskType: 1, // Return to charging station type
          runType: 24, // Return type
          taskPts: [], // No intermediate points
          backPt: {
            // Return to charging or standby point
            type: returnPoint.type || 9, // 9 = charging station, 10 = standby point
            x: returnPoint.x,
            y: returnPoint.y,
            yaw: returnPoint.yaw || 0,
            areaId: returnPoint.areaId,
            ext: {
              name: "Return Point"
            }
          }
        };
        
        // Create the task
        const taskId = await this.createTask(taskInfo);
        
        // Start the task (not needed for v3 API which auto-starts)
        try {
          await this.startTask(taskId);
        } catch (startError) {
          console.log(`Note: Task ${taskId} may have already been started automatically`);
        }
        
        return taskId;
      } catch (error) {
        console.error(`Error creating and starting return task for robot ${serialNumber}:`, error.message);
        throw error;
      }
    },
    
    /**
     * Create a move action for the robot to go to a specific point
     * @param {string} robotId - The robot ID (ignored as we use the client's robot ID)
     * @param {Object} moveData - Movement data with coordinates and parameters
     * @param {number} moveData.x - X coordinate
     * @param {number} moveData.y - Y coordinate
     * @param {number} moveData.yaw - Orientation (yaw) in radians
     * @param {string} moveData.areaId - Map area ID
     * @param {string} [moveData.type='standard'] - Movement type (standard, charge, etc.)
     * @param {number} [moveData.speed] - Speed for movement
     * @param {number} [moveData.accuracy=0.2] - Target position accuracy in meters
     * @param {string} [moveData.name] - Name for this movement action
     * @returns {Promise<string>} - Returns the move task ID
     */
    async createMoveAction(robotId, moveData) {
      try {
        // Check if we're using the new target_x/target_y format or the legacy x/y format
        const targetX = moveData.target_x !== undefined ? moveData.target_x : moveData.x;
        const targetY = moveData.target_y !== undefined ? moveData.target_y : moveData.y;
        const targetOri = moveData.target_ori !== undefined ? moveData.target_ori : moveData.yaw;
        
        console.log(`Creating move action for robot ${serialNumber} to position (${targetX}, ${targetY})`);
        
        // Validate required fields
        if (targetX === undefined || targetY === undefined) {
          throw new Error('Position coordinates (target_x, target_y) are required for movement');
        }
        
        // Use the correct format for the /chassis/moves endpoint according to Move API docs
        const moveRequest = {
          creator: moveData.creator || "robot-platform",
          type: moveData.type || "standard", // standard move type
          target_x: Number(targetX) || 0,
          target_y: Number(targetY) || 0,
        };
        
        // Add optional parameters if provided
        if (targetOri !== undefined) {
          moveRequest.target_ori = Number(targetOri) || 0;
        }
        
        if (moveData.target_accuracy !== undefined) {
          moveRequest.target_accuracy = Number(moveData.target_accuracy);
        } else if (moveData.accuracy !== undefined) {
          moveRequest.target_accuracy = Number(moveData.accuracy);
        }
        
        console.log(`Sending move command to /chassis/moves:`, JSON.stringify(moveRequest));
        
        const moveResponse = await axiosInstance.post('/chassis/moves', moveRequest);
        
        console.log(`Move response:`, JSON.stringify(moveResponse.data));
        
        if (moveResponse.data && moveResponse.data.id) {
          console.log(`Move action created successfully with ID: ${moveResponse.data.id}`);
          return moveResponse.data.id;
        } else {
          throw new Error('Move action did not return a valid ID');
        }
      } catch (error) {
        console.error(`Error creating movement action for robot ${serialNumber}:`, error.message);
        throw error;
      }
    }
  };
  
  // Store the client for future use
  robotApiClients.set(serialNumber, apiClient);
  
  return apiClient;
}

/**
 * Get API client for a configured robot
 * @param {string} robotId - Robot identifier
 * @returns {Object} - Robot API client
 */
export function getRobotApiClient(robotId) {
  // Check if robot is configured
  const config = robotConfigs.get(robotId);
  if (!config) {
    throw new Error(`Robot ${robotId} not configured`);
  }
  
  // Check if we already have a client
  if (robotApiClients.has(robotId)) {
    return robotApiClients.get(robotId);
  }
  
  // Create new client
  return createRobotApiClient(
    robotId,
    config.publicIp,
    config.port,
    config.appCode
  );
}

// Export robot task statuses map for use in other modules
export { robotTaskStatuses };