import { useNavigate } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  PlusCircle, 
  MapPin, 
  Battery, 
  PauseCircle 
} from "lucide-react";

export default function QuickActions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const createTaskAction = () => {
    navigate("/tasks/create");
  };
  
  const locateRobotMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/robots/locate", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Robot location requested",
        description: "The robot location has been requested successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to request robot location: ${error}`,
        variant: "destructive",
      });
    },
  });
  
  const startChargingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/robots/charge", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Charging started",
        description: "The robot has been instructed to return to the charger.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to start charging: ${error}`,
        variant: "destructive",
      });
    },
  });
  
  const pauseAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tasks/pause-all", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tasks paused",
        description: "All tasks have been paused successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to pause tasks: ${error}`,
        variant: "destructive",
      });
    },
  });

  const handleLocateRobot = () => {
    locateRobotMutation.mutate();
  };

  const handleStartCharging = () => {
    startChargingMutation.mutate();
  };

  const handlePauseAll = () => {
    pauseAllMutation.mutate();
  };

  return (
    <Card>
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle className="text-lg font-medium text-gray-800">Quick Actions</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center h-auto p-4"
            onClick={createTaskAction}
          >
            <PlusCircle className="h-5 w-5 text-primary-600 mb-1" />
            <span className="text-xs font-medium text-gray-700">New Task</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center h-auto p-4"
            onClick={handleLocateRobot}
            disabled={locateRobotMutation.isPending}
          >
            <MapPin className="h-5 w-5 text-primary-600 mb-1" />
            <span className="text-xs font-medium text-gray-700">Locate Robot</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center h-auto p-4"
            onClick={handleStartCharging}
            disabled={startChargingMutation.isPending}
          >
            <Battery className="h-5 w-5 text-primary-600 mb-1" />
            <span className="text-xs font-medium text-gray-700">Start Charging</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center h-auto p-4"
            onClick={handlePauseAll}
            disabled={pauseAllMutation.isPending}
          >
            <PauseCircle className="h-5 w-5 text-primary-600 mb-1" />
            <span className="text-xs font-medium text-gray-700">Pause All</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
