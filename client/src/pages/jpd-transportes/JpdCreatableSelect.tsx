import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Select com opção "+ Criar novo(a) ..." no final da lista.
//
// Dois modos de criação:
// - Sem `onCreate` (ex.: placa, que é salva como texto puro): o campo vira um
//   input livre; o valor digitado é salvo direto no draft e, ao confirmar/
//   salvar, o backend cria o registro que faltar na tabela mestra.
// - Com `onCreate` (ex.: motorista, que é salvo como motorista_id/FK): o
//   campo vira um input + botão "Criar"; ao confirmar, chama a API na hora,
//   pega o {value,label} criado e já seleciona ele.
export type Option = { value: string; label: string };

const NEW = '__new__';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: Option[] | string[];
  createLabel: string;
  newPlaceholder: string;
  className: string;
  onCreate?: (texto: string) => Promise<Option>;
}

const toOptions = (options: Option[] | string[]): Option[] =>
  options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

const JpdCreatableSelect: React.FC<Props> = ({
  value,
  onChange,
  options,
  createLabel,
  newPlaceholder,
  className,
  onCreate,
}) => {
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const opts = toOptions(options);
  const atual = opts.find((o) => o.value === value);

  // Placa (sem onCreate): campo de texto livre, ligado direto ao valor —
  // ao salvar/confirmar o lançamento, o backend cria o que faltar.
  if (criandoNovo && !onCreate) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="text"
          value={value}
          placeholder={newPlaceholder}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
        <button
          type="button"
          onClick={() => {
            setCriandoNovo(false);
            onChange('');
          }}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Motorista (com onCreate): precisa do id retornado pela API antes de poder
  // ser salvo no campo motorista_id, então a criação acontece aqui mesmo.
  if (criandoNovo && onCreate) {
    const confirmar = async () => {
      const t = texto.trim();
      if (!t) return;
      setSalvando(true);
      try {
        const criado = await onCreate(t);
        onChange(criado.value);
        setCriandoNovo(false);
      } catch (err: any) {
        toast.error(err.message || 'Erro ao criar');
      } finally {
        setSalvando(false);
      }
    };
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="text"
          value={texto}
          placeholder={newPlaceholder}
          disabled={salvando}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmar();
            }
          }}
          className={className}
        />
        <button
          type="button"
          onClick={confirmar}
          disabled={salvando || !texto.trim()}
          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 shrink-0"
        >
          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Criar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setCriandoNovo(false);
            setTexto('');
          }}
          disabled={salvando}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === NEW) {
          setCriandoNovo(true);
          setTexto('');
        } else {
          onChange(e.target.value);
        }
      }}
      className={className}
    >
      <option value="">Selecione</option>
      {!atual && value ? <option value={value}>{value}</option> : null}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      <option value={NEW}>{createLabel}</option>
    </select>
  );
};

export default JpdCreatableSelect;
