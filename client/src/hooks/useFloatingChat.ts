import { useChat } from '../context/ChatContext';

export function useFloatingChat() {
  const { openChat } = useChat();
  
  const startChat = (phoneNumber: string, contactName?: string) => {
    openChat(phoneNumber, contactName);
  };
  
  return { startChat };
}