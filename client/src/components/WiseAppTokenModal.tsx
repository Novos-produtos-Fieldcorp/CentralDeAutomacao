import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onTokenSaved: (token: string) => void;
  companyId: number | null;
}

export default function WiseAppTokenModal({ open, onClose, onTokenSaved, companyId }: Props) {
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
    setRequiresAttendantName(false); // Reset the flag at start

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
          // Salvar email no localStorage para uso posterior
          localStorage.setItem('wiseapp_user_email', email);
          onTokenSaved(existing.access_token_wiseapp);
          onClose();
        } else {
          // Email exists but no token, go to tutorial without requiring name
          setRequiresAttendantName(false);
          setStep('tutorial');
        }
      } else {
        // Email doesn't exist, require attendant name in token step
        setRequiresAttendantName(true);
        setStep('tutorial');
        // Get account_id from URL or use default for serverless compatibility
        let accountId;
        try {
          accountId = localStorage?.getItem('account_id');
        } catch {
          throw new Error('Account ID não encontrado - acesse via URL com account_id');
        }

        const { data: companyData, error: companyError } = await supabase
          .from('company')
          .select('company_id')
          .eq('id_conta_wiseapp', accountId)
          .single();

        if (companyError || !companyData) {
          throw new Error('Erro ao buscar o companyId ou company não encontrado.');
        }

        const { error: insertError } = await supabase
          .from('wiseapp_acesso')
          .insert([{ email, nome: attendantName, company_id: companyData.company_id, id_conta_wiseapp: accountId, access_token_wiseapp: null }]);

        if (insertError) throw insertError;

        setStep('tutorial');
      }
    } catch (err) {
      setError('Erro ao verificar/criar acesso.');
      setRequiresAttendantName(false); // Reset on error
      console.error(err);
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

    // Se requer nome do atendente mas não foi fornecido
    if (requiresAttendantName && !attendantName) {
      setError('Nome do atendente é obrigatório.');
      setLoading(false);
      return;
    }

    try {
      // Atualizar com nome apenas se foi fornecido ou se é obrigatório
      const updateData: any = { access_token_wiseapp: token };
      if (attendantName || requiresAttendantName) {
        updateData.nome = attendantName;
      }

      const { error: updateError } = await supabase
        .from('wiseapp_acesso')
        .update(updateData)
        .eq('email', email);

      if (updateError) throw updateError;

      // Salvar email no localStorage para uso posterior
      localStorage.setItem('wiseapp_user_email', email);
      onTokenSaved(token);
      onClose();
    } catch (err) {
      setError('Erro ao salvar o token.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Reset requiresAttendantName when modal opens
  useEffect(() => {
    if (open && step === 'email') {
      setRequiresAttendantName(false);
      setAttendantName(''); // Also reset the name
    }
  }, [open, step]);

  if (!open) return null;

  return (
   <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" data-modal="wiseapp-token">
     <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-xl max-w-2xl w-full space-y-5">
        <h2 className="text-xl font-semibold">
          {step === 'email' && 'Autenticação WiseApp'}
          {step === 'tutorial' && 'Como obter o Token da WiseApp'}
          {step === 'token' && 'Cole seu Token abaixo'}
        </h2>

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
        />
      </div>
      
    </div>

    {error && (
      <p className="text-red-500 text-sm">{error}</p>
    )}

    <button
      onClick={handleEmailSubmit}
      className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      disabled={loading || !email}
    >
      Verificar
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
      <button onClick={() => setStep('email')} className="text-sm text-gray-500">Voltar</button>
      <button
        onClick={() => setStep('token')}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
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
              />
            </div>
            
            <div className="flex justify-between gap-2">
              <button
                onClick={handleTokenSubmit}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading || !token || (requiresAttendantName && !attendantName)}
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}