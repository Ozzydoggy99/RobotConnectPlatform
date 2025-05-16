import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // For now, hardcode the credentials
    // In a real app, this would be an API call
    if (username === 'Ozzydog' && password === 'Ozzydog') {
      // Store auth token in localStorage
      localStorage.setItem('auth', 'true');
      localStorage.setItem('username', username);
      
      setIsLoading(false);
      toast({
        title: 'Login successful',
        description: 'Welcome to SKYTECH AUTOMATED',
      });
      
      // Navigate to dashboard
      setLocation('/dashboard');
    } else {
      setIsLoading(false);
      toast({
        title: 'Login failed',
        description: 'Invalid username or password',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-green-500 pb-2">
            SKYTECH AUTOMATED
          </h1>
        </div>
        
        <Card className="border-gray-700 bg-black/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-gray-200">Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">User:</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-gray-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Password:</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-gray-200"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="text-center text-gray-500 text-sm">
            All Knowing Admin Portal
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}