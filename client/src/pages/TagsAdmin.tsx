import React from 'react';
import { useAuth } from '../context/AuthContext';
import { TagManager } from '../components/TagManager';

const TagsAdmin = () => {
  const { companyId } = useAuth();

  if (!companyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Administração de Tags</h1>
        <p className="text-gray-600">
          Gerencie as tags que podem ser associadas aos motoristas para categorização e filtros.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <TagManager companyId={companyId} />
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-800 font-medium mb-2">Como usar as tags:</h3>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Crie tags para categorizar seus motoristas (ex: "Experiente", "Novo", "VIP")</li>
          <li>• Personalize as cores das tags para facilitar a identificação visual</li>
          <li>• As tags podem ser atribuídas aos motoristas no modal de detalhes</li>
          <li>• Use as tags para filtrar e organizar sua lista de motoristas</li>
        </ul>
      </div>
    </div>
  );
};

export default TagsAdmin;