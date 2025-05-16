import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Define a static login route at the top level to bypass all middleware
const simpleLoginHtml = `<!DOCTYPE html>
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
</html>`;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register root login page
app.get("/", (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(simpleLoginHtml);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Import robot monitoring and websocket components
  const { websocketHandler } = await import('./websocket');
  const { robotMonitor } = await import('./robot/robot-monitor');
  const { registerL382502104987irRobot } = await import('./robot/robot-registration');

  const server = await registerRoutes(app);
  
  // Initialize WebSocket server
  websocketHandler.initialize(server);
  
  // Register and initialize our test robot L382502104987ir
  try {
    console.log('Registering robot L382502104987ir...');
    const result = await registerL382502104987irRobot();
    console.log('Robot L382502104987ir registered successfully:', result.robot.id);
  } catch (error) {
    console.error('Failed to register robot L382502104987ir:', error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start monitoring all robots
    robotMonitor.startMonitoringAllRobots().catch(err => {
      console.error('Failed to start monitoring robots:', err);
    });
  });
  
  // Handle server shutdown
  const handleShutdown = async () => {
    console.log('Shutting down server...');
    
    // Stop monitoring robots
    await robotMonitor.stopMonitoringAllRobots();
    
    // Stop WebSocket server
    websocketHandler.stop();
    
    // Close HTTP server
    server.close();
    
    process.exit(0);
  };

  // Register shutdown handlers
  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
})();
