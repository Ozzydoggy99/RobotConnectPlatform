// WebSocket connection handler for real-time updates

interface WebSocketMessage {
  type: string;
  payload?: any;
  id?: string;
}

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionHandler = (isConnected: boolean) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectTimeout: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000; // 3 seconds
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private connectionHandlers: ConnectionHandler[] = [];
  private clientId: string | null = null;
  private pendingMessages: WebSocketMessage[] = [];
  
  /**
   * Initialize WebSocket connection
   */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket connection already exists');
      return;
    }
    
    try {
      // Generate WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${protocol}//${window.location.host}/ws`;
      
      // Create WebSocket connection
      this.ws = new WebSocket(this.url);
      
      // Set up connection handlers
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      
      console.log('Connecting to WebSocket server...');
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Subscribe to specific robot updates
   */
  subscribeToRobot(robotId: string): void {
    this.sendMessage({
      type: 'subscribe_robot',
      payload: { robotId }
    });
  }
  
  /**
   * Unsubscribe from specific robot updates
   */
  unsubscribeFromRobot(robotId: string): void {
    this.sendMessage({
      type: 'unsubscribe_robot',
      payload: { robotId }
    });
  }
  
  /**
   * Subscribe to specific task updates
   */
  subscribeToTask(taskId: string): void {
    this.sendMessage({
      type: 'subscribe_task',
      payload: { taskId }
    });
  }
  
  /**
   * Unsubscribe from specific task updates
   */
  unsubscribeFromTask(taskId: string): void {
    this.sendMessage({
      type: 'unsubscribe_task',
      payload: { taskId }
    });
  }
  
  /**
   * Subscribe to all robot updates
   */
  subscribeToAllRobots(): void {
    this.sendMessage({
      type: 'subscribe_all_robots'
    });
  }
  
  /**
   * Unsubscribe from all robot updates
   */
  unsubscribeFromAllRobots(): void {
    this.sendMessage({
      type: 'unsubscribe_all_robots'
    });
  }
  
  /**
   * Subscribe to all task updates
   */
  subscribeToAllTasks(): void {
    this.sendMessage({
      type: 'subscribe_all_tasks'
    });
  }
  
  /**
   * Unsubscribe from all task updates
   */
  unsubscribeFromAllTasks(): void {
    this.sendMessage({
      type: 'unsubscribe_all_tasks'
    });
  }
  
  /**
   * Get robot status
   */
  getRobotStatus(robotId: string): void {
    this.sendMessage({
      type: 'get_robot_status',
      payload: { robotId }
    });
  }
  
  /**
   * Get task status
   */
  getTaskStatus(taskId: string): void {
    this.sendMessage({
      type: 'get_task_status',
      payload: { taskId }
    });
  }
  
  /**
   * Send ping message
   */
  ping(): void {
    this.sendMessage({
      type: 'ping',
      payload: { timestamp: new Date().toISOString() }
    });
  }
  
  /**
   * Add message handler for specific message type
   */
  addMessageHandler(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
  }
  
  /**
   * Remove message handler
   */
  removeMessageHandler(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        this.messageHandlers.set(type, handlers);
      }
    }
  }
  
  /**
   * Add connection state change handler
   */
  addConnectionHandler(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
    
    // Immediately notify of current state
    if (this.ws) {
      handler(this.ws.readyState === WebSocket.OPEN);
    } else {
      handler(false);
    }
  }
  
  /**
   * Remove connection state change handler
   */
  removeConnectionHandler(handler: ConnectionHandler): void {
    const index = this.connectionHandlers.indexOf(handler);
    if (index !== -1) {
      this.connectionHandlers.splice(index, 1);
    }
  }
  
  /**
   * Send WebSocket message
   */
  private sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message to send when connected
      this.pendingMessages.push(message);
      
      // Attempt to connect if not already connected
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }
  
  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    console.log('WebSocket connection established');
    this.reconnectAttempts = 0;
    
    // Notify connection handlers
    this.connectionHandlers.forEach(handler => handler(true));
    
    // Send any pending messages
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    
    // Notify connection handlers
    this.connectionHandlers.forEach(handler => handler(false));
    
    // Schedule reconnect
    this.scheduleReconnect();
  }
  
  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
  }
  
  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;
      
      // Store client ID from welcome message
      if (message.type === 'pong' && message.payload?.clientId) {
        this.clientId = message.payload.clientId;
        console.log(`Got client ID: ${this.clientId}`);
      }
      
      // Notify message handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
  
  /**
   * Schedule reconnect attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      this.reconnectTimeout = setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect();
      }, delay);
    } else {
      console.error(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached.`);
    }
  }
  
  /**
   * Disconnect WebSocket connection
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
    
    // Clear pending messages
    this.pendingMessages = [];
    
    console.log('WebSocket connection disconnected');
  }
}

// Create singleton instance
export const webSocketClient = new WebSocketClient();

// Connect on import by default (can be disabled)
// webSocketClient.connect();

export default webSocketClient;