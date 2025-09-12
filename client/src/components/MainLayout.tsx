import { ReactNode } from 'react';
import { useSidebar } from '../context/SidebarContext';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { isExpanded } = useSidebar();

  return (
    <main 
      className={`relative transition-all duration-500 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden
                  ${isExpanded ? 'ml-64' : 'ml-20'}`}
    >
      <div className="max-w-[2000px] mx-auto p-8">
        {children}
      </div>
    </main>
  );
};

export default MainLayout;