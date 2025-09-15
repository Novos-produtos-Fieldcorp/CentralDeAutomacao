// CPF Validation Utilities
export interface CpfValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates Brazilian CPF number using the official algorithm
 * Implements the check digit calculation according to Brazilian standards
 */
export const validateCpfNumber = (cpf: string): CpfValidationResult => {
  // Remove spaces and special characters
  const cleanCpf = cpf.replace(/\D/g, '');
  
  // Check if empty
  if (!cleanCpf) {
    return {
      isValid: false,
      error: 'CPF é obrigatório'
    };
  }
  
  // Check if contains only numbers
  if (!/^\d+$/.test(cleanCpf)) {
    return {
      isValid: false,
      error: 'CPF deve conter apenas números'
    };
  }
  
  // CPF must have exactly 11 digits
  if (cleanCpf.length !== 11) {
    return {
      isValid: false,
      error: 'CPF deve ter exatamente 11 dígitos'
    };
  }
  
  // Check if all digits are the same
  if (/^(\d)\1+$/.test(cleanCpf)) {
    return {
      isValid: false,
      error: 'CPF não pode ter todos os dígitos iguais'
    };
  }
  
  // Apply Brazilian CPF validation algorithm
  const digits = cleanCpf.split('').map(Number);
  
  // Calculate first check digit
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += digits[i] * (10 - i);
  }
  
  let firstDigit = 11 - (sum1 % 11);
  if (firstDigit >= 10) {
    firstDigit = 0;
  }
  
  // Calculate second check digit
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += digits[i] * (11 - i);
  }
  
  let secondDigit = 11 - (sum2 % 11);
  if (secondDigit >= 10) {
    secondDigit = 0;
  }
  
  // Check if check digits are correct
  if (digits[9] !== firstDigit || digits[10] !== secondDigit) {
    return {
      isValid: false,
      error: 'Número de CPF inválido. Verifique os dígitos.'
    };
  }
  
  return { isValid: true };
};

/**
 * Formats CPF input by removing non-numeric characters
 */
export const formatCpfInput = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Masks CPF number for display: 000.000.000-00
 */
export const maskCpfNumber = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
  }
  
  return numbers.substring(0, 11);
};