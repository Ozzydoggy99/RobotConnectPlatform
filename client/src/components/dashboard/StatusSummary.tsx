import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bot, 
  Equal, 
  CheckCircle, 
  AlertTriangle 
} from "lucide-react";

const StatusIndicator = ({ status, count }: { status: string; count: number }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "status-online";
      case "offline":
        return "status-offline";
      case "warning":
        return "status-warning";
      case "error":
        return "status-error";
      default:
        return "status-offline";
    }
  };

  return (
    <div className="flex items-center">
      <span className={`status-indicator ${getStatusColor(status)}`}></span>
      <span className="text-gray-600">
        {status.charAt(0).toUpperCase() + status.slice(1)}: {count}
      </span>
    </div>
  );
};

export default function StatusSummary() {
  const { data: robotStats, isLoading: isRobotStatsLoading } = useQuery({
    queryKey: ["/api/robots/stats"],
  });

  const { data: taskStats, isLoading: isTaskStatsLoading } = useQuery({
    queryKey: ["/api/tasks/stats"],
  });

  const { data: completedStats, isLoading: isCompletedStatsLoading } = useQuery({
    queryKey: ["/api/tasks/completed/stats"],
  });

  const { data: alertStats, isLoading: isAlertStatsLoading } = useQuery({
    queryKey: ["/api/alerts/stats"],
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Robots Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-primary-100 rounded-md p-3">
              <Bot className="text-primary-600 h-5 w-5" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Total Robots</p>
              {isRobotStatsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-semibold text-gray-800">{robotStats?.total || 0}</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              {isRobotStatsLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <>
                  <StatusIndicator status="online" count={robotStats?.online || 0} />
                  <StatusIndicator status="offline" count={robotStats?.offline || 0} />
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Active Tasks Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <Equal className="text-blue-600 h-5 w-5" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Active Tasks</p>
              {isTaskStatsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-semibold text-gray-800">{taskStats?.active || 0}</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            {isTaskStatsLoading ? (
              <Skeleton className="h-6 w-full" />
            ) : (
              <>
                <Progress value={taskStats?.completionPercentage || 0} className="h-2" />
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>{taskStats?.completionPercentage || 0}% Complete</span>
                  <span>{100 - (taskStats?.completionPercentage || 0)}% Pending</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Completed Tasks Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <CheckCircle className="text-green-600 h-5 w-5" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Completed Tasks</p>
              {isCompletedStatsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-semibold text-gray-800">{completedStats?.total || 0}</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            {isCompletedStatsLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              <div className="flex items-center text-sm text-green-600">
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span>{completedStats?.percentIncrease || 0}% increase</span>
                <span className="text-gray-500 ml-1">from last week</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* System Alerts Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
              <AlertTriangle className="text-red-600 h-5 w-5" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">System Alerts</p>
              {isAlertStatsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-semibold text-gray-800">{alertStats?.total || 0}</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            {isAlertStatsLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {alertStats?.high || 0} High, {alertStats?.medium || 0} Medium
                </span>
                <a href="/alerts" className="text-sm text-primary-600 hover:text-primary-700 font-medium">View all</a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
