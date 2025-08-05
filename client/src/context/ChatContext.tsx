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
      console.log(`Iniciando captura de foto para motorista ${motoristaId}, telefone: ${phone}`);
      try {
        const photoUrl = await fetchWhatsAppPhoto(phone);
        console.log(`Resultado da busca de foto:`, photoUrl);
        
        if (photoUrl) {
          const success = await saveWhatsAppPhoto(motoristaId, photoUrl);
          if (success) {
            console.log(`✅ Foto do WhatsApp salva com sucesso para motorista ${motoristaId}: ${photoUrl}`);
            // Recarregar a página ou atualizar os dados para refletir a mudança
            window.location.reload();
          } else {
            console.error(`❌ Falha ao salvar foto do WhatsApp para motorista ${motoristaId}`);
          }
        } else {
          console.log(`ℹ️  Nenhuma foto encontrada para o telefone ${phone}`);
        }
      } catch (error) {
        console.warn('❌ Erro ao buscar/salvar foto do WhatsApp:', error);
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