// Utilitário para validação de CNH
export interface CnhValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateCnhNumber = (value: string): CnhValidationResult => {
  // Remove espaços e caracteres especiais
  const cleanValue = value.replace(/\s/g, '').replace(/\D/g, '');
  
  // Verifica se está vazio
  if (!cleanValue) {
    return {
      isValid: false,
      error: 'Número da CNH é obrigatório'
    };
  }
  
  // Verifica se contém apenas números
  if (!/^\d+$/.test(cleanValue)) {
    return {
      isValid: false,
      error: 'CNH deve conter apenas números'
    };
  }
  
  // Verifica tamanho mínimo
  if (cleanValue.length < 8) {
    return {
      isValid: false,
      error: 'CNH deve ter pelo menos 8 dígitos'
    };
  }
  
  // Verifica tamanho máximo
  if (cleanValue.length > 11) {
    return {
      isValid: false,
      error: 'CNH deve ter no máximo 11 dígitos'
    };
  }
  
  // Verifica se não são todos os dígitos iguais
  if (/^(\d)\1+$/.test(cleanValue)) {
    return {
      isValid: false,
      error: 'CNH não pode ter todos os dígitos iguais'
    };
  }
  
  return { isValid: true };
};

export const formatCnhInput = (value: string): string => {
  // Remove todos os caracteres não numéricos
  return value.replace(/\D/g, '');
};

export const maskCnhNumber = (value: string): string => {
  // Remove caracteres não numéricos
  const numbers = value.replace(/\D/g, '');
  
  // Aplica máscara: 00000000000 -> 000.000.000-00
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
  }
  
  return numbers.substring(0, 11);
};