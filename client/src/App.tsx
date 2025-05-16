import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Robots from "@/pages/robots";
import TasksIndex from "@/pages/tasks/index";
import TaskCreate from "@/pages/tasks/create";
import TaskHistory from "@/pages/tasks/history";
import Maps from "@/pages/maps";
import Alerts from "@/pages/alerts";
import Login from "@/pages/login";
import Layout from "@/components/layout/Layout";
import { useEffect } from "react";

function ProtectedRoutes() {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    // Check if user is authenticated
    const auth = localStorage.getItem('auth');
    if (!auth && location !== '/login') {
      setLocation('/login');
    }
  }, [location, setLocation]);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/robots" component={Robots} />
        <Route path="/tasks" component={TasksIndex} />
        <Route path="/tasks/create" component={TaskCreate} />
        <Route path="/tasks/history" component={TaskHistory} />
        <Route path="/maps" component={Maps} />
        <Route path="/alerts" component={Alerts} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" exact>
          {() => {
            window.location.href = '/login';
            return null;
          }}
        </Route>
        <Route>
          <ProtectedRoutes />
        </Route>
      </Switch>
    </TooltipProvider>
  );
}

export default App;
