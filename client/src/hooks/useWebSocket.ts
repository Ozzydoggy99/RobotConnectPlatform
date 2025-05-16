import { useState, useEffect, useRef, useCallback } from 'react';

// WebSocket message types
export type MessageType = 
  | 'subscribe_robot'
  | 'unsubscribe_robot'
  | 'subscribe_task'
  | 'unsubscribe_task'
  | 'subscribe_all_robots'
  | 'unsubscribe_all_robots'
  | 'subscribe_all_tasks'
  | 'unsubscribe_all_tasks'
  | 'get_robot_status'
  | 'get_task_status'
  | 'robot_update'
  | 'task_update'
  | 'ping'
  | 'pong';

// WebSocket message format
export interface WebSocketMessage {
  type: MessageType;
  payload?: any;
  id?: string;
}

// ConnectionStatus enum
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
  ERROR = 'error'
}

/**
 * Hook for WebSocket connections
 */
export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.CLOSED);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const messageQueue = useRef<WebSocketMessage[]>([]);
  const subscriptions = useRef<Map<string, (message: WebSocketMessage) => void>>(new Map());
  const messageIdCounter = useRef<number>(1);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    // Close existing connection if any
    if (socket.current) {
      socket.current.close();
    }

    try {
      // Determine WebSocket URL based on current window location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      setStatus(ConnectionStatus.CONNECTING);
      
      // Create new WebSocket connection
      socket.current = new WebSocket(wsUrl);
      
      // Set up event handlers
      socket.current.onopen = () => {
        console.log('WebSocket connected');
        setStatus(ConnectionStatus.OPEN);
        
        // Send any queued messages
        while (messageQueue.current.length > 0) {
          const message = messageQueue.current.shift();
          if (message && socket.current?.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify(message));
          }
        }
      };
      
      socket.current.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason}`);
        setStatus(ConnectionStatus.CLOSED);
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (status !== ConnectionStatus.OPEN && status !== ConnectionStatus.CONNECTING) {
            connect();
          }
        }, 3000);
      };
      
      socket.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus(ConnectionStatus.ERROR);
      };
      
      socket.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          
          // Update last message
          setLastMessage(message);
          
          // Check if there's a subscription for this message ID
          if (message.id && subscriptions.current.has(message.id)) {
            const callback = subscriptions.current.get(message.id);
            if (callback) {
              callback(message);
              // Remove one-time subscriptions
              subscriptions.current.delete(message.id);
            }
          }
          
          // Process different message types
          if (message.type === 'robot_update' || message.type === 'task_update') {
            // These messages will be handled by components that register callbacks
            // for specific event types
            const eventCallbacks = Array.from(subscriptions.current.entries())
              .filter(([key, _]) => key.startsWith(message.type));
            
            eventCallbacks.forEach(([_, callback]) => {
              callback(message);
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      setStatus(ConnectionStatus.ERROR);
    }
  }, [status]);

  /**
   * Send message through WebSocket
   */
  const sendMessage = useCallback((type: MessageType, payload?: any): string => {
    // Generate unique message ID
    const messageId = `msg_${messageIdCounter.current++}`;
    
    // Construct message
    const message: WebSocketMessage = {
      type,
      id: messageId,
      payload
    };
    
    // If socket is open, send immediately
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(message));
    } else {
      // Otherwise queue for later
      messageQueue.current.push(message);
      
      // If socket is closed, try to connect
      if (!socket.current || socket.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    }
    
    return messageId;
  }, [connect]);

  /**
   * Send message and wait for response
   */
  const sendAndReceive = useCallback((type: MessageType, payload?: any): Promise<WebSocketMessage> => {
    return new Promise((resolve, reject) => {
      const messageId = sendMessage(type, payload);
      
      // Set timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        subscriptions.current.delete(messageId);
        reject(new Error('WebSocket request timed out'));
      }, 10000);
      
      // Register callback for response
      subscriptions.current.set(messageId, (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      });
    });
  }, [sendMessage]);

  /**
   * Subscribe to a robot's status updates
   */
  const subscribeToRobot = useCallback((robotId: string) => {
    return sendMessage('subscribe_robot', { robotId });
  }, [sendMessage]);

  /**
   * Unsubscribe from a robot's status updates
   */
  const unsubscribeFromRobot = useCallback((robotId: string) => {
    return sendMessage('unsubscribe_robot', { robotId });
  }, [sendMessage]);

  /**
   * Subscribe to a task's status updates
   */
  const subscribeToTask = useCallback((taskId: string) => {
    return sendMessage('subscribe_task', { taskId });
  }, [sendMessage]);

  /**
   * Unsubscribe from a task's status updates
   */
  const unsubscribeFromTask = useCallback((taskId: string) => {
    return sendMessage('unsubscribe_task', { taskId });
  }, [sendMessage]);

  /**
   * Subscribe to all robot updates
   */
  const subscribeToAllRobots = useCallback(() => {
    return sendMessage('subscribe_all_robots');
  }, [sendMessage]);

  /**
   * Unsubscribe from all robot updates
   */
  const unsubscribeFromAllRobots = useCallback(() => {
    return sendMessage('unsubscribe_all_robots');
  }, [sendMessage]);

  /**
   * Subscribe to all task updates
   */
  const subscribeToAllTasks = useCallback(() => {
    return sendMessage('subscribe_all_tasks');
  }, [sendMessage]);

  /**
   * Unsubscribe from all task updates
   */
  const unsubscribeFromAllTasks = useCallback(() => {
    return sendMessage('unsubscribe_all_tasks');
  }, [sendMessage]);

  /**
   * Get robot status
   */
  const getRobotStatus = useCallback((robotId: string) => {
    return sendAndReceive('get_robot_status', { robotId });
  }, [sendAndReceive]);

  /**
   * Get task status
   */
  const getTaskStatus = useCallback((taskId: string) => {
    return sendAndReceive('get_task_status', { taskId });
  }, [sendAndReceive]);

  /**
   * Register callback for specific event type
   */
  const on = useCallback((eventType: MessageType, callback: (message: WebSocketMessage) => void) => {
    const subscriptionId = `${eventType}_${Date.now()}`;
    subscriptions.current.set(subscriptionId, callback);
    
    // Return function to unsubscribe
    return () => {
      subscriptions.current.delete(subscriptionId);
    };
  }, []);

  /**
   * Send ping to server
   */
  const ping = useCallback(() => {
    return sendAndReceive('ping');
  }, [sendAndReceive]);

  // Connect on mount, clean up on unmount
  useEffect(() => {
    connect();
    
    // Set up reconnection on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          (!socket.current || socket.current.readyState !== WebSocket.OPEN)) {
        connect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (socket.current?.readyState === WebSocket.OPEN) {
        ping().catch(() => {}); // Ignore ping errors
      }
    }, 30000); // Ping every 30 seconds
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pingInterval);
      
      if (socket.current) {
        socket.current.close();
        socket.current = null;
      }
    };
  }, [connect, ping]);

  return {
    status,
    lastMessage,
    sendMessage,
    sendAndReceive,
    subscribeToRobot,
    unsubscribeFromRobot,
    subscribeToTask,
    unsubscribeFromTask,
    subscribeToAllRobots,
    unsubscribeFromAllRobots,
    subscribeToAllTasks,
    unsubscribeFromAllTasks,
    getRobotStatus,
    getTaskStatus,
    on,
    ping
  };
}