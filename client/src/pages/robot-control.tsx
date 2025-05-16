import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Robot, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  RotateCw,
  Stop,
  Power,
  Activity,
  Battery,
  AlertTriangle,
  Save,
  Wifi
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface RobotStatus {
  robotId: string;
  name: string;
  status: 'online' | 'offline' | 'busy' | 'error' | 'charging';
  batteryLevel: number;
  position?: {
    x: number;
    y: number;
    yaw: number;
    floor: string;
  };
  lastSeen: string;
  error?: string | null;
  connected: boolean;
}

export default function RobotControl() {
  const { toast } = useToast();
  const [robotId, setRobotId] = useState('L382502104987ir');
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Not connected');
  const [logs, setLogs] = useState<string[]>([]);
  const [movementSpeed, setMovementSpeed] = useState(50);
  const [ipConfig, setIpConfig] = useState({
    publicIp: '47.180.91.99',
    localIp: '192.168.4.31',
    port: '80'
  });

  // Connect to robot
  const connectToRobot = async () => {
    setLoading(true);
    setLogs(prev => [...prev, `Connecting to robot ${robotId}...`]);
    
    try {
      // Save IP configuration first
      await axios.post('/api/robot/config', {
        robotId,
        publicIp: ipConfig.publicIp,
        localIp: ipConfig.localIp,
        port: Number(ipConfig.port)
      });
      
      // Try to connect
      const response = await axios.post('/api/robot/connect', { robotId });
      setConnectionStatus('Connected');
      setLogs(prev => [...prev, `Successfully connected to robot ${robotId}`]);
      
      toast({
        title: "Robot Connected",
        description: `Successfully connected to robot ${robotId}`
      });
      
      // Get initial status
      fetchRobotStatus();
    } catch (error: any) {
      setConnectionStatus('Connection failed');
      setLogs(prev => [...prev, `Error connecting to robot: ${error.response?.data?.message || error.message}`]);
      
      toast({
        title: "Connection Failed",
        description: error.response?.data?.message || error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch robot status
  const fetchRobotStatus = async () => {
    if (!robotId) return;
    
    try {
      const response = await axios.get(`/api/robot/${robotId}/status`);
      
      setRobotStatus({
        robotId,
        name: response.data.name || `Robot ${robotId}`,
        status: response.data.status || 'offline',
        batteryLevel: response.data.batteryLevel || 0,
        lastSeen: response.data.lastSeen || new Date().toISOString(),
        error: response.data.error,
        position: response.data.position,
        connected: true
      });
      
      setLogs(prev => [...prev, `Received status update from robot ${robotId}`]);
    } catch (error: any) {
      console.error('Error fetching robot status:', error);
      setLogs(prev => [...prev, `Error fetching status: ${error.response?.data?.message || error.message}`]);
      
      if (robotStatus) {
        setRobotStatus({
          ...robotStatus,
          connected: false
        });
      }
    }
  };
  
  // Status polling
  useEffect(() => {
    if (connectionStatus === 'Connected') {
      const interval = setInterval(() => {
        fetchRobotStatus();
      }, 5000); // Poll every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [connectionStatus, robotId]);
  
  // Movement commands
  const moveRobot = async (direction: string, distance: number = 1) => {
    if (!robotId || !robotStatus?.connected) return;
    
    setLoading(true);
    setLogs(prev => [...prev, `Sending ${direction} movement command...`]);
    
    try {
      // Calculate position based on current position and direction
      let x = robotStatus.position?.x || 0;
      let y = robotStatus.position?.y || 0;
      let yaw = robotStatus.position?.yaw || 0;
      
      const speed = movementSpeed / 100; // Convert to 0-1 scale
      
      switch (direction) {
        case 'forward':
          x += Math.cos(yaw * Math.PI / 180) * distance;
          y += Math.sin(yaw * Math.PI / 180) * distance;
          break;
        case 'backward':
          x -= Math.cos(yaw * Math.PI / 180) * distance;
          y -= Math.sin(yaw * Math.PI / 180) * distance;
          break;
        case 'left':
          x += Math.cos((yaw - 90) * Math.PI / 180) * distance;
          y += Math.sin((yaw - 90) * Math.PI / 180) * distance;
          break;
        case 'right':
          x += Math.cos((yaw + 90) * Math.PI / 180) * distance;
          y += Math.sin((yaw + 90) * Math.PI / 180) * distance;
          break;
        case 'rotate_left':
          yaw = (yaw - 45) % 360;
          break;
        case 'rotate_right':
          yaw = (yaw + 45) % 360;
          break;
      }
      
      const response = await axios.post(`/api/robot/${robotId}/move`, {
        x: parseFloat(x.toFixed(2)),
        y: parseFloat(y.toFixed(2)),
        yaw: Math.round(yaw),
        speed,
        areaId: robotStatus.position?.floor || 'area_001'
      });
      
      setLogs(prev => [...prev, `Movement command sent: ${direction}`]);
      setRobotStatus(prev => prev ? {
        ...prev,
        status: 'busy',
        position: {
          ...prev.position!,
          x: parseFloat(x.toFixed(2)),
          y: parseFloat(y.toFixed(2)),
          yaw: Math.round(yaw)
        }
      } : null);
      
      toast({
        title: "Movement Command Sent",
        description: `Robot is moving ${direction}`
      });
    } catch (error: any) {
      console.error('Error moving robot:', error);
      setLogs(prev => [...prev, `Error moving robot: ${error.response?.data?.message || error.message}`]);
      
      toast({
        title: "Movement Failed",
        description: error.response?.data?.message || error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Stop robot
  const stopRobot = async () => {
    if (!robotId || !robotStatus?.connected) return;
    
    setLoading(true);
    setLogs(prev => [...prev, 'Sending stop command...']);
    
    try {
      const response = await axios.post(`/api/robot/${robotId}/stop`);
      
      setLogs(prev => [...prev, 'Stop command sent']);
      setRobotStatus(prev => prev ? {
        ...prev,
        status: 'online'
      } : null);
      
      toast({
        title: "Robot Stopped",
        description: "Robot has been stopped successfully"
      });
    } catch (error: any) {
      console.error('Error stopping robot:', error);
      setLogs(prev => [...prev, `Error stopping robot: ${error.response?.data?.message || error.message}`]);
      
      toast({
        title: "Stop Command Failed",
        description: error.response?.data?.message || error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Save IP configuration
  const saveIpConfig = async () => {
    try {
      await axios.post('/api/robot/config', {
        robotId,
        publicIp: ipConfig.publicIp,
        localIp: ipConfig.localIp,
        port: Number(ipConfig.port)
      });
      
      toast({
        title: "Configuration Saved",
        description: "Robot IP configuration saved successfully"
      });
    } catch (error: any) {
      console.error('Error saving configuration:', error);
      
      toast({
        title: "Save Failed",
        description: error.response?.data?.message || error.message,
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Robot Control Panel</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            Status: 
            <span className={`ml-2 ${
              connectionStatus === 'Connected' 
                ? 'text-green-500' 
                : connectionStatus === 'Connection failed' 
                  ? 'text-red-500' 
                  : 'text-yellow-500'
            }`}>
              {connectionStatus}
            </span>
          </span>
        </div>
      </div>
      
      <Tabs defaultValue="control" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="control">Control Panel</TabsTrigger>
          <TabsTrigger value="status">Robot Status</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="control" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Robot className="mr-2 h-5 w-5" />
                  Robot Movement Controls
                </CardTitle>
                <CardDescription>
                  Use these controls to move the robot
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div></div>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => moveRobot('forward')}
                    disabled={loading || !robotStatus?.connected}
                    className="h-16 aspect-square"
                  >
                    <ArrowUp className="h-6 w-6" />
                  </Button>
                  <div></div>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => moveRobot('left')}
                    disabled={loading || !robotStatus?.connected}
                    className="h-16 aspect-square"
                  >
                    <ArrowLeft className="h-6 w-6" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="lg" 
                    onClick={stopRobot}
                    disabled={loading || !robotStatus?.connected}
                    className="h-16 aspect-square"
                  >
                    <Stop className="h-6 w-6" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => moveRobot('right')}
                    disabled={loading || !robotStatus?.connected}
                    className="h-16 aspect-square"
                  >
                    <ArrowRight className="h-6 w-6" />
                  </Button>
                  <div></div>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => moveRobot('backward')}
                    disabled={loading || !robotStatus?.connected}
                    className="h-16 aspect-square"
                  >
                    <ArrowDown className="h-6 w-6" />
                  </Button>
                  <div></div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => moveRobot('rotate_left')}
                    disabled={loading || !robotStatus?.connected}
                    className="h-12"
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Rotate Left
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => moveRobot('rotate_right')}
                    disabled={loading || !robotStatus?.connected}
                    className="h-12"
                  >
                    <RotateCw className="h-5 w-5 mr-2" />
                    Rotate Right
                  </Button>
                </div>
                
                <div className="mt-6">
                  <Label htmlFor="speed">Movement Speed ({movementSpeed}%)</Label>
                  <Input 
                    id="speed"
                    type="range"
                    min="10"
                    max="100"
                    value={movementSpeed}
                    onChange={(e) => setMovementSpeed(parseInt(e.target.value))}
                    className="mt-2"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={connectToRobot}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin h-4 w-4 mr-2 border-2 border-b-0 border-r-0 border-white rounded-full"></div>
                      Connecting...
                    </div>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      {connectionStatus === 'Connected' ? 'Reconnect' : 'Connect to Robot'}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="mr-2 h-5 w-5" />
                  Robot Activity Log
                </CardTitle>
                <CardDescription>
                  Recent operations and status changes
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {logs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No activity logs yet. Connect to a robot to begin.
                    </p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="text-sm py-1 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-xs text-muted-foreground mr-2">
                          {new Date().toLocaleTimeString()}:
                        </span>
                        {log}
                      </div>
                    )).reverse()
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="status">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center">
                  <Robot className="mr-2 h-5 w-5" />
                  Robot Status
                </CardTitle>
                <CardDescription>
                  Current state and information
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!robotStatus ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      Connect to a robot to view status information
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Robot ID</p>
                        <p className="text-lg">{robotStatus.robotId}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Name</p>
                        <p className="text-lg">{robotStatus.name}</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <p className="text-sm font-medium mb-2">Status</p>
                      <div className="flex items-center">
                        <div className={`h-3 w-3 rounded-full mr-2 ${
                          robotStatus.status === 'online' ? 'bg-green-500' :
                          robotStatus.status === 'busy' ? 'bg-blue-500' :
                          robotStatus.status === 'charging' ? 'bg-yellow-500' :
                          robotStatus.status === 'error' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}></div>
                        <p className="capitalize">{robotStatus.status}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center">
                        <Battery className="h-4 w-4 mr-1" /> Battery Level
                      </p>
                      <Progress 
                        value={robotStatus.batteryLevel} 
                        className="h-2"
                      />
                      <p className="text-sm mt-1">{robotStatus.batteryLevel}%</p>
                    </div>
                    
                    {robotStatus.position && (
                      <div>
                        <p className="text-sm font-medium mb-2">Current Position</p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">X:</span> {robotStatus.position.x.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Y:</span> {robotStatus.position.y.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Yaw:</span> {robotStatus.position.yaw}°
                          </div>
                        </div>
                        <div className="mt-1">
                          <span className="text-muted-foreground text-sm">Floor:</span> {robotStatus.position.floor}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-sm font-medium mb-1">Last Seen</p>
                      <p className="text-sm">{new Date(robotStatus.lastSeen).toLocaleString()}</p>
                    </div>
                    
                    {robotStatus.error && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 rounded-md">
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">{robotStatus.error}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  onClick={fetchRobotStatus}
                  disabled={loading || !robotStatus?.connected}
                  className="w-full"
                >
                  Refresh Status
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Connection Information</CardTitle>
                <CardDescription>Network details and connectivity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="robotId">Robot ID</Label>
                    <Input
                      id="robotId"
                      value={robotId}
                      onChange={(e) => setRobotId(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Connection Status</p>
                      <div className="flex items-center">
                        <div className={`h-3 w-3 rounded-full mr-2 ${
                          connectionStatus === 'Connected' ? 'bg-green-500' : 
                          connectionStatus === 'Connection failed' ? 'bg-red-500' : 
                          'bg-yellow-500'
                        }`}></div>
                        <p>{connectionStatus}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Network Type</p>
                      <p>Remote Connection (WAN)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm">
                    <Wifi className="h-4 w-4" />
                    <span>Connecting via: {ipConfig.publicIp}:{ipConfig.port}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Robot Connection Settings</CardTitle>
              <CardDescription>Configure IP addresses and connection details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="robotId">Robot ID</Label>
                <Input
                  id="robotId"
                  value={robotId}
                  onChange={(e) => setRobotId(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The unique identifier for the robot
                </p>
              </div>
              
              <div>
                <Label htmlFor="publicIp">Public IP Address</Label>
                <Input
                  id="publicIp"
                  value={ipConfig.publicIp}
                  onChange={(e) => setIpConfig({...ipConfig, publicIp: e.target.value})}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The public IP address for WAN access
                </p>
              </div>
              
              <div>
                <Label htmlFor="localIp">Local IP Address</Label>
                <Input
                  id="localIp"
                  value={ipConfig.localIp}
                  onChange={(e) => setIpConfig({...ipConfig, localIp: e.target.value})}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The local IP address for LAN access
                </p>
              </div>
              
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  value={ipConfig.port}
                  onChange={(e) => setIpConfig({...ipConfig, port: e.target.value})}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The port number for the robot connection
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIpConfig({
                    publicIp: '47.180.91.99',
                    localIp: '192.168.4.31',
                    port: '80'
                  });
                }}
              >
                Reset to Default
              </Button>
              <Button onClick={saveIpConfig}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}