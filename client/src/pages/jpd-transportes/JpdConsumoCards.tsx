import React from 'react';

export type Consumo = {
  km_por_litro: number;
  media_km_diaria: number;
  total_leituras: number;
  litros_totais: number;
  gasto_combustivel: number;
  custo_medio_litro: number;
  custo_extra_arla: number;
};

const fmtBRL = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const Card = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
  </div>
);

const JpdConsumoCards: React.FC<{ consumo: Consumo | null; title?: string }> = ({ consumo, title }) => {
  if (!consumo) return null;
  return (
    <div className="space-y-3">
      {title && <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h3>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card label="KM rodado por litro" value={`${fmtNum(consumo.km_por_litro)} km/L`} />
        <Card label="Média de KM diária" value={`${fmtNum(consumo.media_km_diaria)} km`} />
        <Card label="Total de leituras de abastecimento" value={String(consumo.total_leituras)} />
        <Card label="Litros totais abastecidos" value={`${fmtNum(consumo.litros_totais)} L`} />
        <Card label="Gastos totais com abastecimento" value={fmtBRL(consumo.gasto_combustivel)} />
        <Card label="Custo médio por litro" value={fmtBRL(consumo.custo_medio_litro)} />
        <Card label="Custo extra (Arla)" value={fmtBRL(consumo.custo_extra_arla)} />
      </div>
    </div>
  );
};

export default JpdConsumoCards;
