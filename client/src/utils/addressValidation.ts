import { consultarCep, validarCep, formatarCep } from './cepService';
import toast from 'react-hot-toast';

export interface AddressValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface CompleteAddress {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  estado?: string;
  numero?: string;
  complemento?: string;
}

export interface AddressFormData {
  cep: string;
  estado: string;
  cidade: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
}

/**
 * Validates CEP format and existence
 */
export const validateCep = (cep: string): AddressValidationResult => {
  const cleanCep = cep.replace(/\D/g, '');
  
  if (!cleanCep) {
    return {
      isValid: false,
      error: 'CEP é obrigatório'
    };
  }
  
  if (!validarCep(cleanCep)) {
    return {
      isValid: false,
      error: 'CEP deve ter 8 dígitos'
    };
  }
  
  return { isValid: true };
};

/**
 * Validates address completeness
 */
export const validateAddressCompleteness = (address: Partial<AddressFormData>): AddressValidationResult => {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Required fields
  if (!address.cep || !validarCep(address.cep)) {
    errors.push('CEP é obrigatório e deve ser válido');
  }
  
  if (!address.logradouro || address.logradouro.trim() === '') {
    errors.push('Logradouro (rua/avenida) é obrigatório');
  }
  
  if (!address.cidade || address.cidade.trim() === '') {
    errors.push('Cidade é obrigatória');
  }
  
  if (!address.estado || address.estado.trim() === '') {
    errors.push('Estado é obrigatório');
  }
  
  if (!address.bairro || address.bairro.trim() === '') {
    errors.push('Bairro é obrigatório');
  }
  
  // Optional but recommended fields
  if (!address.numero || address.numero.trim() === '') {
    warnings.push('Número do endereço não informado - recomendável preencher');
  }
  
  return {
    isValid: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

/**
 * Validates individual address fields
 */
export const validateAddressField = (fieldName: keyof AddressFormData, value: string): AddressValidationResult => {
  const cleanValue = value?.trim() || '';
  
  switch (fieldName) {
    case 'cep':
      return validateCep(cleanValue);
      
    case 'logradouro':
      if (!cleanValue) {
        return { isValid: false, error: 'Logradouro é obrigatório' };
      }
      if (cleanValue.length < 3) {
        return { isValid: false, error: 'Logradouro muito curto (mínimo 3 caracteres)' };
      }
      return { isValid: true };
      
    case 'cidade':
      if (!cleanValue) {
        return { isValid: false, error: 'Cidade é obrigatória' };
      }
      if (cleanValue.length < 2) {
        return { isValid: false, error: 'Nome da cidade muito curto' };
      }
      return { isValid: true };
      
    case 'bairro':
      if (!cleanValue) {
        return { isValid: false, error: 'Bairro é obrigatório' };
      }
      if (cleanValue.length < 2) {
        return { isValid: false, error: 'Nome do bairro muito curto' };
      }
      return { isValid: true };
      
    case 'estado':
      if (!cleanValue) {
        return { isValid: false, error: 'Estado é obrigatório' };
      }
      return { isValid: true };
      
    case 'numero':
      if (cleanValue && !/^\d+[A-Za-z]?$/.test(cleanValue)) {
        return { 
          isValid: false, 
          error: 'Número deve conter apenas dígitos (ex: 123, 45A)' 
        };
      }
      return { isValid: true };
      
    case 'complemento':
      // Complemento é sempre opcional
      return { isValid: true };
      
    default:
      return { isValid: true };
  }
};

/**
 * Enhanced CEP lookup with better error handling and state mapping
 */
export const lookupAddressByCep = async (
  cep: string, 
  estados: Array<{ id_estado: number; sigla_estado: string }>
): Promise<{
  success: boolean;
  data?: Partial<AddressFormData>;
  error?: string;
}> => {
  try {
    // Validate CEP format first
    const cepValidation = validateCep(cep);
    if (!cepValidation.isValid) {
      return { 
        success: false, 
        error: cepValidation.error 
      };
    }
    
    // Call CEP service
    const addressData = await consultarCep(cep.replace(/\D/g, ''));
    
    // Find estado_id based on UF
    const estado = estados.find(e => e.sigla_estado === addressData.uf);
    
    const formattedData: Partial<AddressFormData> = {
      cep: formatarCep(addressData.cep),
      logradouro: addressData.logradouro || '',
      bairro: addressData.bairro || '',
      cidade: addressData.localidade || '',
      estado: estado ? estado.id_estado.toString() : '',
      complemento: addressData.complemento || ''
    };
    
    // Validate the populated data
    const validation = validateAddressCompleteness(formattedData);
    if (!validation.isValid) {
      return {
        success: false,
        error: `CEP encontrado, mas dados incompletos: ${validation.error}`
      };
    }
    
    return {
      success: true,
      data: formattedData
    };
    
  } catch (error) {
    console.error('Erro ao consultar CEP:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Erro desconhecido ao consultar CEP';
      
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Hook-like function for CEP lookup with automatic form updates
 */
export const useCepLookup = () => {
  const lookupCep = async (
    cep: string,
    estados: Array<{ id_estado: number; sigla_estado: string }>,
    setFormData: (updater: (prev: any) => any) => void,
    setLoadingCep?: (loading: boolean) => void
  ): Promise<boolean> => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) {
      return false;
    }
    
    try {
      setLoadingCep?.(true);
      
      const result = await lookupAddressByCep(cep, estados);
      
      if (result.success && result.data) {
        setFormData((prev: any) => ({
          ...prev,
          ...result.data
        }));
        
        toast.success('CEP encontrado! Endereço preenchido automaticamente.');
        return true;
      } else {
        toast.error(result.error || 'Erro ao consultar CEP');
        
        // Clear address fields on error
        setFormData((prev: any) => ({
          ...prev,
          logradouro: '',
          bairro: '',
          cidade: '',
          estado: '',
          complemento: ''
        }));
        return false;
      }
    } catch (error) {
      console.error('Erro no lookup de CEP:', error);
      toast.error('Erro ao consultar CEP. Tente novamente.');
      return false;
    } finally {
      setLoadingCep?.(false);
    }
  };
  
  return { lookupCep };
};

/**
 * Validate complete address before form submission
 */
export const validateAddressForSubmission = (
  addressData: Partial<AddressFormData>
): { isValid: boolean; errors: string[]; canProceed: boolean } => {
  const validation = validateAddressCompleteness(addressData);
  const errors: string[] = [];
  
  if (validation.error) {
    errors.push(validation.error);
  }
  
  // Additional business rules for submission
  if (addressData.cep && !validarCep(addressData.cep)) {
    errors.push('CEP inválido para submissão');
  }
  
  // Can proceed even with warnings, but not with errors
  const canProceed = errors.length === 0;
  
  return {
    isValid: validation.isValid,
    errors,
    canProceed
  };
};

/**
 * Format address for display
 */
export const formatAddressForDisplay = (address: Partial<AddressFormData>): string => {
  const parts: string[] = [];
  
  if (address.logradouro) {
    let logradouroPart = address.logradouro;
    if (address.numero) {
      logradouroPart += `, ${address.numero}`;
    }
    if (address.complemento) {
      logradouroPart += ` - ${address.complemento}`;
    }
    parts.push(logradouroPart);
  }
  
  if (address.bairro) {
    parts.push(address.bairro);
  }
  
  if (address.cidade && address.estado) {
    parts.push(`${address.cidade}`);
  }
  
  if (address.cep) {
    parts.push(`CEP: ${formatarCep(address.cep)}`);
  }
  
  return parts.join(' - ');
};