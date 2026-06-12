import React from 'react';
import { Link } from 'react-router-dom';

type Doc = {
  id: number;
  arquivo: string;
  canal: string;
  tipo: string;
  status: 'integrado' | 'pendente_revisao';
  confianca: number;
  alertas: string;
};

const MOCK: Doc[] = [
  { id: 1, arquivo: 'JZ447-2_2026.pdf', canal: 'email', tipo: 'autorizacao', status: 'integrado', confianca: 0.94, alertas: '—' },
  { id: 2, arquivo: 'LM404-3.2026 - RAFAEL SOARES.pdf', canal: 'email', tipo: 'demonstrativo', status: 'integrado', confianca: 0.91, alertas: '—' },
  { id: 3, arquivo: 'WhatsApp Image 2026-05-05 at 11.13.30.jpeg', canal: 'whatsapp', tipo: 'autorizacao', status: 'pendente_revisao', confianca: 0.62, alertas: 'OCR de baixa confiança, campo valor_do_frete ausente' },
  { id: 4, arquivo: 'QPR1A23_2026.pdf', canal: 'email', tipo: 'autorizacao', status: 'pendente_revisao', confianca: 0.78, alertas: 'Placa não encontrada' },
  { id: 5, arquivo: 'demo_RKT5B89.pdf', canal: 'email', tipo: 'demonstrativo', status: 'pendente_revisao', confianca: 0.83, alertas: 'Total KM em branco' },
  { id: 6, arquivo: 'SBV7C12_autorizacao.pdf', canal: 'email', tipo: 'autorizacao', status: 'integrado', confianca: 0.96, alertas: '—' },
];

const statusBadge = (s: Doc['status']) => {
  if (s === 'integrado')
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        integrado
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      pendente_revisao
    </span>
  );
};

const JpdDocumentos = () => {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
          Fila operacional
        </p>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Documentos recebidos</h2>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Arquivo</th>
              <th className="px-3 py-2 text-left">Canal</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Confiança</th>
              <th className="px-3 py-2 text-left">Alertas</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 dark:text-gray-200">
            {MOCK.map((d) => (
              <tr key={d.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2">{d.id}</td>
                <td className="px-3 py-2">{d.arquivo}</td>
                <td className="px-3 py-2">{d.canal}</td>
                <td className="px-3 py-2">{d.tipo}</td>
                <td className="px-3 py-2">{statusBadge(d.status)}</td>
                <td className="px-3 py-2">{d.confianca.toFixed(2)}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{d.alertas}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to={`/jpd-transportes/revisao/${d.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JpdDocumentos;
