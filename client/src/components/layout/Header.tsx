import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Menu, 
  Search, 
  Bell, 
  HelpCircle,
} from "lucide-react";

interface HeaderProps {
  toggleSidebar: () => void;
}

export default function Header({ toggleSidebar }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 flex items-center justify-between px-4 py-3">
      <div className="flex items-center lg:hidden">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar} 
          className="text-gray-600 hover:text-gray-800"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 bg-gray-100 focus:bg-white"
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-800">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-800">
          <HelpCircle className="h-5 w-5" />
        </Button>
        <div className="flex items-center">
          <Avatar className="h-8 w-8 bg-primary-600 mr-2">
            <AvatarFallback className="text-sm font-medium text-white">JD</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-gray-700 hidden md:block">John Doe</span>
        </div>
      </div>
    </header>
  );
}
