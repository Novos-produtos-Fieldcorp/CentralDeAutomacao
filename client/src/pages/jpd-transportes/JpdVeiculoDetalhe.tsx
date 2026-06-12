import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';

type Viagem = {
  id: number;
  numero_bv: string;
  data_bv: string;
  motorista: string;
  placa: string;
  origem: string;
  destinatario: string;
  total_km: string;
  valor_frete: string;
  valor_faturado: string;
  situacao_bv: string;
};

const MOCK_VIAGENS: Record<string, Viagem[]> = {
  'JZ447-2': [
    {
      id: 142,
      numero_bv: 'BV-2026-0084',
      data_bv: '2026-05-18',
      motorista: 'Rafael Soares',
      placa: 'JZ447-2',
      origem: 'Itajaí/SC',
      destinatario: 'Carrefour SP',
      total_km: '1.820,00',
      valor_frete: '6.420,00',
      valor_faturado: '6.890,00',
      situacao_bv: 'pago',
    },
    {
      id: 143,
      numero_bv: '',
      data_bv: '',
      motorista: 'Rafael Soares',
      placa: 'JZ447-2',
      origem: 'Itajaí/SC',
      destinatario: 'Atacadão Campinas',
      total_km: '1.640,00',
      valor_frete: '5.910,00',
      valor_faturado: '',
      situacao_bv: 'pendente',
    },
  ],
};

const FIELDS: { key: keyof Viagem; label: string }[] = [
  { key: 'numero_bv', label: 'Número do BV' },
  { key: 'data_bv', label: 'Data do BV' },
  { key: 'motorista', label: 'Motorista' },
  { key: 'placa', label: 'Placa do carro' },
  { key: 'origem', label: 'Origem' },
  { key: 'destinatario', label: 'Destinatário' },
  { key: 'total_km', label: 'Total KM' },
  { key: 'valor_frete', label: 'Valor do frete' },
  { key: 'valor_faturado', label: 'Valor faturado' },
  { key: 'situacao_bv', label: 'Situação do BV' },
];

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white';

const ViagemForm = ({ viagem }: { viagem: Viagem }) => {
  const [data, setData] = useState(viagem);
  const set = (k: keyof Viagem, v: string) => setData((d) => ({ ...d, [k]: v }));
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        Viagem #{viagem.id} • {viagem.numero_bv || '(BV pendente)'}
      </h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          toast.success(`Viagem #${viagem.id} salva (mock)`);
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
            <span className="mb-1">{f.label}</span>
            <input value={data[f.key]} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />
          </label>
        ))}
        <button
          type="submit"
          className="md:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Save className="w-4 h-4" /> Salvar alterações
        </button>
      </form>
    </div>
  );
};

const JpdVeiculoDetalhe = () => {
  const { placa = '' } = useParams<{ placa: string }>();
  const viagens = MOCK_VIAGENS[placa] || MOCK_VIAGENS['JZ447-2'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
            Detalhe da frota
          </p>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Veículo {placa}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {viagens.length} viagem(ns) registrada(s). Edite e salve cada viagem individualmente.
          </p>
        </div>
        <Link
          to="/jpd-transportes/veiculos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>

      {viagens.map((v) => (
        <ViagemForm key={v.id} viagem={v} />
      ))}
    </div>
  );
};

export default JpdVeiculoDetalhe;
