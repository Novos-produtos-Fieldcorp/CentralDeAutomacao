import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock } from 'lucide-react';
import { createApiUrl } from '@/lib/api-config-supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  onTokenSaved: (token: string, attendantId: number, attendantName: string) => void;
  companyId: number | null;
  isDismissible?: boolean;
}

export default function WiseAppTokenModal({ 
  open, 
  onClose, 
  onTokenSaved, 
  companyId,
  isDismissible = true
}: Props) {
  const [step, setStep] = useState<'email' | 'tutorial' | 'token'>('email');
  const [requiresAttendantName, setRequiresAttendantName] = useState(false);
  const [email, setEmail] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailSubmit = async () => {
    setLoading(true);
    setError('');
    setRequiresAttendantName(false);

    if (!email) {
      setError('Email é obrigatório.');
      setLoading(false);
      return;
    }

    try {
      const { data: existing, error: selectError } = await supabase
        .from('wiseapp_acesso')
        .select('wiseapp_acesso_id, email, nome, access_token_wiseapp')
        .eq('email', email)
        .single();

      if (selectError && selectError.code !== 'PGRST116') throw selectError;

      if (existing) {
        if (existing.access_token_wiseapp) {
          onTokenSaved(
            existing.access_token_wiseapp,
            existing.wiseapp_acesso_id,
            existing.nome || 'Atendente'
          );
          onClose();
        } else {
          setRequiresAttendantName(false);
          setStep('tutorial');
        }
      } else {
        setRequiresAttendantName(true);
        
        let accountId;
        try {
          accountId = localStorage?.getItem('account_id');
          console.log('🔍 Account ID do localStorage:', accountId);
        } catch (err) {
          console.error('Erro ao acessar localStorage:', err);
          throw new Error('Account ID não encontrado - acesse via URL com account_id');
        }

        if (!accountId) {
          console.error('❌ Account ID está vazio ou null');
          throw new Error('Account ID não encontrado. Por favor, acesse o sistema via URL com account_id.');
        }

        const accountIdNum = Number(accountId);
        console.log('📝 Tentando inserir registro com:', { email, id_conta_wiseapp: accountIdNum });

        const { error: insertError } = await supabase
          .from('wiseapp_acesso')
          .insert([{ email, id_conta_wiseapp: accountIdNum, access_token_wiseapp: null }]);

        if (insertError) {
          console.error('❌ Erro ao inserir registro:', insertError);
          throw insertError;
        }

        console.log('✅ Registro criado com sucesso');
        setStep('tutorial');
      }
    } catch (err: any) {
      console.error('Erro detalhado:', err);
      
      if (err?.message?.includes('Account ID')) {
        setError(err.message);
      } else if (err?.code === '23502') {
        setError('Dados obrigatórios não foram fornecidos. Verifique se o account_id está configurado.');
      } else {
        setError('Erro ao verificar/criar acesso. Tente novamente.');
      }
      
      setRequiresAttendantName(false);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSubmit = async () => {
    setLoading(true);
    setError('');

    if (!email || !token) {
      setError('Token ou e-mail inválido.');
      setLoading(false);
      return;
    }

    if (requiresAttendantName && !attendantName) {
      setError('Nome do atendente é obrigatório.');
      setLoading(false);
      return;
    }

    try {
      console.log('🔐 Validando token...');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
      const validationUrl = `${supabaseUrl}/functions/v1/validate-wiseapp-token`;
      
      console.log('🌍 Ambiente:', window.location.hostname);
      console.log('🔗 URL de validação:', validationUrl);
      
      const validationResponse = await fetch(validationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const validationData = await validationResponse.json();

      if (!validationResponse.ok || !validationData.valid) {
        if (validationResponse.status === 401) {
          throw new Error('Token inválido. Por favor, verifique se copiou o token corretamente.');
        }
        throw new Error('Não foi possível validar o token. Tente novamente.');
      }

      const userData = validationData.userData;
      console.log('✅ Token válido:', userData);

      const accountId = localStorage?.getItem('account_id');
      if (!accountId) {
        throw new Error('Account ID não encontrado - acesse via URL com account_id');
      }

      if (requiresAttendantName) {
        const { error: insertError } = await supabase
          .from('wiseapp_acesso')
          .insert([{ 
            email, 
            nome: attendantName, 
            id_conta_wiseapp: parseInt(accountId), 
            access_token_wiseapp: token 
          }]);

        if (insertError) throw insertError;
      } else {
        const updateData: any = { access_token_wiseapp: token };
        if (attendantName) {
          updateData.nome = attendantName;
        }

        const { error: updateError } = await supabase
          .from('wiseapp_acesso')
          .update(updateData)
          .eq('email', email);

        if (updateError) throw updateError;
      }

      const { data: updatedUser, error: fetchError } = await supabase
        .from('wiseapp_acesso')
        .select('wiseapp_acesso_id, nome')
        .eq('email', email)
        .single();

      if (fetchError) throw fetchError;

      onTokenSaved(
        token,
        updatedUser.wiseapp_acesso_id,
        updatedUser.nome || attendantName || 'Atendente'
      );
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar token:', err);
      
      if (err.message.includes('Token inválido')) {
        setError(err.message);
      } else if (err.message.includes('validar')) {
        setError(err.message);
      } else {
        setError('Erro ao salvar o token. Tente novamente.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && step === 'email') {
      setRequiresAttendantName(false);
      setAttendantName('');
    }
  }, [open, step]);

  if (!open) return null;

  return (
   <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" data-modal="wiseapp-token">
     <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-xl max-w-2xl w-full space-y-5 relative">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold flex-1">
            {step === 'email' && 'Autenticação WiseApp'}
            {step === 'tutorial' && 'Como obter o Token da WiseApp'}
            {step === 'token' && 'Cole seu Token abaixo'}
          </h2>
          {isDismissible && (
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
              aria-label="Fechar"
            >
              ✕
            </button>
          )}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
       
       {step === 'email' && (
     <div className="flex flex-col items-center text-center space-y-6">
       <div className="flex flex-col items-center space-y-2 max-w-sm">
         <Lock className="w-10 h-10 text-blue-600 dark:text-blue-400" />

         <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
           Autenticação de Segurança
         </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Para acessar a Central de Automações, informe seu e-mail corporativo. 
        Se já houver um token associado, ele será utilizado automaticamente.
        Caso contrário, guiaremos você para registrar o token.
      </p>
    </div>

    <div className="w-full max-w-sm space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-left text-sm font-medium text-gray-700 dark:text-gray-300">
          E-mail corporativo
        </label>
        <input
          id="email"
          type="email"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-700 dark:text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seuemail@empresa.com"
          autoFocus
          data-testid="input-email"
        />
      </div>
      
    </div>

    <button
      onClick={handleEmailSubmit}
      className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      disabled={loading || !email}
      data-testid="button-verify-email"
    >
      {loading ? 'Verificando...' : 'Verificar'}
    </button>
  </div>
)}

      {step === 'tutorial' && (
  <div className="space-y-4 text-sm text-gray-800 dark:text-gray-200">
    <ol className="list-decimal list-inside space-y-2">
      <li>
        Acesse o site:{" "}
        <a
          href="https://chat.wiseapp360.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline"
        >
          chat.wiseapp360.com
        </a>
      </li>
      <li>
        Vá em <strong>Configurações de Perfil</strong> e localize a seção <strong>Token de Acesso</strong>
      </li>
      <li>
        Copie o token e cole no campo solicitado na próxima etapa
      </li>
    </ol>

    <div className="w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
      <img 
        src="https://ohmoxsvwjvohmqqgxjhb.supabase.co/storage/v1/object/public/imagensdocs//Tutorial.gif" 
        alt="Tutorial WiseApp" 
        className="w-full h-auto rounded-lg"
      />
    </div>

    <div className="flex justify-between mt-4">
      <button 
        onClick={() => setStep('email')} 
        className="text-sm text-gray-500"
        data-testid="button-back"
      >
        Voltar
      </button>
      <button
        onClick={() => setStep('token')}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        data-testid="button-have-token"
      >
        Já tenho o Token
      </button>
    </div>
  </div>
)}

        {step === 'token' && (
          <div className="space-y-4">
            {requiresAttendantName && (
              <div className="space-y-2">
                <label htmlFor="tokenAttendantName" className="block text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nome do Atendente
                </label>
                <input
                  id="tokenAttendantName"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                  value={attendantName}
                  onChange={(e) => setAttendantName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  data-testid="input-attendant-name"
                  autoFocus
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="tokenInput" className="block text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                Token de Acesso WiseApp
              </label>
              <input
                id="tokenInput"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Cole seu access_token da WiseApp aqui"
                data-testid="input-token"
                autoFocus={!requiresAttendantName}
              />
            </div>
            
            <div className="flex justify-between gap-2">
              <button
                onClick={handleTokenSubmit}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading || !token || (requiresAttendantName && !attendantName)}
                data-testid="button-save-token"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
