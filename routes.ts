import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { websocketHandler } from "./websocket";
import * as robotIndex from "./robot";
import * as robotController from "./robot/controller";
import * as taskWorkflowController from "./robot/task-controller";
import * as robotPoints from "./robot/points";
import { registerL382502104987irRobot } from "./robot/robot-registration";
import path from "path";

// Import the robot task and charger routes
import robotTaskRoutes from './robot/task-routes.js';
import robotChargerRoutes from './robot/charger-routes.js';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time updates
  websocketHandler.initialize(httpServer);
  
  // Register the robot task routes for bin operations
  app.use('/api/robot', robotTaskRoutes);
  
  // Register the robot charger routes for charging operations
  app.use('/api/robot', robotChargerRoutes);
  
  // A pure HTML login page at root level to avoid any routing issues
  // Serve the login page at the root URL for direct access
  app.get("/", (_req: Request, res: Response) => {
    // Serve the HTML login page from client/login.html
    res.sendFile(path.join(process.cwd(), "client/login.html"));
  });
  
  // Serve the standalone dashboard page
  app.get("/dashboard", (_req: Request, res: Response) => {
    // Serve the HTML dashboard page from client/dashboard.html
    res.sendFile(path.join(process.cwd(), "client/dashboard.html"));
  });
  
  // Also keep the /login-static endpoint as a backup
  app.get("/login-static", (_req: Request, res: Response) => {
    // Set headers to prevent caching and ensure proper content type
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send a simple HTML login page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SKYTECH AUTOMATED - Login</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  background-color: #111827;
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
              }
              .login-container {
                  background-color: rgba(0, 0, 0, 0.4);
                  padding: 30px;
                  border-radius: 8px;
                  width: 350px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                  color: white;
                  border: 1px solid #374151;
              }
              h1 {
                  text-align: center;
                  margin-bottom: 5px;
                  color: #10b981;
              }
              h2 {
                  text-align: center;
                  margin-bottom: 20px;
                  font-size: 1.2rem;
                  color: #9ca3af;
              }
              .input-group {
                  margin-bottom: 15px;
              }
              label {
                  display: block;
                  margin-bottom: 5px;
                  color: #d1d5db;
              }
              input {
                  width: 100%;
                  padding: 10px;
                  border: 1px solid #374151;
                  border-radius: 4px;
                  background-color: #1f2937;
                  color: white;
              }
              button {
                  width: 100%;
                  padding: 10px;
                  background-color: #10b981;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 16px;
                  margin-top: 10px;
              }
              button:hover {
                  background-color: #059669;
              }
              .error-message {
                  color: #ef4444;
                  margin-top: 10px;
                  text-align: center;
                  display: none;
              }
              .footer {
                  margin-top: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #6b7280;
              }
          </style>
      </head>
      <body>
          <div class="login-container">
              <h1>SKYTECH AUTOMATED</h1>
              <h2>Robot Fleet Management</h2>
              <form id="login-form">
                  <div class="input-group">
                      <label for="username">Username</label>
                      <input type="text" id="username" required>
                  </div>
                  <div class="input-group">
                      <label for="password">Password</label>
                      <input type="password" id="password" required>
                  </div>
                  <button type="submit">Login</button>
                  <div id="error-message" class="error-message"></div>
              </form>
              <div class="footer">
                  <p>Use credentials: Ozzydog / Ozzydog</p>
              </div>
          </div>

          <script>
              document.getElementById('login-form').addEventListener('submit', function(e) {
                  e.preventDefault();
                  
                  const username = document.getElementById('username').value;
                  const password = document.getElementById('password').value;
                  const errorElement = document.getElementById('error-message');
                  
                  if (username === 'Ozzydog' && password === 'Ozzydog') {
                      // Store auth info
                      localStorage.setItem('auth', 'true');
                      localStorage.setItem('username', username);
                      
                      // Redirect to dashboard
                      window.location.href = '/dashboard';
                  } else {
                      // Show error
                      errorElement.textContent = 'Invalid username or password';
                      errorElement.style.display = 'block';
                  }
              });
          </script>
      </body>
      </html>
    `);
  });
  
  // Added health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });
  
  // Direct login route with HTML response - bypassing Vite middleware
  app.use('/admin-login', (_req: Request, res: Response) => {
    // Set content type explicitly to avoid middleware interference
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Send raw HTML without template literals to avoid any potential processing
    res.send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SKYTECH AUTOMATED - Robot Fleet Management</title><style>*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}body{display:flex;justify-content:center;align-items:center;min-height:100vh;background-color:#111827;padding:1rem}.card{max-width:400px;width:100%;background-color:rgba(0,0,0,0.3);border-radius:8px;padding:2rem;color:#f3f4f6;border:1px solid #374151}.heading{font-size:2.5rem;font-weight:bold;background:linear-gradient(to right,#10b981,#059669);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem;text-align:center}.subheading{color:#9ca3af;font-size:1.125rem;margin-bottom:2rem;text-align:center}.title{font-size:1.5rem;text-align:center;margin-bottom:1.5rem;color:#f3f4f6}.form-group{margin-bottom:1.5rem}.label{display:block;margin-bottom:0.5rem;color:#d1d5db}.input{width:100%;padding:0.75rem;background-color:#1f2937;border:1px solid #374151;border-radius:4px;color:#f3f4f6;font-size:1rem}.button{width:100%;padding:0.75rem;background:linear-gradient(to right,#10b981,#065f46);color:white;border:none;border-radius:4px;font-weight:bold;font-size:1rem;cursor:pointer}.error{background-color:rgba(220,38,38,0.2);color:#f87171;padding:0.75rem;border-radius:4px;margin-bottom:1rem;border:1px solid #ef4444;display:none}.footer{margin-top:1.5rem;text-align:center;color:#6b7280;font-size:0.875rem}.small-text{font-size:0.75rem;margin-top:0.5rem}</style></head><body><div class="card"><div><h1 class="heading">SKYTECH AUTOMATED</h1><p class="subheading">Robot Fleet Management System</p></div><h2 class="title">Admin Login</h2><div id="error-message" class="error"></div><form id="login-form"><div class="form-group"><label for="username" class="label">Username</label><input id="username" class="input" required /></div><div class="form-group"><label for="password" class="label">Password</label><input id="password" type="password" class="input" required /></div><button type="submit" class="button" id="login-button">Login</button></form><div class="footer"><p>Fleet Management Admin Portal</p><p class="small-text">Access credentials: Ozzydog / Ozzydog</p></div></div><script>document.getElementById("login-form").addEventListener("submit",function(e){e.preventDefault();const username=document.getElementById("username").value;const password=document.getElementById("password").value;const errorElement=document.getElementById("error-message");const loginButton=document.getElementById("login-button");errorElement.style.display="none";errorElement.textContent="";loginButton.textContent="Logging in...";loginButton.disabled=true;if(username==="Ozzydog"&&password==="Ozzydog"){localStorage.setItem("auth","true");localStorage.setItem("username",username);localStorage.setItem("lastLogin",new Date().toISOString());window.location.href="/dashboard"}else{errorElement.textContent="Invalid username or password";errorElement.style.display="block";loginButton.textContent="Login";loginButton.disabled=false}});</script></body></html>');
  });
  
  // Robot configuration endpoints
  app.post("/api/robot/config", robotController.configureRobotConnection);
  app.post("/api/robot/connect", robotController.connectToRobot);
  app.post("/api/robot/initialize", robotController.initializeRobot);
  
  // Register specific robot L382502104987ir
  app.post("/api/robot/register-l382502104987ir", async (_req: Request, res: Response) => {
    try {
      const result = await registerL382502104987irRobot();
      return res.json({
        success: true,
        message: "Robot L382502104987ir registered successfully",
        data: result
      });
    } catch (error) {
      console.error("Error registering robot L382502104987ir:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to register robot L382502104987ir",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Auth endpoints
  app.post("/api/robot/auth", robotIndex.authenticateRobot);
  
  // Robot management endpoints
  app.get("/api/robots", robotIndex.getAllRobots);
  app.get("/api/robots/stats", robotIndex.getRobotStats);
  app.get("/api/robots/status", robotController.getRobotsStatus);
  app.get("/api/robot/:robotId", robotIndex.getRobotById);
  app.get("/api/robot/:robotId/status", robotIndex.getRobotStatus);
  app.get("/api/robot/:robotId/battery", robotIndex.getRobotBattery);
  app.get("/api/robot/:robotId/position", robotIndex.getRobotPosition);
  app.post("/api/robots/locate", robotIndex.locateRobot);
  app.post("/api/robots/charge", robotIndex.startCharging);
  
  // Movement endpoints
  app.post("/api/robot/:robotId/move", robotController.moveRobot);
  app.post("/api/robot/:robotId/move/multi-floor", robotIndex.moveRobotMultiFloor);
  app.post("/api/robot/:robotId/stop", robotController.stopRobot);
  app.post("/api/robot/:robotId/charge", robotIndex.goToChargingStation);
  app.post("/api/robot/:robotId/action", robotController.executeRobotAction);
  
  // Action endpoints
  app.post("/api/robot/:robotId/align", robotIndex.alignWithRack);
  app.post("/api/robot/:robotId/lift", robotIndex.liftRack);
  app.post("/api/robot/:robotId/lower", robotIndex.lowerRack);
  app.post("/api/robot/:robotId/doors/open", robotIndex.openDoors);
  app.post("/api/robot/:robotId/doors/close", robotIndex.closeDoors);
  
  // Task management endpoints
  app.get("/api/tasks", robotIndex.getAllTasks);
  app.get("/api/tasks/active", robotIndex.getActiveTasks);
  app.get("/api/tasks/stats", robotIndex.getTaskStats);
  app.get("/api/tasks/history", robotIndex.getTaskHistory);
  app.get("/api/tasks/completed/stats", robotIndex.getCompletedTaskStats);
  
  // Task workflow endpoints
  app.use('/api/tasks', taskWorkflowController.default);
  
  // Legacy task endpoints
  app.post("/api/tasks", robotIndex.createTask);
  app.post("/api/tasks/:taskId/pause", robotIndex.pauseTask);
  app.post("/api/tasks/:taskId/resume", robotIndex.resumeTask);
  app.post("/api/tasks/:taskId/retry", robotIndex.retryTask);
  app.post("/api/tasks/pause-all", robotIndex.pauseAllTasks);
  
  // Maps and POIs endpoints
  app.get("/api/maps", robotIndex.getAllMaps);
  app.post("/api/maps", robotIndex.createMap);
  app.get("/api/pois", robotIndex.getAllPois);
  app.post("/api/pois", robotIndex.createPoi);
  
  // Robot Points API endpoints
  app.get("/api/robot/list-endpoints", async (_req: Request, res: Response) => {
    try {
      // List the available API endpoints on the robot for exploration
      const endpoints = [
        "getMapDetail",
        "getPoiList",
        "getTaskList",
        "getRobotStatus",
        "getRobotList"
      ];
      
      return res.json({ 
        message: "Available API endpoints to explore",
        endpoints
      });
    } catch (error) {
      console.error("Error listing endpoints:", error);
      return res.status(500).json({ error: "Failed to list endpoints" });
    }
  });
  
  app.post("/api/robot/getPoints", async (req: Request, res: Response) => {
    try {
      const { robotId, floor } = req.body;
      
      // Validate required parameters
      if (!robotId) {
        return res.status(400).json({ error: "Missing required robotId parameter" });
      }
      
      // Default to Floor1 if not specified
      const floorId = floor || "Floor1";
      
      console.log(`*** ATTEMPTING TO RETRIEVE REAL POI LIST FOR ROBOT ${robotId} ON FLOOR ${floorId} ***`);
      
      // Use our improved points.ts implementation to get real-time data
      const points = await robotPoints.getFloorPoints(floorId, robotId);
      
      // Log the retrieved points
      console.log(`Retrieved ${points.length} points from robot ${robotId}`);
      if (points.length > 0) {
        console.log(`Sample point: ${JSON.stringify(points[0])}`);
      }
      
      return res.json({
        success: true,
        robotId,
        floor: floorId,
        points,
        count: points.length,
        timestamp: new Date().toISOString(),
        source: "robot_api_direct"
      });
    } catch (error) {
      console.error("Error getting robot points:", error);
      return res.status(500).json({ 
        success: false,
        error: "Failed to get robot points",
        robotId,
        floor: floorId,
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Alerts endpoints
  app.get("/api/alerts", robotIndex.getAllAlerts);
  app.get("/api/alerts/recent", robotIndex.getRecentAlerts);
  app.get("/api/alerts/stats", robotIndex.getAlertStats);
  app.post("/api/alerts/:alertId/resolve", robotIndex.resolveAlert);
  
  return httpServer;
}
