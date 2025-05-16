import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TaskCard from "@/components/tasks/TaskCard";
import { Filter, Plus } from "lucide-react";

export default function ActiveTasksPanel() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["/api/tasks/active", filter],
  });

  const handleNewTask = () => {
    navigate("/tasks/create");
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium text-gray-800">Active Tasks</CardTitle>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="h-4 w-4 mr-1" />
              Filter
            </Button>
            <Button size="sm" className="h-8" onClick={handleNewTask}>
              <Plus className="h-4 w-4 mr-1" />
              New Task
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="space-y-4">
            {tasks.map((task: any) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No active tasks found</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={handleNewTask}
            >
              Create your first task
            </Button>
          </div>
        )}
        
        {tasks && tasks.length > 0 && (
          <div className="mt-4 text-center">
            <Button 
              variant="link" 
              onClick={() => navigate("/tasks")}
              className="text-primary-600 hover:text-primary-700"
            >
              View all active tasks
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
