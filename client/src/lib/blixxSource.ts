import { useCurrentAccount } from '../hooks/useCurrentAccount';

// account_id que usa as tabelas/views Blixx em vez das tabelas padrao.
export const BLIXX_ACCOUNT_ID = '53';

export const isBlixxAccount = (accountId: string | null | undefined): boolean =>
  accountId != null && String(accountId) === BLIXX_ACCOUNT_ID;

export interface BlixxSources {
  isBlixx: boolean;
  // Views de leitura
  agregadosView: string; // vw_agregados_completo | vw_agregados_blixx
  contratadosView: string; // vw_contratados_completo | vw_contratados_blixx
  inativosRpc: string; // inativos_list_page | inativos_list_page_blixx
  // Tabelas/colunas para escrita
  motoristaTable: string; // motorista | motorista_blixx
  veiculoTable: string; // veiculo | veiculo_blixx
  motoristaPk: string; // motorista_id | motorista_blixx_id
  veiculoPk: string; // veiculo_id | veiculo_blixx_id
}

const STANDARD: BlixxSources = {
  isBlixx: false,
  agregadosView: 'vw_agregados_completo',
  contratadosView: 'vw_contratados_completo',
  inativosRpc: 'inativos_list_page',
  motoristaTable: 'motorista',
  veiculoTable: 'veiculo',
  motoristaPk: 'motorista_id',
  veiculoPk: 'veiculo_id',
};

const BLIXX: BlixxSources = {
  isBlixx: true,
  agregadosView: 'vw_agregados_blixx',
  contratadosView: 'vw_contratados_blixx',
  inativosRpc: 'inativos_list_page_blixx',
  motoristaTable: 'motorista_blixx',
  veiculoTable: 'veiculo_blixx',
  motoristaPk: 'motorista_blixx_id',
  veiculoPk: 'veiculo_blixx_id',
};

export const getBlixxSources = (accountId: string | null | undefined): BlixxSources =>
  isBlixxAccount(accountId) ? BLIXX : STANDARD;

// Hook de conveniencia para componentes.
export const useBlixxSources = (): BlixxSources => {
  const { accountId } = useCurrentAccount();
  return getBlixxSources(accountId);
};
