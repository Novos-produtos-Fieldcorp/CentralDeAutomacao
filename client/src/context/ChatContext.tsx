import React, { createContext, useContext, useState, ReactNode } from 'react';
import FloatingChat from '../components/FloatingChat';
import { fetchWhatsAppPhoto, saveWhatsAppPhoto } from '../utils/whatsappPhotoService';

interface ChatContextType {
  openChat: (phoneNumber: string, name?: string, motoristaId?: number) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>(undefined);
  const [contactName, setContactName] = useState<string | undefined>(undefined);

  const openChat = async (phone: string, name?: string, motoristaId?: number) => {
    setPhoneNumber(phone);
    setContactName(name);
    
    // Buscar e salvar foto do WhatsApp se o motoristaId for fornecido
    if (motoristaId && phone) {
      try {
        const photoUrl = await fetchWhatsAppPhoto(phone);
        if (photoUrl) {
          await saveWhatsAppPhoto(motoristaId, photoUrl);
          console.log(`Foto do WhatsApp salva para motorista ${motoristaId}: ${photoUrl}`);
        }
      } catch (error) {
        console.warn('Erro ao buscar/salvar foto do WhatsApp:', error);
        // Não bloqueia a abertura do chat se falhar
      }
    }
  };

  return (
    <ChatContext.Provider value={{ openChat }}>
      {children}
      <FloatingChat initialPhone={phoneNumber} initialName={contactName} />
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