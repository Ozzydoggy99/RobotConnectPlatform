import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Plus, 
  Battery, 
  BatteryCharging, 
  BatteryLow,
  Filter
} from "lucide-react";

// Custom styles for robot status indicator
const statusIndicatorStyles = (status: string) => {
  const statusClasses = {
    online: "status-online",
    offline: "status-offline",
    warning: "status-warning",
    error: "status-error",
  };
  
  return `status-indicator ${statusClasses[status] || "status-offline"}`;
};

export default function RobotsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const { data: robots, isLoading } = useQuery({
    queryKey: ["/api/robots", statusFilter],
  });
  
  // Filter robots based on search query and status filter
  const filteredRobots = robots?.filter((robot: any) => {
    const matchesSearch = 
      robot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      robot.robotId.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || robot.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Render battery indicator
  const renderBatteryIndicator = (level: number | undefined) => {
    if (level === undefined) return null;
    
    if (level >= 50) {
      return <Battery className="text-green-500 h-5 w-5" />;
    } else if (level >= 20) {
      return <BatteryCharging className="text-yellow-500 h-5 w-5" />;
    } else {
      return <BatteryLow className="text-red-500 h-5 w-5" />;
    }
  };
  
  // Format robot status for display
  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };
  
  // Status colors for badges
  const statusColors = {
    online: "bg-green-100 text-green-800 border-green-200",
    offline: "bg-gray-100 text-gray-800 border-gray-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    error: "bg-red-100 text-red-800 border-red-200",
    charging: "bg-blue-100 text-blue-800 border-blue-200",
    busy: "bg-purple-100 text-purple-800 border-purple-200",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Robots</h1>
        <p className="text-sm text-gray-600 mt-1">Manage and monitor your robot fleet</p>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                type="text" 
                placeholder="Search robots..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="h-10">
                <Filter className="h-4 w-4 mr-2" />
                <select 
                  className="bg-transparent border-none outline-none cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="charging">Charging</option>
                </select>
              </Button>
              
              <Button size="sm" className="h-10">
                <Plus className="h-4 w-4 mr-2" />
                Add Robot
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredRobots && filteredRobots.length > 0 ? (
          filteredRobots.map((robot: any) => (
            <Card key={robot.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary-100 text-primary-800 rounded-full p-4 hidden sm:flex items-center justify-center">
                      <span className="material-icons">smart_toy</span>
                    </div>
                    
                    <div>
                      <div className="flex items-center">
                        <span className={statusIndicatorStyles(robot.status)}></span>
                        <h3 className="text-lg font-medium text-gray-800 mr-2">{robot.name}</h3>
                        <Badge variant="outline" className={statusColors[robot.status]}>
                          {formatStatus(robot.status)}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-500">ID: {robot.robotId}</p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-gray-500">Battery</p>
                          <div className="flex items-center mt-1">
                            {renderBatteryIndicator(robot.batteryLevel)}
                            <span className="text-sm font-medium ml-1">
                              {robot.batteryLevel !== undefined ? `${robot.batteryLevel}%` : "Unknown"}
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-xs text-gray-500">Current Floor</p>
                          <p className="text-sm font-medium mt-1">{robot.floor || "Unknown"}</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-gray-500">Last Seen</p>
                          <p className="text-sm font-medium mt-1">
                            {robot.lastSeen ? new Date(robot.lastSeen).toLocaleTimeString() : "Never"}
                          </p>
                        </div>
                        
                        {robot.error && (
                          <div>
                            <p className="text-xs text-gray-500">Error</p>
                            <p className="text-sm font-medium text-red-600 mt-1">{robot.error}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-row sm:flex-col justify-end gap-2 mt-4 sm:mt-0">
                    <Button size="sm">Details</Button>
                    <Button variant="outline" size="sm">Control</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No robots found matching your criteria</p>
              <Button variant="outline" className="mt-4">
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
