import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, AlertCircle, Calendar, CheckCircle } from "lucide-react";
import { format } from "date-fns";

// Create severity badge component
const SeverityBadge = ({ level }: { level: string | number }) => {
  let severity: string;
  let classes: string;
  
  if (typeof level === "string") {
    severity = level;
  } else {
    // Convert numeric level to string
    severity = level === 0 ? "high" : level === 1 ? "medium" : "low";
  }
  
  switch (severity) {
    case "high":
      classes = "bg-red-100 text-red-800";
      break;
    case "medium":
      classes = "bg-yellow-100 text-yellow-800";
      break;
    case "low":
      classes = "bg-blue-100 text-blue-800";
      break;
    default:
      classes = "bg-gray-100 text-gray-800";
  }
  
  return (
    <Badge variant="outline" className={classes}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
};

export default function AlertsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [resolvedFilter, setResolvedFilter] = useState("unresolved");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["/api/alerts", severityFilter, resolvedFilter],
  });
  
  // Filter alerts based on search query
  const filteredAlerts = alerts?.filter((alert: any) => 
    alert.errorMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (alert.robotId && alert.robotId.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (alert.errorCode && alert.errorCode.toString().includes(searchQuery))
  );
  
  // Resolve alert mutation
  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      return await apiRequest("POST", `/api/alerts/${alertId}/resolve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert resolved",
        description: "The alert has been marked as resolved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to resolve alert: ${error}`,
        variant: "destructive",
      });
    },
  });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd MMM yyyy HH:mm");
  };
  
  // Handle resolve button click
  const handleResolve = (alertId: number) => {
    resolveAlertMutation.mutate(alertId);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Alerts</h1>
        <p className="text-sm text-gray-600 mt-1">Monitor and manage system alerts</p>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                type="text" 
                placeholder="Search alerts..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select 
                value={severityFilter}
                onValueChange={setSeverityFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span>Severity</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={resolvedFilter}
                onValueChange={setResolvedFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    <span>Status</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unresolved">Unresolved</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
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
          ) : filteredAlerts && filteredAlerts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Error Code</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Robot</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert: any) => (
                  <TableRow key={alert.id}>
                    <TableCell>{alert.errorCode}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{alert.errorMessage}</TableCell>
                    <TableCell>{alert.robotId || "N/A"}</TableCell>
                    <TableCell><SeverityBadge level={alert.errorLevel} /></TableCell>
                    <TableCell>{formatDate(alert.timestamp)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={alert.resolved ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {alert.resolved ? "Resolved" : "Unresolved"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Details</Button>
                      {!alert.resolved && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleResolve(alert.id)}
                          disabled={resolveAlertMutation.isPending}
                        >
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">No alerts found matching your criteria</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setSeverityFilter("all");
                  setResolvedFilter("unresolved");
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
