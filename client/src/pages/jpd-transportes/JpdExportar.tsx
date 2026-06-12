import React, { useState } from 'react';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import { Download } from 'lucide-react';

const JpdExportar = () => {
  const { companyId } = useCurrentAccount();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handleDownload = () => {
    const url = new URL('/api/jpd/export.xlsx', window.location.origin);
    url.searchParams.set('company_id', String(companyId));
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);
    window.location.href = url.toString();
  };

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Baixe um arquivo Excel consolidado com todos os fretes aprovados no período selecionado.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white" />
        </div>
      </div>
      <button onClick={handleDownload}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
        <Download className="w-4 h-4" /> Baixar Excel
      </button>
    </div>
  );
};

export default JpdExportar;
