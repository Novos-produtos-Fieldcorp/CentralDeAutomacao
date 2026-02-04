import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Users, Loader2 } from 'lucide-react';
import { useFloatingChat } from '../hooks/useFloatingChat';
import { useWiseAppAccess } from '../context/WiseAppAccessContext';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import MassMessageModal from './MassMessageModal';
import axios from 'axios';
import { API_BASE_URL } from '../lib/api-config-supabase';

interface MassMessageWithChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  numbers: string[];
  motoristas: any[];
}

const MassMessageWithChatModal: React.FC<MassMessageWithChatModalProps> = ({
  isOpen,
  onClose,
  numbers,
  motoristas,
}) => {
  const { startChat } = useFloatingChat();
  const { token: wiseAppToken } = useWiseAppAccess();
  const { accountId } = useCurrentAccount();
  
  const [showMassMessage, setShowMassMessage] = useState(false);
  const [showInboxSelector, setShowInboxSelector] = useState(false);
  const [availableInboxes, setAvailableInboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar inboxes (copiada do FloatingChat)
  const fetchInboxes = async (accountId: string, apiKey: string) => {
    try {
      const api = axios.create({
        baseURL: API_BASE_URL,
        headers: {
          api_access_token: apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const response = await api.get(`/v1/accounts/${accountId}/inboxes`);
      
      if (response.data && response.data.payload && response.data.payload.length > 0) {
        const allInboxes = response.data.payload.map((inbox: any) => ({
          ...inbox,
          isOpen: true, // ou lógica de horário se quiser
        }));
        setAvailableInboxes(allInboxes);
        setShowInboxSelector(true);
        setError(null);
      } else {
        setAvailableInboxes([]);
        setError('Nenhuma caixa de entrada encontrada');
      }
    } catch (error) {
      console.error('Erro ao buscar inboxes:', error);
      setError('Erro ao carregar caixas de entrada');
    }
  };

  // Função para lidar com seleção de inbox
  const handleInboxSelection = async (inboxId: number) => {
    try {
      setLoading(true);
      setShowInboxSelector(false);
      
      // Aqui você pode implementar a lógica para usar o inbox selecionado
      // Por enquanto, apenas fecha o seletor e abre o MassMessageModal
      setShowMassMessage(true);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao selecionar inbox:', error);
      setError('Erro ao selecionar caixa de entrada');
      setLoading(false);
    }
  };

  // Função para formatar horários de funcionamento
  const formatWorkingHours = (workingHours: any[]) => {
    if (!workingHours || workingHours.length === 0) return 'Não especificado';
    
    return workingHours.map(wh => 
      `${wh.day_of_week}: ${wh.open_hour} - ${wh.close_hour}`
    ).join(', ');
  };

  // Função modificada para mensagem em massa
  const handleMassMessageClick = async () => {
    if (!accountId || !wiseAppToken) {
      setError('Configuração de acesso não encontrada');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      await fetchInboxes(accountId, wiseAppToken);
    } catch (error) {
      console.error('Erro ao carregar inboxes:', error);
      setError('Erro ao carregar caixas de entrada');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Escolha o tipo de mensagem
              </h3>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              {/* Opção 1: Chat Individual */}
              <button
                onClick={() => {
                  if (motoristas.length > 0) {
                    const firstMotorista = motoristas[0];
                    startChat(
                      firstMotorista.telefone?.toString() || '',
                      firstMotorista.nome,
                      firstMotorista.motorista_id
                    );
                    onClose();
                  }
                }}
                className="w-full p-4 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      Chat Individual
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Iniciar conversa individual com o primeiro motorista selecionado
                    </div>
                  </div>
                </div>
              </button>

              {/* Opção 2: Mensagem em Massa */}
              <button
                onClick={handleMassMessageClick}
                disabled={loading}
                className="w-full p-4 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  {loading ? (
                    <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                  ) : (
                    <Users className="w-5 h-5 text-green-600" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      Mensagem em Massa
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Enviar mensagem para todos os motoristas selecionados
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Inbox */}
      {showInboxSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Selecione uma Caixa de Entrada
              </h3>
              <button
                onClick={() => setShowInboxSelector(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {availableInboxes.map((inbox) => (
                <button
                  key={inbox.id}
                  onClick={() => handleInboxSelection(inbox.id)}
                  className="w-full p-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {inbox.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {inbox.isOpen ? (
                        <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          Aberto
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          Fechado
                        </span>
                      )}
                    </div>
                  </div>
                  {!inbox.isOpen &&
                    inbox.working_hours &&
                    inbox.working_hours.length > 0 && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Horário de funcionamento:{" "}
                        {formatWorkingHours(inbox.working_hours)}
                      </div>
                    )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mensagem em Massa */}
      <MassMessageModal
        isOpen={showMassMessage}
        onClose={() => setShowMassMessage(false)}
        numbers={numbers}
      />
    </>
  );
};

export default MassMessageWithChatModal;