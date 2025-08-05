import React, { createContext, useContext, useState, ReactNode } from 'react';
import FloatingChat from '../components/FloatingChat';

interface ChatContextType {
  openChat: (phoneNumber: string, name?: string, motoristaId?: number) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>(undefined);
  const [contactName, setContactName] = useState<string | undefined>(undefined);
  const [motoristaId, setMotoristaId] = useState<number | undefined>(undefined);

  const openChat = async (phone: string, name?: string, motoristaId?: number) => {
    setPhoneNumber(phone);
    setContactName(name);
    setMotoristaId(motoristaId);
    
    // Agora a captura da foto será feita automaticamente pelo FloatingChat
    // quando ele carregar os dados do contato
    console.log(`📱 Abrindo chat para telefone: ${phone}, motorista ID: ${motoristaId}`);
  };

  return (
    <ChatContext.Provider value={{ openChat }}>
      {children}
      <FloatingChat initialPhone={phoneNumber} initialName={contactName} motoristaId={motoristaId} />
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}