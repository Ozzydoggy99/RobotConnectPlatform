import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface SidebarLinkProps {
  href: string;
  icon: string;
  label: string;
  badgeCount?: number;
}

const SidebarLink = ({ href, icon, label, badgeCount }: SidebarLinkProps) => {
  const [location] = useLocation();
  const isActive = location === href;

  return (
    <Link href={href}>
      <a
        className={cn(
          "sidebar-link flex items-center px-3 py-2 text-sm rounded-md font-medium hover:bg-gray-100",
          isActive
            ? "bg-primary-50 text-primary-600 border-l-3 border-primary-600"
            : "text-gray-700"
        )}
      >
        <span className="material-icons text-sm mr-3">{icon}</span>
        {label}
        {badgeCount !== undefined && (
          <span className="ml-auto bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
            {badgeCount}
          </span>
        )}
      </a>
    </Link>
  );
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section = ({ title, children }: SectionProps) => (
  <div className="py-2">
    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
      {title}
    </h2>
    {children}
  </div>
);

export default function Sidebar() {
  return (
    <aside className="bg-white w-64 border-r border-gray-200 flex-shrink-0 fixed h-full z-20 lg:static lg:h-auto lg:overflow-y-auto hidden lg:block">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-md bg-primary-600 flex items-center justify-center text-white mr-2">
            <span className="material-icons text-sm">smart_toy</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">RobotOS</h1>
        </div>
      </div>
      
      <nav className="p-2">
        <Section title="Dashboard">
          <SidebarLink href="/" icon="dashboard" label="Overview" />
          <SidebarLink href="/robots" icon="device_hub" label="Robots" />
        </Section>
        
        <Section title="Task Management">
          <SidebarLink href="/tasks" icon="assignment" label="Active Tasks" />
          <SidebarLink href="/tasks/history" icon="history" label="Task History" />
          <SidebarLink href="/tasks/create" icon="note_add" label="Create Task" />
        </Section>
        
        <Section title="Configuration">
          <SidebarLink href="/maps" icon="map" label="Maps & POIs" />
          <SidebarLink href="/settings" icon="settings" label="Settings" />
        </Section>
        
        <Section title="Monitoring">
          <SidebarLink href="/alerts" icon="error" label="Alerts" badgeCount={3} />
          <SidebarLink href="/analytics" icon="bar_chart" label="Analytics" />
          <SidebarLink href="/logs" icon="code" label="Logs" />
        </Section>
      </nav>
    </aside>
  );
}
