import { apiRequest } from "./queryClient";

// Main Robot API interface for client-side usage
export const robotApi = {
  // Authentication
  async authenticate(appId: string, appSecret: string, mode: string = "WAN_APP") {
    const response = await apiRequest("POST", "/api/robot/auth", { appId, appSecret, mode });
    return response.json();
  },

  // Movement commands
  async moveTo(robotId: string, point: any) {
    const response = await apiRequest("POST", `/api/robot/${robotId}/move`, { point });
    return response.json();
  },
  
  async moveMultiFloor(robotId: string, points: any[]) {
    const response = await apiRequest("POST", `/api/robot/${robotId}/move/multi-floor`, { points });
    return response.json();
  },
  
  async stopMovement(robotId: string) {
    const response = await apiRequest("POST", `/api/robot/${robotId}/stop`, {});
    return response.json();
  },
  
  async goToChargingStation(robotId: string) {
    const response = await apiRequest("POST", `/api/robot/${robotId}/charge`, {});
    return response.json();
  },

  // Robot actions
  async alignWithRack(robotId: string, rackId: string) {
    const response = await apiRequest("POST", `/api/robot/${robotId}/align`, { rackId });
    return response.json();
  },
  
  async liftRack(robotId: string) {
    const response = await apiRequest("POST", `/api/robot/${robotId}/lift`, {});
    return response.json();
  },
  
  async lowerRack(robotId: string) {
    const response = await apiRequest("POST", `/api/robot/${robotId}/lower`, {});
    return response.json();
  },
  
  async openDoors(robotId: string, doorIds: number[]) {
    const response = await apiRequest("POST", `/api/robot/${robotId}/doors/open`, { doorIds });
    return response.json();
  },
  
  async closeDoors(robotId: string, doorIds: number[]) {
    const response = await apiRequest("POST", `/api/robot/${robotId}/doors/close`, { doorIds });
    return response.json();
  },

  // Task management
  async createTask(taskData: any) {
    const response = await apiRequest("POST", "/api/tasks", taskData);
    return response.json();
  },
  
  async startTask(taskId: string) {
    const response = await apiRequest("POST", `/api/tasks/${taskId}/start`, {});
    return response.json();
  },
  
  async pauseTask(taskId: string) {
    const response = await apiRequest("POST", `/api/tasks/${taskId}/pause`, {});
    return response.json();
  },
  
  async resumeTask(taskId: string) {
    const response = await apiRequest("POST", `/api/tasks/${taskId}/resume`, {});
    return response.json();
  },
  
  async cancelTask(taskId: string) {
    const response = await apiRequest("POST", `/api/tasks/${taskId}/cancel`, {});
    return response.json();
  },
  
  async retryTask(taskId: string) {
    const response = await apiRequest("POST", `/api/tasks/${taskId}/retry`, {});
    return response.json();
  },

  // Robot status
  async getRobotStatus(robotId: string) {
    const response = await apiRequest("GET", `/api/robot/${robotId}/status`, {});
    return response.json();
  },
  
  async getRobotBatteryLevel(robotId: string) {
    const response = await apiRequest("GET", `/api/robot/${robotId}/battery`, {});
    return response.json();
  },
  
  async getRobotPosition(robotId: string) {
    const response = await apiRequest("GET", `/api/robot/${robotId}/position`, {});
    return response.json();
  },

  // Map and POI management
  async getPois() {
    const response = await apiRequest("GET", "/api/pois", {});
    return response.json();
  },
  
  async getMaps() {
    const response = await apiRequest("GET", "/api/maps", {});
    return response.json();
  },
  
  async createPoi(poiData: any) {
    const response = await apiRequest("POST", "/api/pois", poiData);
    return response.json();
  },
};

export default robotApi;
