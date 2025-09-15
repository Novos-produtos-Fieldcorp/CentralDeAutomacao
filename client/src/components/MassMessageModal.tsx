import React, { useState } from 'react';
import { X, Loader2, MessageSquare, WifiOff, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface MassMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  numbers: string[];
}

const MassMessageModal: React.FC<MassMessageModalProps> = ({
  isOpen,
  onClose,
  numbers,
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [networkError, setNetworkError] = useState(false);
  const [showWarning, setShowWarning] = useState(true);

  // Check if we're online
  const checkNetworkStatus = () => {
    return navigator.onLine;
  };

  const sendMessage = async () => {
    if (!message.trim()) {
      toast.error('Por favor, escreva uma mensagem.');
      return;
    }

    if (numbers.length === 0) {
      toast.error('Nenhum número de telefone selecionado.');
      return;
    }

    // Check network status before starting
    if (!checkNetworkStatus()) {
      toast.error(
        'Sem conexão com a internet. Por favor, verifique sua conexão e tente novamente.'
      );
      setNetworkError(true);
      return;
    }

    // Filter out empty numbers
    const validNumbers = numbers.filter((num) => num && num.trim() !== '');

    if (validNumbers.length === 0) {
      toast.error('Nenhum número de telefone válido selecionado.');
      return;
    }

    // Enforce the 100 message limit
    if (validNumbers.length > 100) {
      toast.error('Limite de 100 mensagens por vez para evitar bloqueios do WhatsApp.');
      // Truncate the array to 100 numbers
      validNumbers.splice(100);
    }

    setIsSending(true);
    setProgress({ sent: 0, total: validNumbers.length });
    setNetworkError(false);

    try {
      console.log('Enviando mensagem em massa para:', validNumbers.length, 'números');

      // Use the secure backend endpoint
      const response = await fetch('/api/send-bulk-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numbers: validNumbers,
          message: message.trim()
        }),
      });

      const responseData = await response.json();
      console.log('Resposta do backend:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || `Erro HTTP ${response.status}`);
      }

      if (responseData.success && responseData.summary) {
        const { successful, failed, total } = responseData.summary;
        
        if (failed === 0) {
          toast.success(`${successful} mensagens enviadas com sucesso!`);
        } else {
          toast.success(
            `${successful} mensagens enviadas com sucesso, ${failed} falhas de um total de ${total}.`
          );
          
          // Log failed results for debugging
          if (responseData.summary.results) {
            const failedResults = responseData.summary.results.filter((r: any) => !r.success);
            if (failedResults.length > 0) {
              console.error('Failed message sends:', failedResults);
            }
          }
        }

        // Update progress to show completion
        setProgress({ sent: total, total });
      } else {
        throw new Error('Resposta inválida do servidor');
      }

      onClose();
    } catch (error) {
      console.error('Error sending mass message:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao enviar mensagens: ${errorMessage}`);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        setProgress({ sent: 0, total: 0 });
      }, 2000); // Keep progress visible for 2 seconds
    }
  };

  // Note: Phone number formatting is now handled by the backend

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Enviar Mensagem em Massa
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {networkError && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800/30 flex items-center gap-2">
              <WifiOff className="w-5 h-5 text-red-500 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">
                Sem conexão com a internet. Por favor, verifique sua conexão e
                tente novamente.
              </p>
            </div>
          )}

          {showWarning && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800/30">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Atenção: Uso responsável
                  </p>
                </div>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300 ml-7">
                Ao utilizar o envio de mensagens em massa pelo WhatsApp, o usuário assume total responsabilidade por eventuais bloqueios de número. O WhatsApp possui regras rigorosas quanto a esse tipo de prática. Para reduzir o risco de bloqueio, recomendamos que o conteúdo enviado seja relevante e gere engajamento por parte do destinatário.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="message"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Mensagem
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Digite sua mensagem aqui..."
            />
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>
              {numbers.length} número{numbers.length !== 1 ? 's' : ''} selecionado
              {numbers.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowWarning(!showWarning)}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {showWarning ? 'Ocultar aviso' : 'Mostrar aviso'}
            </button>
          </div>

          {isSending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  Enviando mensagens...
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {progress.sent} de {progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progress.sent / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              onClick={sendMessage}
              disabled={isSending || !message.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" />
                  Enviar Mensagens
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MassMessageModal;