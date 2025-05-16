import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  level: "high" | "medium" | "low";
  message: string;
  robotName: string;
  timestamp: string;
}

const AlertItem = ({ alert }: { alert: Alert }) => {
  const borderColors = {
    high: "border-red-500 bg-red-50",
    medium: "border-yellow-500 bg-yellow-50",
    low: "border-blue-500 bg-blue-50",
  };

  const textColors = {
    high: "text-red-800",
    medium: "text-yellow-800",
    low: "text-blue-800",
  };

  const subTextColors = {
    high: "text-red-700",
    medium: "text-yellow-700",
    low: "text-blue-700",
  };

  return (
    <div className={`border-l-4 ${borderColors[alert.level]} p-3 rounded-r-md`}>
      <p className={`text-sm font-medium ${textColors[alert.level]}`}>{alert.message}</p>
      <p className={`text-xs ${subTextColors[alert.level]} mt-1`}>
        {alert.robotName} - {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
      </p>
    </div>
  );
};

export default function AlertsPanel() {
  const navigate = useNavigate();
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["/api/alerts/recent"],
  });

  const navigateToAlerts = () => {
    navigate("/alerts");
  };

  return (
    <Card>
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle className="text-lg font-medium text-gray-800">Recent Alerts</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div className="space-y-4">
            {alerts.slice(0, 3).map((alert: Alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">No recent alerts</p>
          </div>
        )}
        
        {alerts && alerts.length > 0 && (
          <div className="mt-4 text-center">
            <Button 
              variant="link" 
              onClick={navigateToAlerts}
              className="text-primary-600 hover:text-primary-700"
            >
              View all alerts
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
