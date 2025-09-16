import { ReactNode } from 'react';
import Navbar from './Navbar';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';

interface SidebarLayoutProps {
  children: ReactNode;
}

const SidebarLayoutContent = ({ children }: SidebarLayoutProps) => {
  const { isExpanded, setIsExpanded } = useSidebar();

  return (
    <div className="min-h-screen bg-background relative theme-transition">
      <Navbar onToggle={setIsExpanded} />
      <main 
        className={`relative transition-all duration-500 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden
                    ${isExpanded ? 'ml-64' : 'ml-20'}`}
      >
        <div className="max-w-[2000px] mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  return (
    <SidebarProvider>
      <SidebarLayoutContent>{children}</SidebarLayoutContent>
    </SidebarProvider>
  );
};

export default SidebarLayout;