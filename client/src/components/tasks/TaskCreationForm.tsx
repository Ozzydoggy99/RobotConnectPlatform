import { useState } from "react";
import { useNavigate } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, PlusCircle, Edit, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Task form schema
const taskFormSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  robotId: z.string().min(1, "Robot is required"),
  taskType: z.string().min(1, "Task type is required"),
  priority: z.string().default("normal"),
  runMode: z.number().default(1),
  runNum: z.number().default(1),
  runType: z.number().optional(),
  routeMode: z.number().default(1),
  speed: z.number().default(-1),
  ignorePublicSite: z.boolean().default(false),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface Point {
  id: string;
  name: string;
  areaId: string;
  floor: string;
  x: number;
  y: number;
  yaw?: number;
  type: string;
}

export default function TaskCreationForm() {
  const [selectedPoints, setSelectedPoints] = useState<Point[]>([]);
  const [returnPoint, setReturnPoint] = useState<Point | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Default form values
  const defaultValues: TaskFormValues = {
    name: "",
    robotId: "",
    taskType: "",
    priority: "normal",
    runMode: 1,
    runNum: 1,
    routeMode: 1,
    speed: -1,
    ignorePublicSite: false,
  };
  
  // Initialize form
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues,
  });
  
  // Fetch robots
  const { data: robots, isLoading: isRobotsLoading } = useQuery({
    queryKey: ["/api/robots"],
  });
  
  // Fetch points
  const { data: points, isLoading: isPointsLoading } = useQuery({
    queryKey: ["/api/pois"],
  });
  
  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (values: TaskFormValues & { points: Point[], returnPoint?: Point | null }) => {
      const response = await apiRequest("POST", "/api/tasks", values);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task created",
        description: "The task has been created successfully.",
      });
      navigate("/tasks");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create task: ${error}`,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (values: TaskFormValues) => {
    if (selectedPoints.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one point to the task.",
        variant: "destructive",
      });
      return;
    }
    
    createTaskMutation.mutate({
      ...values,
      points: selectedPoints,
      returnPoint,
    });
  };
  
  // Handle adding a point
  const handleAddPoint = (point: Point) => {
    setSelectedPoints([...selectedPoints, point]);
  };
  
  // Handle removing a point
  const handleRemovePoint = (index: number) => {
    const newPoints = [...selectedPoints];
    newPoints.splice(index, 1);
    setSelectedPoints(newPoints);
  };
  
  // Handle setting return point
  const handleSetReturnPoint = (point: Point) => {
    setReturnPoint(point);
  };
  
  // Handle clearing return point
  const handleClearReturnPoint = () => {
    setReturnPoint(null);
  };
  
  // Filter charging points
  const chargingPoints = points?.filter((point: Point) => point.type === "charging") || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter task name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="robotId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Robot</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select robot" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isRobotsLoading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : robots?.length > 0 ? (
                      robots.map((robot: any) => (
                        <SelectItem key={robot.robotId} value={robot.robotId}>
                          {robot.name} ({robot.robotId})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-robots" disabled>
                        No robots available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="taskType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task Type</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select task type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="delivery">Restaurant Delivery</SelectItem>
                    <SelectItem value="charging">Charging Return</SelectItem>
                    <SelectItem value="rack_operation">Rack Operation</SelectItem>
                    <SelectItem value="multi_floor">Multi-Floor Delivery</SelectItem>
                    <SelectItem value="patrol">Patrol</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="runMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Run Mode</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(parseInt(value))} 
                  defaultValue={field.value.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select run mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">Flexible Obstacle Avoidance</SelectItem>
                    <SelectItem value="2">Trajectory Driving</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* Task Points Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Task Points</label>
          
          <Card className="mb-4">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Point Sequence</h3>
              
              {selectedPoints.length > 0 ? (
                <div className="space-y-3">
                  {selectedPoints.map((point, index) => (
                    <div key={index} className="flex items-center bg-white p-3 rounded-md border border-gray-200">
                      <span className="flex-shrink-0 mr-3 text-gray-500">{index + 1}</span>
                      <div className="flex-grow">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-800">{point.name}</span>
                          <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800">
                            {point.floor}
                          </Badge>
                        </div>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <span>x: {point.x.toFixed(2)}, y: {point.y.toFixed(2)}{point.yaw !== undefined ? `, yaw: ${point.yaw}°` : ''}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleRemovePoint(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No points added yet
                </div>
              )}
              
              {isPointsLoading ? (
                <Skeleton className="h-10 w-full mt-3" />
              ) : (
                <div className="mt-3">
                  <Select onValueChange={(value) => {
                    const point = points.find((p: Point) => p.id === value);
                    if (point) handleAddPoint(point);
                  }}>
                    <SelectTrigger>
                      <div className="flex items-center">
                        <PlusCircle className="h-4 w-4 mr-1" />
                        <span>Add Point</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {points?.length > 0 ? (
                        points.map((point: Point) => (
                          <SelectItem key={point.id} value={point.id}>
                            {point.name} ({point.floor})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-points" disabled>
                          No points available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Return Point</h3>
              
              {returnPoint ? (
                <div className="flex items-center bg-white p-3 rounded-md border border-gray-200">
                  <div className="flex-grow">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-800">{returnPoint.name}</span>
                      <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">
                        {returnPoint.type === "charging" ? "Charging Station" : returnPoint.floor}
                      </Badge>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <span>x: {returnPoint.x.toFixed(2)}, y: {returnPoint.y.toFixed(2)}{returnPoint.yaw !== undefined ? `, yaw: ${returnPoint.yaw}°` : ''}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={handleClearReturnPoint}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No return point set
                </div>
              )}
              
              {!returnPoint && (
                <div className="mt-3">
                  <Select onValueChange={(value) => {
                    const point = chargingPoints.find((p: Point) => p.id === value);
                    if (point) handleSetReturnPoint(point);
                  }}>
                    <SelectTrigger>
                      <div className="flex items-center">
                        <PlusCircle className="h-4 w-4 mr-1" />
                        <span>Set Return Point</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {chargingPoints?.length > 0 ? (
                        chargingPoints.map((point: Point) => (
                          <SelectItem key={point.id} value={point.id}>
                            {point.name} (Charging)
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-charging" disabled>
                          No charging points available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={() => navigate("/tasks")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createTaskMutation.isPending}
          >
            {createTaskMutation.isPending ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
