import { Response } from 'express';

// Error codes for robot operations
export enum ErrorCode {
  // Generic errors
  UNKNOWN = 1000,
  INVALID_PARAM = 1001,
  NOT_FOUND = 1002,
  UNAUTHORIZED = 1003,
  FORBIDDEN = 1004,
  CONFLICT = 1005,
  
  // Robot-specific errors
  CONNECTION_FAILED = 2000,
  COMMAND_FAILED = 2001,
  ROBOT_OFFLINE = 2002,
  ROBOT_BUSY = 2003,
  MOVEMENT_ERROR = 2004,
  ROBOT_UNAVAILABLE = 2005,
  MAP_OPERATION_FAILED = 2006,
  ROBOT_OPERATION_FAILED = 2007,
  
  // Task-specific errors
  TASK_NOT_FOUND = 3000,
  TASK_FAILED = 3001,
  INVALID_TASK = 3002,
  TASK_EXECUTION_FAILED = 3003,
  TASK_CANCELLATION_FAILED = 3004,
  INVALID_TASK_CONFIGURATION = 3005,
  TASK_STATUS_CONFLICT = 3006
}

// Custom error class for robot operations
export class RobotError extends Error {
  code: ErrorCode;
  
  constructor(message: string, code: ErrorCode = ErrorCode.UNKNOWN) {
    super(message);
    this.name = 'RobotError';
    this.code = code;
  }
}

// Log error to console (in production, this would log to a proper logging system)
export function logError(context: string, message: string): void {
  console.error(`[${context}] ${message}`);
}

// Send error response to client
export function errorResponse(res: Response, error: any): Response {
  // Determine if this is one of our custom errors
  if (error instanceof RobotError) {
    const statusCode = getHttpStatusFromErrorCode(error.code);
    return res.status(statusCode).json({
      error: true,
      code: error.code,
      message: error.message
    });
  }
  
  // Handle Axios errors (network/API errors)
  if (error.isAxiosError) {
    const statusCode = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'Unknown error';
    
    logError('API', `${statusCode}: ${message}`);
    
    return res.status(statusCode).json({
      error: true,
      code: ErrorCode.COMMAND_FAILED,
      message: `API error: ${message}`
    });
  }
  
  // Handle other errors
  logError('Unexpected', error instanceof Error ? error.message : 'Unknown error');
  
  return res.status(500).json({
    error: true,
    code: ErrorCode.UNKNOWN,
    message: error instanceof Error ? error.message : 'An unexpected error occurred'
  });
}

// Map our error codes to HTTP status codes
function getHttpStatusFromErrorCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.INVALID_PARAM:
      return 400; // Bad Request
    case ErrorCode.UNAUTHORIZED:
      return 401; // Unauthorized
    case ErrorCode.FORBIDDEN:
      return 403; // Forbidden
    case ErrorCode.NOT_FOUND:
    case ErrorCode.TASK_NOT_FOUND:
      return 404; // Not Found
    case ErrorCode.CONFLICT:
      return 409; // Conflict
    case ErrorCode.CONNECTION_FAILED:
    case ErrorCode.ROBOT_OFFLINE:
      return 503; // Service Unavailable
    default:
      return 500; // Internal Server Error
  }
}