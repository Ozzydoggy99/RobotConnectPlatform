import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, RefreshCw, MoreVertical, ArrowRight } from "lucide-react";

// Define status indicator component
const StatusIndicator = ({ status }: { status: string }) => {
  const statusClasses = {
    "in_progress": "status-online",
    "pending": "status-offline",
    "paused": "status-warning",
    "failed": "status-error",
    "completed": "status-online",
  };
  
  return <span className={`status-indicator ${statusClasses[status] || "status-offline"}`}></span>;
};

// Define status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const badgeVariants: Record<string, any> = {
    "in_progress": { className: "bg-blue-100 text-blue-800", label: "In Progress" },
    "pending": { className: "bg-gray-100 text-gray-800", label: "Pending" },
    "paused": { className: "bg-yellow-100 text-yellow-800", label: "Paused" },
    "failed": { className: "bg-red-100 text-red-800", label: "Failed" },
    "completed": { className: "bg-green-100 text-green-800", label: "Completed" },
  };
  
  const variant = badgeVariants[status] || badgeVariants.pending;
  
  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
};

interface TaskCardProps {
  task: {
    id: string;
    taskId: string;
    name: string;
    status: string;
    robotId: string;
    robotName?: string;
    taskType: string;
    startedAt?: string;
    points: any[];
    currentPoint?: any;
    progress?: number;
    errorDetails?: any;
  };
}

export default function TaskCard({ task }: TaskCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Calculate time elapsed since task started
  const getTimeElapsed = () => {
    if (!task.startedAt) return "Not started";
    
    const minutes = Math.floor((new Date().getTime() - new Date(task.startedAt).getTime()) / 60000);
    return `${minutes} min ago`;
  };
  
  // Format task type for display
  const formatTaskType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Pause task mutation
  const pauseTaskMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/tasks/${task.taskId}/pause`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/active"] });
      toast({
        title: "Task paused",
        description: `The task "${task.name}" has been paused.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to pause task: ${error}`,
        variant: "destructive",
      });
    },
  });
  
  // Resume task mutation
  const resumeTaskMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/tasks/${task.taskId}/resume`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/active"] });
      toast({
        title: "Task resumed",
        description: `The task "${task.name}" has been resumed.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to resume task: ${error}`,
        variant: "destructive",
      });
    },
  });
  
  // Retry task mutation
  const retryTaskMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/tasks/${task.taskId}/retry`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/active"] });
      toast({
        title: "Task retried",
        description: `The task "${task.name}" is being retried.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to retry task: ${error}`,
        variant: "destructive",
      });
    },
  });
  
  // Calculate progress percentage
  const progressPercentage = task.progress || 0;
  
  // Get the right action button based on status
  const ActionButton = () => {
    if (task.status === "in_progress") {
      return (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => pauseTaskMutation.mutate()}
          disabled={pauseTaskMutation.isPending}
        >
          <Pause className="h-4 w-4" />
        </Button>
      );
    }
    
    if (task.status === "paused") {
      return (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => resumeTaskMutation.mutate()}
          disabled={resumeTaskMutation.isPending}
        >
          <Play className="h-4 w-4" />
        </Button>
      );
    }
    
    if (task.status === "failed") {
      return (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => retryTaskMutation.mutate()}
          disabled={retryTaskMutation.isPending}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      );
    }
    
    return null;
  };

  return (
    <div className="task-card bg-white border border-gray-200 rounded-lg p-4 hover:shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <StatusIndicator status={task.status} />
          <h3 className="font-medium text-gray-800">{task.name}</h3>
          <span className="ml-2"><StatusBadge status={task.status} /></span>
        </div>
        <div className="flex space-x-2">
          <ActionButton />
          <Button size="icon" variant="ghost">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500">Robot</p>
          <p className="text-sm font-medium">{task.robotName || task.robotId}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Task Type</p>
          <p className="text-sm font-medium">{formatTaskType(task.taskType)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Started</p>
          <p className="text-sm font-medium">{getTimeElapsed()}</p>
        </div>
      </div>
      
      {/* Task path visualization */}
      {task.points && task.points.length > 0 && (
        <div className="flex items-center space-x-1 text-xs text-gray-500 mb-3 overflow-x-auto">
          {task.points.map((point, index) => (
            <div key={index} className="flex items-center min-w-fit">
              {index > 0 && <ArrowRight className="text-gray-400 h-3 w-3 mx-1" />}
              <span className="px-2 py-1 bg-gray-100 rounded-md whitespace-nowrap">
                {point.ext?.name || `Point ${index + 1}`}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Error display */}
      {task.status === "failed" && task.errorDetails && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">
                Error Code: {task.errorDetails.code}
              </p>
              <p className="text-xs text-red-700">{task.errorDetails.message}</p>
            </div>
          </div>
          <div className="flex space-x-2 mt-2">
            <Button
              variant="link"
              size="sm"
              className="text-xs font-medium text-red-600 hover:text-red-800 h-auto p-0"
            >
              View details
            </Button>
            <Button
              variant="link"
              size="sm"
              className="text-xs font-medium text-gray-700 hover:text-gray-900 h-auto p-0"
              onClick={() => retryTaskMutation.mutate()}
              disabled={retryTaskMutation.isPending}
            >
              Try again
            </Button>
          </div>
        </div>
      )}
      
      {/* Progress bar */}
      <div>
        <Progress value={progressPercentage} className="h-1.5" />
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>
            {task.currentPoint 
              ? `At point: ${task.currentPoint.ext?.name || 'Current Point'}`
              : 'Not started'}
          </span>
          <span>{progressPercentage}%</span>
        </div>
      </div>
    </div>
  );
}
