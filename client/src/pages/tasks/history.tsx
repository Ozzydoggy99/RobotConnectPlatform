import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Search, Filter, Calendar, Download } from "lucide-react";
import { format } from "date-fns";

const StatusBadge = ({ status }: { status: string }) => {
  const badgeVariants: Record<string, any> = {
    "in_progress": { className: "bg-blue-100 text-blue-800", label: "In Progress" },
    "pending": { className: "bg-gray-100 text-gray-800", label: "Pending" },
    "paused": { className: "bg-yellow-100 text-yellow-800", label: "Paused" },
    "failed": { className: "bg-red-100 text-red-800", label: "Failed" },
    "completed": { className: "bg-green-100 text-green-800", label: "Completed" },
    "cancelled": { className: "bg-orange-100 text-orange-800", label: "Cancelled" },
  };
  
  const variant = badgeVariants[status] || badgeVariants.pending;
  
  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
};

export default function TaskHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<{ from: Date, to: Date } | null>(null);
  
  const { data: taskHistory, isLoading } = useQuery({
    queryKey: ["/api/tasks/history", statusFilter, dateRange],
  });
  
  // Filter tasks based on search query
  const filteredTasks = taskHistory?.filter((task: any) => 
    task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.robotId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (task.robotName && task.robotName.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  // Format task type for display
  const formatTaskType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd MMM yyyy HH:mm");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Task History</h1>
        <p className="text-sm text-gray-600 mt-1">View and analyze completed and historical tasks</p>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                type="text" 
                placeholder="Search tasks..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select 
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <span>Status</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              
              <DateRangePicker />
              
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : filteredTasks && filteredTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Robot</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task: any) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>{task.robotName || task.robotId}</TableCell>
                    <TableCell>{formatTaskType(task.taskType)}</TableCell>
                    <TableCell><StatusBadge status={task.status} /></TableCell>
                    <TableCell>{formatDate(task.startedAt)}</TableCell>
                    <TableCell>{formatDate(task.completedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Details</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">No task history found matching your criteria</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setDateRange(null);
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
