export interface EnderecoMotorista {
  id_end_motorista: number;
  nr_end: number | null;
  ds_complemento_end: string | null;
  st_end: boolean | null;
  logradouro: string | null;
  nr_cep: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  sigla_estado: string | null;
}

export interface MotoristaWithAddress extends Motorista {
  endereco?: EnderecoMotorista;
  veiculo?: Veiculo;
}

export interface Motorista {
  motorista_id: number;
  cpf: string;
  dt_nascimento: string;
  genero: string;
  telefone: number | null;
  email: string | null;
  funcao: string;
  area_atuacao?: string | null;
  nome: string;
  origem_usuario: string;
  st_cadastro: string;
  autorizacao_lgpd: string;
  company_id: number;
  data_cadastro: string;
  cliente_id: number;
  conversation_id?: string;
  cidade?: string;
  documento_motorista?: DocumentoMotorista[];
  documento_ajudante?: DocumentoAjudante[];
  ativo?: boolean;
  gr_motorista_id?: number | null;
  gr_motorista_motivo?: string | null;
  empresa_motorista?: string | null;
  status_motorista?: string | null;
  // Fields from documento_motorista
  id_documento_motorista?: number | null;
  dm_foto_cnh?: string | null;
  foto_comprovante_residencia?: string | null;
  nr_registro_cnh?: number | null;
  categoria_cnh?: string | null;
  validade_cnh?: string | null;
  uf_cnh?: string | null;
  dm_nome_pai?: string | null;
  dm_nome_mae?: string | null;
  // Fields from vw_motoristas_completo view
  nr_end?: number | null;
  ds_complemento_end?: string | null;
  st_end?: boolean | null;
  id_end_motorista?: number | null;
  logradouro?: string | null;
  nr_cep?: string | null;
  nome_bairro?: string | null;
  nome_cidade?: string | null;
  nome_estado?: string | null;
  sigla_estado?: string | null;
  // RG fields from view
  nr_rg?: string | null;
  data_emissao?: string | null;
  orgao_expedidor?: string | null;
  filiacao?: string | null;
  foto_rg?: string | null;
  // CNH fields from view
  nr_registro?: number | null;
  categoria?: string | null;
  nome_pai?: string | null;
  nome_mae?: string | null;
  foto_cnh?: string | null;
  foto_whatsapp?: string | null;
  comentario?: string | null;
}

export interface DocumentoMotorista {
  id_documento_motorista: number;
  foto_cnh: string | null;
  foto_comprovante_residencia: string | null;
  motorista_id: number;
  uf_cnh?: string | null;
  validade_cnh?: string | null;
  nr_registro_cnh?: string | null;
  categoria_cnh?: string | null;
  nome_pai?: string | null;
  nome_mae?: string | null;
}

export interface DocumentoVeiculo {
  id_documento_veiculo: number;
  foto_crv: string | null;
  veiculo_id: number;
  renavam: string | null;
  chassi: string | null;
  ipva_vencimento: string | null;
  licenciamento_status: string | null;
  ultima_vistoria: string | null;
  categoria: string | null;
  ano_modelo: string | null;
  restricoes: string | null;
}

export interface PessoaFisicaDonoVeiculo {
  id_pessoa_fisica_dono_veiculo: number;
  nome_dono_veiculo: string | null;
  nr_rg: number | null;
  id_documento_veiculo: number;
}

export interface PessoaJuridicaDonoVeiculo {
  id_pessoa_juridica_dono_veiculo: number;
  cnpj: number | null;
  inscricao_estadual: string | null;
  razao_social: string | null;
  id_documento_veiculo: number;
}

export interface DocumentoAjudante {
  id_ajudante: number;
  nome: string | null;
  cpf: number | null;
  motorista_id: number | null;
  comprovante_residencia?: string | null;
  telefone?: string | null;
  genero?: string | null;
  gr_ajudante_id?: number | null;
  gr_ajudante_motivo?: string | null;
  empresa_ajudante?: string | null;
  status_ajudante?: string | null;
  rg_ajudante?: RgAjudante[];
  cnh_ajudante?: CnhAjudante[];

  // Campos achatados (vw_motoristas_completo)
  nr_rg?: number | null;
  data_emissao?: string | null;
  orgao_expedidor?: string | null;
  filiacao?: string | null;
  foto_rg?: string | null;

  nr_registro?: number | null;
  categoria?: string | null;
  nome_pai?: string | null;
  nome_mae?: string | null;
  foto_cnh?: string | null;

  nr_end_ajudante?: number | null;
  ds_complemento_end_ajudante?: string | null;
  st_end_ajudante?: boolean | null;

  // A view usa cep_ajudante/bairro_ajudante/cidade_ajudante/estado_ajudante
  // e em alguns pontos do front aparecem variantes com nr_cep_/nome_*.
  logradouro_ajudante?: string | null;
  cep_ajudante?: string | null;
  nr_cep_ajudante?: string | null;
  bairro_ajudante?: string | null;
  nome_bairro_ajudante?: string | null;
  cidade_ajudante?: string | null;
  nome_cidade_ajudante?: string | null;
  estado_ajudante?: string | null;
  nome_estado_ajudante?: string | null;
  sigla_estado_ajudante?: string | null;
}

export interface CnhAjudante {
  id_cnh_ajudante: number;
  nr_registro: number | null;
  categoria: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
  id_ajudante: number | null;
  foto_cnh: string | null;
}

export interface RgAjudante {
  id_rg_ajudante: number;
  nr_rg: number | null;
  data_emissao: string | null;
  orgao_expedidor: string | null;
  filiacao: string | null;
  id_ajudante: number | null;
  foto_rg: string | null;
}

export interface EndAjudante {
  id_end_ajudante: number;
  nr_end: number | null;
  ds_complemento_end: string | null;
  st_end: boolean | null;
  id_ajudante: number;
  id_logradouro: number;
  logradouro?: {
    logradouro: string;
    nr_cep: string;
    bairro?: {
      bairro: string;
      cidade?: {
        cidade: string;
        estado?: {
          sigla_estado: string;
        };
      };
    };
  };
}

export interface Veiculo {
  veiculo_id: number;
  placa: string;
  status_veiculo: boolean;
  marca: string;
  modelo?: string;
  tipologia: string;
  ano: string;
  combustivel: string;
  peso: string;
  cubagem: string;
  possui_rastreador: boolean;
  marca_rastreador: string;
  motorista_id: number;
  cor: string;
  tipo: string;
  company_id?: number;
  documento_veiculo?: DocumentoVeiculo[];
  pessoa_fisica_dono_veiculo?: PessoaFisicaDonoVeiculo;
  pessoa_juridica_dono_veiculo?: PessoaJuridicaDonoVeiculo;
}

export interface Hodometro {
  id_hodometro: number;
  data: string;
  hora: string;
  hod_informado: number | null;
  hod_lido: number | null;
  trip_lida: number | null;
  trip_informada: string | null;
  km_rodado: number | null;
  verificacao: boolean | null;
  comparacao_leitura: boolean | null;
  motorista_id: number;
  veiculo_id: number;
  cliente_id: number | null;
  bateria: number | null;
  motorista?: Motorista;
  veiculo?: Veiculo;
  cliente?: Cliente;
  foto_hodometro?: string | null;
}

export interface Cliente {
  cliente_id: number;
  st_cliente: boolean;
  nome: string;
  cnpj: string;
  company_id: number;
  email: string;
  telefone: number;
  cor?: string; // Cor opcional para identificação visual do cliente
}

export interface Company {
  company_id: number;
  nome_company: string;
  cnpj: string;
  st_company: boolean;
  email: string;
  telefone: string;
  api_key: string;
}

export interface Checklist {
  checklist_id: number;
  data: string;
  hora: string;
  quilometragem: number;
  status: boolean;
  observacoes: string;
  id_tipo_checklist: number;
  motorista_id: number;
  veiculo_id: number;
  company_id?: number;
  motorista?: Motorista;
  veiculo?: (Veiculo & { documento_veiculo: any[] }) | null;
  acessorios?: any;
  componentes?: any;
  farol?: any;
  fluidos?: any;
  fotos?: any;
  documento: DocumentoMotorista | null;
  nome: string;
  endereco: any;
}

export interface GestaoRisco {
  id: number;
  motorista_id?: number;
  ajudante_id?: number;
  empresa_id: number;
  status_id: number;
  motivo?: string;
  created_at: string;
  updated_at: string;
}

export interface GrEmpresa {
  id: number;
  nome: string;
  created_at: string;
}

export interface GrStatus {
  id: number;
  status: string;
  created_at: string;
}