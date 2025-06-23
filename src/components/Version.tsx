import React from 'react';

const Version: React.FC = () => {
  const VERSION = 'v1.1.6';

  return (
    <div className="fixed bottom-1 right-2 text-[10px] text-gray-400 dark:text-gray-500 font-mono z-[9999]">
      {VERSION}
    </div>
  );
};

export default Version; 