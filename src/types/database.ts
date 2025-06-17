export interface Motorista {
  motorista_id: number;
  cpf: string;
  dt_nascimento: string;
  genero: string;
  telefone: number;
  email: string;
  funcao: string;
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
}

export interface DocumentoMotorista {
  id_documento_motorista: number;
  foto_cnh: string | null;
  nr_rg: string | null;
  orgao_expedidor: string | null;
  data_expedicao: string | null;
  foto_rg: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
  nr_registro_cnh: number | null;
  categoria_cnh: string | null;
  validade_cnh: string | null;
  foto_comprovante_residencia: string | null;
  motorista_id: number;
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
  veiculo_id: number | null;
  motorista_id: number | null;
  comprovante_residencia?: string | null;
  telefone?: string | null;
  genero?: string | null;
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
}

interface Company {
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
  veiculo?: Veiculo;
  acessorios?: any;
  componentes?: any;
  farol?: any;
  fluidos?: any;
  fotos?: any;
  documento?: DocumentoMotorista | null;
  nome?: string;
  endereco?: any;
  veiculo?: (Veiculo & { documento_veiculo: any[] }) | null;
  documento: DocumentoMotorista | null;
  nome: string;
  endereco: any;
  veiculo: (Veiculo & { documento_veiculo: any[] }) | null;
}