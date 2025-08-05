import { useChat } from '../context/ChatContext';

export function useFloatingChat() {
  const { openChat } = useChat();
  
  const startChat = (phoneNumber: string, contactName?: string, motoristaId?: number) => {
    openChat(phoneNumber, contactName, motoristaId);
  };
  
  return { startChat };
}