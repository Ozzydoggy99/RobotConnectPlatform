import { cva } from "class-variance-authority";
import { Battery, Wifi, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const statusStyles = cva("rounded-full w-3 h-3", {
  variants: {
    status: {
      online: "bg-green-500",
      offline: "bg-gray-500",
      error: "bg-red-500",
      warning: "bg-yellow-500",
      charging: "bg-blue-500",
      busy: "bg-purple-500",
    },
  },
  defaultVariants: {
    status: "offline",
  },
});

const statusNames = {
  online: "Online",
  offline: "Offline",
  error: "Error",
  warning: "Warning",
  charging: "Charging",
  busy: "Busy",
};

export interface RobotStatusCardProps {
  robotId: string;
  name: string;
  status: string;
  batteryLevel: number | null;
  lastSeen: string | null;
  floor?: string | null;
  error?: string | null;
  errorDetails?: {
    code: number;
    message: string;
    type?: number;
    level?: number;
    priority?: boolean;
  } | null;
  onClick?: () => void;
}

export function RobotStatusCard({
  robotId,
  name,
  status,
  batteryLevel,
  lastSeen,
  floor,
  error,
  errorDetails,
  onClick,
}: RobotStatusCardProps) {
  const formattedLastSeen = lastSeen ? new Date(lastSeen).toLocaleString() : "Never";
  const battery = batteryLevel ?? 0;
  
  return (
    <Card 
      className="w-full cursor-pointer transition-all hover:shadow-md" 
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg md:text-xl mb-1">{name}</CardTitle>
            <CardDescription className="text-xs md:text-sm opacity-70">
              ID: {robotId}
              {floor && <> • Floor: {floor}</>}
            </CardDescription>
          </div>
          <Badge 
            variant={status === "error" || status === "warning" ? "destructive" : "outline"}
            className="ml-2 flex items-center gap-1.5"
          >
            <span className={statusStyles({ status: status as any })}></span>
            <span>{statusNames[status as keyof typeof statusNames] || status}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Wifi className="h-3 w-3" /> Last Seen
            </span>
            <span className="text-sm font-medium">{formattedLastSeen}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Battery className="h-3 w-3" /> Battery
            </span>
            <Progress value={battery} className="h-2 w-full" />
            <span className="text-xs font-medium mt-1">{battery}%</span>
          </div>
        </div>
        
        {error && (
          <>
            <Separator className="my-3" />
            <div className="bg-red-50 dark:bg-red-950/20 rounded-md p-2 text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium">{error}</p>
                {errorDetails && (
                  <p className="mt-1 opacity-80">{errorDetails.message}</p>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}