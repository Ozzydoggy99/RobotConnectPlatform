import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

// Auth check component
const AuthCheck = ({ children }: { children: React.ReactNode }) => {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('auth');
    if (!auth) {
      setLocation('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [setLocation]);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  
  // Fetch tasks
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['/api/tasks'],
    retry: false,
  });

  const handleLogout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('username');
    setLocation('/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'queued':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <AuthCheck>
      <div className="min-h-screen bg-gray-900 text-gray-100">
        <header className="bg-black/30 border-b border-gray-800">
          <div className="container mx-auto py-4 px-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-green-500">
              SKYTECH AUTOMATED
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">
                {localStorage.getItem('username')}
              </span>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="border-gray-700 hover:bg-gray-800"
              >
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto py-8 px-4">
          <Card className="bg-gray-800 border-gray-700 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Task Management</CardTitle>
              <CardDescription className="text-gray-400">
                View and manage robot tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-32 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700 hover:bg-gray-700/50">
                        <TableHead className="text-gray-300">Task ID</TableHead>
                        <TableHead className="text-gray-300">Created At</TableHead>
                        <TableHead className="text-gray-300">Type</TableHead>
                        <TableHead className="text-gray-300">Status</TableHead>
                        <TableHead className="text-gray-300">Robot</TableHead>
                        <TableHead className="text-gray-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks && tasks.length > 0 ? (
                        tasks.map((task: any) => (
                          <TableRow key={task.id} className="border-gray-700 hover:bg-gray-700/50">
                            <TableCell className="font-mono text-gray-300">{task.taskId}</TableCell>
                            <TableCell>{task.createdAt ? format(new Date(task.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-green-500 text-green-500">
                                {task.taskType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getStatusColor(task.status)}`}>
                                {task.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{task.robotId || 'Unassigned'}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="h-8 border-gray-600 hover:bg-gray-700">
                                  View
                                </Button>
                                {task.status === 'queued' && (
                                  <Button size="sm" variant="destructive" className="h-8">
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                            No tasks found. Create a new task to get started.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthCheck>
  );
}