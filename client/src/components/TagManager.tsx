import React from "react";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";
import { TagAdministration } from './TagAdministration';

interface TagManagerProps {
  companyId: number;
}

export function TagManager({ companyId }: TagManagerProps) {
  const { accountId } = useWiseAppAccess();

  if (accountId === undefined || accountId === null) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">Aguardando autenticação WiseApp...</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Por favor, faça login com seu e-mail para continuar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TagAdministration companyId={companyId} />
    </div>
  );
}
