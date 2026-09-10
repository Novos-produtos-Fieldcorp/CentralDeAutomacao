import React, { useCallback, useEffect, useState } from 'react';
import { UserCog, Plus, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { BaseModal } from '../../components/BaseModal';
import { dionizioApi } from './api';
import { fmtDate } from './format';

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const MotoristaForm: React.FC<{ isOpen: boolean; onClose: () => void; onSaved: () => void; registro?: any | null }> = ({ isOpen, onClose, onSaved, registro }) => {
  const [form, setForm] = useState<any>(
    registro || { nome: '', cpf: '', cnh: '', cnh_validade: '', telefone: '', status: 'ativo' },
  );
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.nome) {
      toast.error('Nome obrigatório');
      return;
    }
    setSalvando(true);
    try {
      if (registro?.id) await dionizioApi.put(`/motoristas/${registro.id}`, form);
      else await dionizioApi.post('/motoristas', form);
      toast.success('Motorista salvo com sucesso');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar motorista');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={registro ? 'Editar Motorista' : 'Novo Motorista'} size="md">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Nome *</label>
          <input className={inputCls} value={form.nome} onChange={(e) => set('nome', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>CPF</label>
            <input className={inputCls} value={form.cpf} onChange={(e) => set('cpf', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input className={inputCls} value={form.telefone} onChange={(e) => set('telefone', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>CNH</label>
            <input className={inputCls} value={form.cnh} onChange={(e) => set('cnh', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Validade da CNH</label>
            <input type="date" className={inputCls} value={form.cnh_validade} onChange={(e) => set('cnh_validade', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} className="px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60">
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

const DionizioMotoristas = () => {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRegistros(await dionizioApi.get('/motoristas'));
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const excluir = async (id: number) => {
    if (!confirm('Excluir este motorista?')) return;
    try {
      await dionizioApi.del(`/motoristas/${id}`);
      toast.success('Excluído com sucesso');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <UserCog className="w-5 h-5 text-blue-600" /> Motoristas
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cadastro de motoristas da frota</p>
        </div>
        <button
          onClick={() => {
            setEditando(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
        >
          <Plus className="w-4 h-4" /> Novo Motorista
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Nome', 'CPF', 'CNH', 'Validade CNH', 'Telefone', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : registros.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  Nenhum motorista cadastrado
                </td>
              </tr>
            ) : (
              registros.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium">{r.nome}</td>
                  <td className="px-4 py-3">{r.cpf || '—'}</td>
                  <td className="px-4 py-3">{r.cnh || '—'}</td>
                  <td className="px-4 py-3">{fmtDate(r.cnh_validade)}</td>
                  <td className="px-4 py-3">{r.telefone || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        r.status === 'ativo'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {r.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditando(r);
                        setShowForm(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => excluir(r.id)} className="text-red-600 hover:text-red-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && <MotoristaForm isOpen={showForm} onClose={() => setShowForm(false)} onSaved={load} registro={editando} />}
    </div>
  );
};

export default DionizioMotoristas;
