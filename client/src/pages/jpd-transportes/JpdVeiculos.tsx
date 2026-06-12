import React from 'react';
import { Link } from 'react-router-dom';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const EM_ANDAMENTO = [
  { placa: 'JZ447-2', motorista: 'Rafael Soares', origem: 'Itajaí/SC', destinatario: 'Carrefour SP', data: '2026-05-20' },
  { placa: 'LM404-3', motorista: 'Lucas Andrade', origem: 'Cubatão/SP', destinatario: 'Atacadão RJ', data: '2026-05-21' },
  { placa: 'QPR1A23', motorista: 'Marcos Vinicius', origem: 'Joinville/SC', destinatario: 'Assaí BH', data: '2026-05-22' },
];

const RESUMO = [
  { placa: 'JZ447-2', viagens: 24, faturado: 112330, km: 38420, combustivel: 28110, ultimo_bv: 'BV-2026-0084' },
  { placa: 'LM404-3', viagens: 19, faturado: 88910, km: 29770, combustivel: 21640, ultimo_bv: 'BV-2026-0081' },
  { placa: 'QPR1A23', viagens: 17, faturado: 79420, km: 27150, combustivel: 19380, ultimo_bv: '(pendente)' },
  { placa: 'RKT5B89', viagens: 13, faturado: 61180, km: 21110, combustivel: 14220, ultimo_bv: 'BV-2026-0079' },
  { placa: 'SBV7C12', viagens: 10, faturado: 44560, km: 16880, combustivel: 10770, ultimo_bv: 'BV-2026-0076' },
  { placa: 'TXW9D45', viagens: 7, faturado: 31220, km: 12310, combustivel: 7490, ultimo_bv: 'BV-2026-0073' },
];

const linkCls = 'text-blue-600 dark:text-blue-400 hover:underline font-medium';

const JpdVeiculos = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">Frota</p>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Veículos</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Clique em uma placa para ver todas as viagens daquele veículo.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
          Viagens em andamento
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            {EM_ANDAMENTO.length}
          </span>
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Viagens com número do BV ainda não preenchido.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2 text-left">Placa</th>
                <th className="px-3 py-2 text-left">Motorista</th>
                <th className="px-3 py-2 text-left">Origem</th>
                <th className="px-3 py-2 text-left">Destinatário</th>
                <th className="px-3 py-2 text-left">Data da carga</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-gray-200">
              {EM_ANDAMENTO.map((v) => (
                <tr key={v.placa} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2">
                    <Link to={`/jpd-transportes/veiculos/${v.placa}`} className={linkCls}>
                      {v.placa}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{v.motorista}</td>
                  <td className="px-3 py-2">{v.origem}</td>
                  <td className="px-3 py-2">{v.destinatario}</td>
                  <td className="px-3 py-2">{v.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Resumo por veículo</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2 text-left">Placa</th>
                <th className="px-3 py-2 text-left">Viagens</th>
                <th className="px-3 py-2 text-left">Valor faturado</th>
                <th className="px-3 py-2 text-left">KM total</th>
                <th className="px-3 py-2 text-left">Combustível JPD</th>
                <th className="px-3 py-2 text-left">Último BV</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-gray-200">
              {RESUMO.map((v) => (
                <tr key={v.placa} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2">
                    <Link to={`/jpd-transportes/veiculos/${v.placa}`} className={linkCls}>
                      {v.placa}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{v.viagens}</td>
                  <td className="px-3 py-2">{fmtBRL(v.faturado)}</td>
                  <td className="px-3 py-2">{fmtNum(v.km)}</td>
                  <td className="px-3 py-2">{fmtBRL(v.combustivel)}</td>
                  <td className="px-3 py-2">{v.ultimo_bv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JpdVeiculos;
