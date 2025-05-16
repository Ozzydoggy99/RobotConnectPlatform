import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import TaskCard from "@/components/tasks/TaskCard";
import { Search, Plus, Filter } from "lucide-react";

export default function TasksPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["/api/tasks", statusTab],
  });
  
  // Filter tasks based on search query
  const filteredTasks = tasks?.filter((task: any) => 
    task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.robotId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (task.robotName && task.robotName.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  // Create task handler
  const handleCreateTask = () => {
    navigate("/tasks/create");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Tasks</h1>
        <p className="text-sm text-gray-600 mt-1">Manage and monitor your robot tasks</p>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                type="text" 
                placeholder="Search tasks..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="h-10">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              
              <Button size="sm" className="h-10" onClick={handleCreateTask}>
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="all" value={statusTab} onValueChange={setStatusTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="paused">Paused</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
        
        <TabsContent value={statusTab} className="space-y-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))
          ) : filteredTasks && filteredTasks.length > 0 ? (
            filteredTasks.map((task: any) => (
              <TaskCard key={task.id} task={task} />
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">No tasks found matching your criteria</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusTab("all");
                  }}
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
