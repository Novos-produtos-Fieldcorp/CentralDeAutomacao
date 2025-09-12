import { useState, ReactNode } from 'react';
import Navbar from './Navbar';

interface SidebarLayoutProps {
  children: ReactNode;
}

const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  return (
    <div className="min-h-screen bg-background relative theme-transition">
      <Navbar onToggle={setSidebarExpanded} />
      <main 
        className={`relative transition-all duration-500 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden
                    ${sidebarExpanded ? 'ml-64' : 'ml-20'}`}
      >
        <div className="max-w-[2000px] mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default SidebarLayout;