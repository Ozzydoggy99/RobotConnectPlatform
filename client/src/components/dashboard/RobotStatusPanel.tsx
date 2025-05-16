import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Battery, BatteryCharging, BatteryWarning, BatteryLow, HelpCircle } from "lucide-react";

type RobotStatus = "online" | "offline" | "warning" | "error";

interface RobotStatusProps {
  status: RobotStatus;
  name: string;
  batteryLevel: number;
}

const StatusIndicator = ({ status }: { status: RobotStatus }) => {
  const statusClasses = {
    online: "status-online",
    offline: "status-offline",
    warning: "status-warning",
    error: "status-error",
  };

  return <span className={`status-indicator ${statusClasses[status]}`}></span>;
};

const BatteryIcon = ({ level }: { level: number }) => {
  if (level === undefined) return <HelpCircle className="text-gray-400 h-4 w-4" />;
  
  if (level >= 80) return <Battery className="text-green-500 h-4 w-4" />;
  if (level >= 40) return <BatteryCharging className="text-yellow-500 h-4 w-4" />;
  if (level >= 15) return <BatteryWarning className="text-orange-500 h-4 w-4" />;
  return <BatteryLow className="text-red-500 h-4 w-4" />;
};

const RobotStatusItem = ({ status, name, batteryLevel }: RobotStatusProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center">
      <StatusIndicator status={status} />
      <span className="font-medium text-gray-800">{name}</span>
    </div>
    <div className="flex items-center text-sm">
      <BatteryIcon level={batteryLevel} />
      <span className="ml-1">{batteryLevel !== undefined ? `${batteryLevel}%` : "Unknown"}</span>
    </div>
  </div>
);

export default function RobotStatusPanel() {
  const navigate = useNavigate();
  const { data: robots, isLoading } = useQuery({
    queryKey: ["/api/robots/status"],
  });

  const navigateToRobots = () => {
    navigate("/robots");
  };

  return (
    <Card>
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle className="text-lg font-medium text-gray-800">Robot Status</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : robots && robots.length > 0 ? (
          <div className="space-y-4">
            {robots.slice(0, 4).map((robot: any) => (
              <RobotStatusItem
                key={robot.id}
                status={robot.status}
                name={robot.name}
                batteryLevel={robot.batteryLevel}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">No robots found</p>
          </div>
        )}
        
        {robots && robots.length > 0 && (
          <div className="mt-4 text-center">
            <Button 
              variant="link" 
              onClick={navigateToRobots}
              className="text-primary-600 hover:text-primary-700"
            >
              View all robots
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
