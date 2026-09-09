import React, { useState } from 'react';
import { X, Loader2, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Select com opção "+ Criar novo(a) ..." no final da lista, além de lápis/lixeira
// para renomear ou excluir o registro mestre selecionado (motorista/placa).
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
  /** Exibe o valor em CAIXA ALTA (ex.: placas), guardando/enviando sempre em minúsculas. */
  uppercase?: boolean;
  /** Renomeia o registro mestre selecionado (motorista/placa). Retorna a option atualizada. */
  onRename?: (valorAtual: string, textoNovo: string) => Promise<Option>;
  /** Chamado após renomear com sucesso, para o pai atualizar sua lista local. */
  onRenamed?: (valorAtual: string, novo: Option) => void;
  /** Exclui o registro mestre selecionado (motorista/placa). */
  onRemove?: (valorAtual: string) => Promise<void>;
  /** Chamado após excluir com sucesso, para o pai atualizar sua lista local. */
  onRemoved?: (valorAtual: string) => void;
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
  uppercase,
  onRename,
  onRenamed,
  onRemove,
  onRemoved,
}) => {
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoEdit, setTextoEdit] = useState('');
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const opts = toOptions(options);
  const atual = opts.find((o) => o.value === value);
  const displayFmt = (s: string) => (uppercase ? s.toUpperCase() : s);
  const parseInput = (s: string) => (uppercase ? s.toLowerCase() : s);

  // Placa (sem onCreate): campo de texto livre, ligado direto ao valor —
  // ao salvar/confirmar o lançamento, o backend cria o que faltar.
  if (criandoNovo && !onCreate) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="text"
          value={displayFmt(value)}
          placeholder={newPlaceholder}
          onChange={(e) => onChange(parseInput(e.target.value))}
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

  // Renomeando o registro mestre selecionado (motorista ou placa).
  if (editando) {
    const confirmarEdit = async () => {
      const t = textoEdit.trim();
      if (!t || !onRename) return;
      setSalvandoEdit(true);
      try {
        const novo = await onRename(value, t);
        onRenamed?.(value, novo);
        onChange(novo.value);
        setEditando(false);
      } catch (err: any) {
        toast.error(err.message || 'Erro ao renomear');
      } finally {
        setSalvandoEdit(false);
      }
    };
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="text"
          value={displayFmt(textoEdit)}
          disabled={salvandoEdit}
          onChange={(e) => setTextoEdit(parseInput(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmarEdit();
            }
          }}
          className={className}
        />
        <button
          type="button"
          onClick={confirmarEdit}
          disabled={salvandoEdit || !textoEdit.trim()}
          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 shrink-0"
        >
          {salvandoEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          disabled={salvandoEdit}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const excluir = async () => {
    if (!onRemove || !atual) return;
    if (!window.confirm(`Excluir "${displayFmt(atual.label)}"? Isso remove o cadastro, não apenas este campo.`)) return;
    setRemovendo(true);
    try {
      await onRemove(value);
      onRemoved?.(value);
      onChange('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
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
        {!atual && value ? <option value={value}>{displayFmt(value)}</option> : null}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {displayFmt(o.label)}
          </option>
        ))}
        <option value={NEW}>{createLabel}</option>
      </select>
      {atual && onRename && (
        <button
          type="button"
          onClick={() => {
            setTextoEdit(uppercase ? atual.label.toLowerCase() : atual.label);
            setEditando(true);
          }}
          className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {atual && onRemove && (
        <button
          type="button"
          onClick={excluir}
          disabled={removendo}
          className="text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 shrink-0 disabled:opacity-60"
          title="Excluir"
        >
          {removendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
};

export default JpdCreatableSelect;
