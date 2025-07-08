import React, { useState, useEffect } from 'react';
import { X, User, Plus, Edit3, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Motorista {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  cnh: string;
  categoria_cnh: string;
  vencimento_cnh: string;
  empresa_id: string;
  created_at: string;
  updated_at: string;
}

interface UnifiedMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista?: Motorista | null;
  onSuccess: () => void;
}

const UnifiedMotoristaModal = ({ 
  isOpen, 
  onClose, 
  motorista, 
  onSuccess 
}: UnifiedMotoristaModalProps) => {
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    cnh: '',
    categoria_cnh: '',
    vencimento_cnh: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!motorista;

  useEffect(() => {
    if (isOpen) {
      if (motorista) {
        setFormData({
          nome: motorista.nome || '',
          cpf: motorista.cpf || '',
          telefone: motorista.telefone || '',
          email: motorista.email || '',
          cnh: motorista.cnh || '',
          categoria_cnh: motorista.categoria_cnh || '',
          vencimento_cnh: motorista.vencimento_cnh || ''
        });
      } else {
        setFormData({
          nome: '',
          cpf: '',
          telefone: '',
          email: '',
          cnh: '',
          categoria_cnh: '',
          vencimento_cnh: ''
        });
      }
      setError('');
    }
  }, [isOpen, motorista]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', user.id)
        .single();

      if (!profile?.empresa_id) throw new Error('Empresa não encontrada');

      const motoristaData = {
        ...formData,
        empresa_id: profile.empresa_id
      };

      if (isEditing) {
        const { error } = await supabase
          .from('motoristas')
          .update(motoristaData)
          .eq('id', motorista.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('motoristas')
          .insert([motoristaData]);

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.message || 'Erro ao salvar motorista');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Editar Motorista' : 'Adicionar Motorista'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              id="nome"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Digite o nome completo"
            />
          </div>

          <div>
            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
              CPF *
            </label>
            <input
              type="text"
              id="cpf"
              name="cpf"
              value={formData.cpf}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-1">
              Telefone
            </label>
            <input
              type="tel"
              id="telefone"
              name="telefone"
              value={formData.telefone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label htmlFor="cnh" className="block text-sm font-medium text-gray-700 mb-1">
              CNH *
            </label>
            <input
              type="text"
              id="cnh"
              name="cnh"
              value={formData.cnh}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Digite o número da CNH"
            />
          </div>

          <div>
            <label htmlFor="categoria_cnh" className="block text-sm font-medium text-gray-700 mb-1">
              Categoria CNH *
            </label>
            <select
              id="categoria_cnh"
              name="categoria_cnh"
              value={formData.categoria_cnh}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione a categoria</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="E">E</option>
              <option value="AB">AB</option>
              <option value="AC">AC</option>
              <option value="AD">AD</option>
              <option value="AE">AE</option>
            </select>
          </div>

          <div>
            <label htmlFor="vencimento_cnh" className="block text-sm font-medium text-gray-700 mb-1">
              Vencimento CNH *
            </label>
            <input
              type="date"
              id="vencimento_cnh"
              name="vencimento_cnh"
              value={formData.vencimento_cnh}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isEditing ? (
                <Edit3 className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Adicionar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UnifiedMotoristaModal;