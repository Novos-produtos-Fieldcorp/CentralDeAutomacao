// Placa Service - API for vehicle license plate information
interface PlacaApiResponse {
  // Based on common Brazilian vehicle API responses
  placa?: string;
  modelo?: string;
  marca?: string;
  ano?: string;
  cor?: string;
  combustivel?: string;
  categoria?: string;
  situacao?: string;
  uf?: string;
  municipio?: string;
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
    // Using a placeholder API endpoint - this would need to be configured with a real service
    const response = await fetch(`/api/placa/${placaLimpa}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Placa não encontrada na base de dados');
      }
      if (response.status === 503) {
        throw new Error('⚠️ Consulta de placa temporariamente indisponível. Preencha os dados manualmente.');
      }
      throw new Error('Erro ao consultar dados da placa');
    }

    const data: PlacaApiResponse = await response.json();

    return {
      placa: data.placa || placaLimpa,
      modelo: data.modelo || '',
      marca: data.marca || '',
      ano: data.ano || '',
      cor: data.cor || '',
      combustivel: data.combustivel || '',
      categoria: data.categoria || '',
      uf: data.uf || '',
      municipio: data.municipio || ''
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
    }
    
    // If already a treated error message, keep it
    if (error instanceof Error && error.message.includes('⚠️')) {
      throw error;
    }
    
    throw error;
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