// Placa Service - API for vehicle license plate information using FIPE API
interface FipeApiResponse {
  data: {
    veiculo: {
      placa: string;
      marca_modelo: string;
      ano: string;
      cor: string;
      combustivel: string;
      uf: string;
      municipio: string;
      chassi: string;
      situacao_do_chassi?: string;
      tipo_carroceria?: string;
    };
    fipes?: Array<{
      codigo: string;
      marca_modelo: string;
      valor: number;
    }>;
  };
}

interface PlacaData {
  placa?: string;
  modelo?: string;
  marca?: string;
  ano?: string;
  cor?: string;
  combustivel?: string;
  categoria?: string;
  uf?: string;
  municipio?: string;
}

export const consultarPlacaApi = async (placa: string): Promise<PlacaData> => {
  if (!placa || placa.length < 7) {
    throw new Error('Placa deve conter ao menos 7 caracteres');
  }

  // Remove special characters and convert to uppercase
  const placaLimpa = placa.replace(/[^A-Z0-9]/g, '').toUpperCase();

  if (placaLimpa.length !== 7) {
    throw new Error('Placa deve conter exatamente 7 caracteres');
  }

  try {
    // Using FIPE API for vehicle plate consultation
    const response = await fetch(`https://placas.fipeapi.com.br/placas/${placaLimpa}?key=e8f29d24d6680c3ea04acd04aecc3de8`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Placa não encontrada na base de dados');
      }
      if (response.status === 401) {
        throw new Error('⚠️ Erro de autenticação na API de placas. Verifique a chave da API.');
      }
      if (response.status === 429) {
        throw new Error('⚠️ Limite de consultas da API excedido. Tente novamente mais tarde.');
      }
      if (response.status === 503) {
        throw new Error('⚠️ Consulta de placa temporariamente indisponível. Preencha os dados manualmente.');
      }
      throw new Error('Erro ao consultar dados da placa');
    }

    const response_data: FipeApiResponse = await response.json();
    const veiculo = response_data.data?.veiculo;

    if (!veiculo) {
      throw new Error('Dados do veículo não encontrados');
    }

    // Extract marca and modelo from marca_modelo field
    const marcaModelo = veiculo.marca_modelo || '';
    const [marca, ...modeloParts] = marcaModelo.split('/');
    const modelo = modeloParts.join('/').trim();

    return {
      placa: veiculo.placa || placaLimpa,
      modelo: modelo || '',
      marca: marca?.trim() || '',
      ano: veiculo.ano || '',
      cor: veiculo.cor || '',
      combustivel: veiculo.combustivel || '',
      categoria: veiculo.tipo_carroceria || '',
      uf: veiculo.uf || '',
      municipio: veiculo.municipio || ''
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('⚠️ Erro de conexão com a API de placas. Verifique sua internet e tente novamente.');
    }
    
    // If already a treated error message, keep it
    if (error instanceof Error && (error.message.includes('⚠️') || error.message.includes('Dados do veículo não encontrados'))) {
      throw error;
    }
    
    // Generic error for unexpected issues
    throw new Error('⚠️ Erro inesperado ao consultar placa. Tente novamente.');
  }
};

/**
 * Validates Brazilian license plate format (old and Mercosul)
 */
export const validarPlaca = (placa: string): boolean => {
  const placaLimpa = placa.replace(/[^A-Z0-9]/g, '').toUpperCase();
  
  // Old format: AAA-9999 or AAA9999
  const formatoAntigo = /^[A-Z]{3}[0-9]{4}$/;
  
  // Mercosul format: AAA-9A99 or AAA9A99
  const formatoMercosul = /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/;
  
  return formatoAntigo.test(placaLimpa) || formatoMercosul.test(placaLimpa);
};

/**
 * Formats license plate for display
 */
export const formatarPlaca = (placa: string): string => {
  const placaLimpa = placa.replace(/[^A-Z0-9]/g, '').toUpperCase();
  
  if (placaLimpa.length !== 7) {
    return placa; // Return as-is if not valid length
  }
  
  // Check if it's Mercosul format (has letter in 5th position)
  const formatoMercosul = /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/;
  
  if (formatoMercosul.test(placaLimpa)) {
    // Mercosul: AAA9A99 -> AAA-9A99
    return `${placaLimpa.slice(0, 3)}-${placaLimpa.slice(3)}`;
  } else {
    // Old format: AAA9999 -> AAA-9999
    return `${placaLimpa.slice(0, 3)}-${placaLimpa.slice(3)}`;
  }
};