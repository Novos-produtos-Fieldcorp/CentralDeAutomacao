import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onTokenSaved: (token: string, attendantId: number, attendantName: string, email: string, wiseappAccountId?: string) => void;
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
        .select('wiseapp_acesso_id, email, nome, access_token_wiseapp, id_conta_wiseapp')
        .eq('email', email)
        .single();

      if (selectError && selectError.code !== 'PGRST116') throw selectError;

      if (existing) {
        if (existing.access_token_wiseapp) {
          console.log('✅ Token encontrado para email, usando id_conta_wiseapp:', existing.id_conta_wiseapp);
          onTokenSaved(
            existing.access_token_wiseapp,
            existing.wiseapp_acesso_id,
            existing.nome || 'Atendente',
            email,
            existing.id_conta_wiseapp?.toString()
          );
          onClose();
        } else {
          setRequiresAttendantName(false);
          setStep('tutorial');
        }
      } else {
        setRequiresAttendantName(true);
        console.log('📝 Email não encontrado, precisará do nome do atendente');
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
      console.log('🔐 Validando token com Chatwoot...');
      
      // Tentar validar via endpoint local primeiro (Express em Replit)
      let validationResponse = await fetch('/api/validate-wiseapp-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: token.trim() }),
      }).catch(err => {
        console.warn('⚠️ Endpoint local não disponível:', err.message);
        return null;
      });

      // Se falhar no endpoint local (Netlify), validar diretamente
      if (!validationResponse) {
        console.log('🔄 Tentando validar diretamente com Chatwoot...');
        validationResponse = await fetch('https://chat.wiseapp360.com/api/v1/profile', {
          method: 'GET',
          headers: {
            'api_access_token': token.trim(),
            'Content-Type': 'application/json',
          }
        });
      }

      if (!validationResponse.ok) {
        console.error('❌ Token inválido. Status:', validationResponse.status);
        throw new Error('Token inválido. Por favor, verifique se o token está correto.');
      }

      const validationData = await validationResponse.json();
      console.log('✅ Token válido para usuário:', validationData.userData?.name || validationData.name);
      
      const accountId = localStorage?.getItem('account_id');
      if (!accountId) {
        throw new Error('Account ID não encontrado - acesse via URL com account_id');
      }

      console.log('💾 Salvando token no banco...');
      
      const updateData: any = { 
        access_token_wiseapp: token 
      };
      
      if (attendantName) {
        updateData.nome = attendantName;
      }

      // Tenta atualizar primeiro
      const { error: updateError, count } = await supabase
        .from('wiseapp_acesso')
        .update(updateData)
        .eq('email', email);

      if (updateError) {
        console.error('Erro ao atualizar:', updateError);
        throw updateError;
      }

      // Se nenhuma linha foi atualizada, faz INSERT
      if (!count || count === 0) {
        console.log('📝 Nenhuma linha atualizada, inserindo novo registro');
        const insertData: any = { 
          email, 
          id_conta_wiseapp: parseInt(accountId), 
          access_token_wiseapp: token 
        };
        
        if (attendantName) {
          insertData.nome = attendantName;
        }

        const { error: insertError } = await supabase
          .from('wiseapp_acesso')
          .insert([insertData]);

        if (insertError) {
          console.error('Erro ao inserir:', insertError);
          throw insertError;
        }
      }

      console.log('✅ Token salvo com sucesso');

      const { data: userList, error: fetchError } = await supabase
        .from('wiseapp_acesso')
        .select('wiseapp_acesso_id, nome, id_conta_wiseapp')
        .eq('email', email)
        .order('wiseapp_acesso_id', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      
      const updatedUser = userList && userList.length > 0 ? userList[0] : null;
      
      if (!updatedUser) {
        throw new Error('Falha ao recuperar dados do usuário');
      }

      console.log('👤 Usuário atualizado:', updatedUser, 'id_conta_wiseapp:', updatedUser.id_conta_wiseapp);

      onTokenSaved(
        token,
        updatedUser.wiseapp_acesso_id,
        updatedUser.nome || attendantName || 'Atendente',
        email,
        updatedUser.id_conta_wiseapp?.toString() || accountId
      );
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar token:', err);
      
      if (err?.code === '23505') {
        setError('Este email já está registrado. Use um email diferente.');
      } else if (err?.code === '23502') {
        setError('Dados obrigatórios não foram fornecidos.');
      } else {
        setError('Erro ao salvar o token. Tente novamente.');
      }
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
