import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

type DocMock = {
  id: number;
  arquivo: string;
  confianca: number;
  alertas: string[];
  raw_text: string;
  fields: Record<string, string>;
};

const MOCK: Record<string, DocMock> = {
  '3': {
    id: 3,
    arquivo: 'WhatsApp Image 2026-05-05 at 11.13.30.jpeg',
    confianca: 0.62,
    alertas: [
      'OCR de baixa confiança (62%).',
      'Campo valor_do_frete ausente.',
      'Data da carga não reconhecida automaticamente.',
    ],
    raw_text: `AUTORIZAÇÃO DE FRETE
Emitente: JPD Transportes Ltda
Motorista: RAFAEL SOARES
Placa: JZ447-2
Origem: ITAJAÍ / SC
Destinatário: CARREFOUR SP - DISTR. EMBU
Data da carga: 05/05/2026
Total KM aproximado: 1820
Observações: carga refrigerada, exige lacre.
Valor do frete: ____________
Assinatura: __________________`,
    fields: {
      numero_bv: '',
      data_bv: '2026-05-05',
      motorista: 'Rafael Soares',
      placa: 'JZ447-2',
      origem: 'Itajaí/SC',
      destinatario: 'Carrefour SP',
      data_carga: '2026-05-05',
      total_km: '1820',
      valor_frete: '',
      situacao_bv: 'pendente',
    },
  },
};

const LABELS: { key: string; label: string }[] = [
  { key: 'numero_bv', label: 'Número do BV' },
  { key: 'data_bv', label: 'Data do BV' },
  { key: 'motorista', label: 'Motorista' },
  { key: 'placa', label: 'Placa do carro' },
  { key: 'origem', label: 'Origem' },
  { key: 'destinatario', label: 'Destinatário' },
  { key: 'data_carga', label: 'Data da carga' },
  { key: 'total_km', label: 'Total KM' },
  { key: 'valor_frete', label: 'Valor do frete' },
  { key: 'situacao_bv', label: 'Situação do BV' },
];

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white';

const JpdRevisao = () => {
  const { id = '3' } = useParams<{ id: string }>();
  const nav = useNavigate();
  const doc = MOCK[id] || MOCK['3'];
  const [fields, setFields] = useState(doc.fields);
  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const approve = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Documento aprovado e integrado (mock)');
    nav('/jpd-transportes/documentos');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
            Conferência obrigatória
          </p>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Revisão do documento #{doc.id}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {doc.arquivo} • confiança {doc.confianca.toFixed(2)}
          </p>
        </div>
        <Link
          to="/jpd-transportes/documentos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas da extração
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {doc.alertas.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Texto bruto</h3>
            <pre className="whitespace-pre-wrap break-words text-xs bg-gray-900 text-gray-100 rounded-md p-3 max-h-[480px] overflow-auto">
              {doc.raw_text}
            </pre>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Validar e integrar</h3>
          <form onSubmit={approve} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LABELS.map((f) => (
              <label key={f.key} className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
                <span className="mb-1">{f.label}</span>
                <input value={fields[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />
              </label>
            ))}
            <button
              type="submit"
              className="md:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              <CheckCircle className="w-4 h-4" /> Aprovar e integrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JpdRevisao;
