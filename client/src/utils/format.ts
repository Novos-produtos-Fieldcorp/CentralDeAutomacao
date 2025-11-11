// Format CPF to Brazilian format (XXX.XXX.XXX-XX)
export const formatCPF = (cpf: string | number | undefined | null): string => {
  if (!cpf) return '-';
  
  // Convert to string first to handle both string and number inputs
  const cpfString = String(cpf);
  
  // Remove any non-digit characters and the 55 prefix if present
  const cleanCPF = cpfString.replace(/\D/g, '').replace(/^55/, '');
  
  // Return formatted CPF if it has 11 digits
  if (cleanCPF.length === 11) {
    return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  // Return original value if not valid
  return cpfString;
};

// Format phone number to Brazilian format ((XX) XXXXX-XXXX)
export const formatPhone = (phone: string | number | undefined | null): string => {
  if (!phone) return '-';
  
  // Convert to string first to handle both string and number inputs
  const phoneString = String(phone);
  
  // Remove any non-digit characters and the 55 prefix if present
  const cleanPhone = phoneString.replace(/\D/g, '').replace(/^55/, '');
  
  // Format as mobile or landline depending on length
  if (cleanPhone.length === 11) {
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleanPhone.length === 10) {
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  // Return original value if not valid
  return phoneString;
};

// Format CEP to Brazilian format (XXXXX-XXX)
export const formatCEP = (cep: string | number | undefined | null): string => {
  if (!cep) return '-';
  
  // Convert to string first to handle both string and number inputs
  const cepString = String(cep);
  
  // Remove any non-digit characters
  const cleanCEP = cepString.replace(/\D/g, '');
  
  // Return formatted CEP if it has 8 digits
  if (cleanCEP.length === 8) {
    return cleanCEP.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  
  // Return original value if not valid
  return cepString;
};

// Format date to Brazilian format (DD/MM/YYYY)
export const formatDate = (date: string | Date | undefined | null): string => {
  if (!date) return '-';
  
  // Simply split the date string and reformat it without creating a Date object
  // This avoids any timezone adjustments
  if (typeof date === 'string') {
    // Check if it's in ISO format (YYYY-MM-DD) or (YYYY-MM-DDTHH:MM:SS)
    const datePart = date.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  
  // Se não for string, retornar mensagem de erro em vez de tentar converter
  console.warn('[formatDate] Received non-string date value:', date);
  return '-';
};

// Get current date in ISO format (YYYY-MM-DD)
export const getCurrentDate = (): string => {
  // Get current date in local timezone
  const now = new Date();
  
  // Format as YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Format kilometer values with proper thousand separators and 'km' suffix
export const formatKilometers = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return `${value.toLocaleString('pt-BR')} km`;
};

// Format percentage values to avoid double % signs
export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return `${value}%`;
};

// Format CNPJ to Brazilian format (XX.XXX.XXX/XXXX-XX)
export const formatCNPJ = (cnpj: string | number | undefined | null): string => {
  if (!cnpj) return 'Não informado';
  
  // Convert to string first to handle both string and number inputs
  const cnpjString = String(cnpj);
  
  // Remove any non-digit characters
  const cleanCNPJ = cnpjString.replace(/\D/g, '');
  
  // Return formatted CNPJ if it has exactly 14 digits
  if (cleanCNPJ.length === 14) {
    return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  // If CNPJ doesn't have 14 digits, return it as-is with a note
  if (cleanCNPJ.length > 0) {
    return `${cnpjString} (incompleto)`;
  }
  
  // Return fallback message for empty values
  return 'Não informado';
};