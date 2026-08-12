import React, { useState } from 'react';
import { X } from 'lucide-react';

// Select com opção "+ Criar novo(a) ..." no final da lista. Ao escolher essa
// opção, o campo vira um input de texto livre — o valor digitado é salvo
// normalmente no draft e, ao confirmar/salvar o lançamento, o backend cria o
// registro que faltar na tabela mestra (jpd_veiculos/motoristas_jpd).
const NEW = '__new__';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  createLabel: string;
  newPlaceholder: string;
  className: string;
  formatOption?: (v: string) => string;
}

const JpdCreatableSelect: React.FC<Props> = ({
  value,
  onChange,
  options,
  createLabel,
  newPlaceholder,
  className,
  formatOption,
}) => {
  const [criandoNovo, setCriandoNovo] = useState(false);

  let opts = options;
  if (value && !opts.includes(value)) opts = [...opts, value];

  if (criandoNovo) {
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

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === NEW) {
          setCriandoNovo(true);
          onChange('');
        } else {
          onChange(e.target.value);
        }
      }}
      className={className}
    >
      <option value="">Selecione</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {formatOption ? formatOption(o) : o}
        </option>
      ))}
      <option value={NEW}>{createLabel}</option>
    </select>
  );
};

export default JpdCreatableSelect;
