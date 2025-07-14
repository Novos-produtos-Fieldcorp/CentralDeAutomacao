import { DocumentoAjudante } from './database';

export interface Ajudante extends Omit<DocumentoAjudante, 'cpf' | 'telefone'> {
  cpf: string | null; // Override to ensure string type for display
  telefone: string | null; // Override to ensure string type for display
  created_at?: string;
  updated_at?: string;
  // Add any additional fields from related tables if needed
  cnh_ajudante?: {
    nr_registro: string | null;
    categoria: string | null;
    nome_pai: string | null;
    nome_mae: string | null;
    foto_cnh: string | null;
  } | null;
  endereco?: {
    logradouro: string;
    nr_end: string | null;
    complemento: string | null;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  } | null;
}

export interface CreateAjudanteDTO {
  nome: string;
  cpf: string; // CPF as string to preserve leading zeros
  telefone: string;
  genero?: string | null;
  motorista_id: number;
  comprovante_residencia?: string | null;
  // CNH fields
  nr_registro_cnh?: string;
  categoria_cnh?: string;
  nome_pai?: string;
  nome_mae?: string;
  foto_cnh?: string;
  // Address fields
  endereco?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
}

export interface UpdateAjudanteDTO extends Partial<CreateAjudanteDTO> {
  id_ajudante: number;
}
