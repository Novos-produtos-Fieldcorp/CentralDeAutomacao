// Utilitário para validação de CNH
export interface CnhValidationResult {
  isValid: boolean;
  error?: string;
}

export interface CnhCategoryValidationResult {
  isValid: boolean;
  error?: string;
}

export interface CnhExpirationValidationResult {
  isValid: boolean;
  error?: string;
  isExpired?: boolean;
  daysUntilExpiration?: number;
}

// CNH Categories allowed in Brazil
export const CNH_CATEGORIES = [
  'A', 'B', 'C', 'D', 'E', 
  'AB', 'AC', 'AD', 'AE',
  'ACC'  // Special category for agricultural machines
] as const;

export type CnhCategory = typeof CNH_CATEGORIES[number];

/**
 * Validates Brazilian CNH number using the official algorithm
 * Implements the check digit calculation according to Brazilian standards
 */
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
  
  // CNH deve ter exatamente 11 dígitos
  if (cleanValue.length !== 11) {
    return {
      isValid: false,
      error: 'CNH deve ter exatamente 11 dígitos'
    };
  }
  
  // Verifica se não são todos os dígitos iguais
  if (/^(\d)\1+$/.test(cleanValue)) {
    return {
      isValid: false,
      error: 'CNH não pode ter todos os dígitos iguais'
    };
  }
  
  // Aplicar algoritmo de validação brasileiro da CNH
  const digits = cleanValue.split('').map(Number);
  
  // Calcula o primeiro dígito verificador
  let sum1 = 0;
  let sequence1 = 9;
  for (let i = 0; i < 9; i++) {
    sum1 += digits[i] * sequence1;
    sequence1--;
  }
  
  let firstDigit = sum1 % 11;
  if (firstDigit >= 10) {
    firstDigit = 0;
  }
  
  // Calcula o segundo dígito verificador
  let sum2 = 0;
  let sequence2 = 1;
  for (let i = 0; i < 9; i++) {
    sum2 += digits[i] * sequence2;
    sequence2++;
  }
  
  let secondDigit = sum2 % 11;
  if (secondDigit >= 10) {
    secondDigit = 0;
  }
  
  // Verifica se os dígitos verificadores estão corretos
  if (digits[9] !== firstDigit || digits[10] !== secondDigit) {
    return {
      isValid: false,
      error: 'Número da CNH inválido. Verifique os dígitos.'
    };
  }
  
  return { isValid: true };
};

/**
 * Validates CNH category against Brazilian standards
 */
export const validateCnhCategory = (category: string): CnhCategoryValidationResult => {
  if (!category || category.trim() === '') {
    return {
      isValid: false,
      error: 'Categoria da CNH é obrigatória'
    };
  }
  
  const upperCategory = category.trim().toUpperCase();
  
  if (!CNH_CATEGORIES.includes(upperCategory as CnhCategory)) {
    return {
      isValid: false,
      error: `Categoria '${category}' inválida. Categorias válidas: ${CNH_CATEGORIES.join(', ')}`
    };
  }
  
  return { isValid: true };
};

/**
 * Validates CNH expiration date
 * Returns detailed information about expiration status
 */
export const validateCnhExpiration = (expirationDate: string | Date): CnhExpirationValidationResult => {
  if (!expirationDate) {
    return {
      isValid: false,
      error: 'Data de validade da CNH é obrigatória'
    };
  }
  
  const expDate = typeof expirationDate === 'string' ? new Date(expirationDate) : expirationDate;
  const today = new Date();
  
  // Remove time part for accurate date comparison
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);
  
  if (isNaN(expDate.getTime())) {
    return {
      isValid: false,
      error: 'Data de validade inválida'
    };
  }
  
  // Check if expired
  if (expDate < today) {
    const daysDiff = Math.floor((today.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      isValid: false,
      error: `CNH vencida há ${daysDiff} dias. Renovação necessária.`,
      isExpired: true
    };
  }
  
  // Check if expiring soon (within 30 days)
  const daysDiff = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 30) {
    return {
      isValid: true,
      daysUntilExpiration: daysDiff,
      error: daysDiff <= 7 
        ? `⚠️ CNH vence em ${daysDiff} dias! Renove urgentemente.`
        : `⚠️ CNH vence em ${daysDiff} dias. Considere renovar em breve.`
    };
  }
  
  return { 
    isValid: true,
    daysUntilExpiration: daysDiff
  };
};

/**
 * Comprehensive CNH validation
 * Validates number, category, and expiration date all at once
 */
export const validateCompleteCnh = (
  cnhNumber: string,
  category: string,
  expirationDate: string | Date
): { 
  isValid: boolean; 
  errors: string[];
  warnings?: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate CNH number
  const numberValidation = validateCnhNumber(cnhNumber);
  if (!numberValidation.isValid && numberValidation.error) {
    errors.push(numberValidation.error);
  }
  
  // Validate category
  const categoryValidation = validateCnhCategory(category);
  if (!categoryValidation.isValid && categoryValidation.error) {
    errors.push(categoryValidation.error);
  }
  
  // Validate expiration
  const expirationValidation = validateCnhExpiration(expirationDate);
  if (!expirationValidation.isValid && expirationValidation.error) {
    errors.push(expirationValidation.error);
  } else if (expirationValidation.isValid && expirationValidation.error) {
    // This is a warning (expiring soon)
    warnings.push(expirationValidation.error);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
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