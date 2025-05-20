import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useFloatingChat } from '../hooks/useFloatingChat';

interface ChatButtonProps {
  phoneNumber: string;
  name?: string;
  className?: string;
  children?: React.ReactNode;
}

const ChatButton: React.FC<ChatButtonProps> = ({ phoneNumber, name, className, children }) => {
  const { startChat } = useFloatingChat();
  
  return (
    <button
      onClick={() => startChat(phoneNumber, name)}
      className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
      title="Iniciar chat"
    >
      <MessageCircle size={16} />
    </button>
  );
};

export default ChatButton;