// Format CPF to Brazilian format (XXX.XXX.XXX-XX)
export const formatCPF = (cpf: string | undefined | null): string => {
  if (!cpf) return '-';
  
  // Remove any non-digit characters and the 55 prefix if present
  const cleanCPF = cpf.replace(/\D/g, '').replace(/^55/, '');
  
  // Return formatted CPF if it has 11 digits
  if (cleanCPF.length === 11) {
    return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  // Return original value if not valid
  return cpf;
};

// Format phone number to Brazilian format ((XX) XXXXX-XXXX)
export const formatPhone = (phone: string | undefined | null): string => {
  if (!phone) return '-';
  
  // Remove any non-digit characters and the 55 prefix if present
  const cleanPhone = phone.replace(/\D/g, '').replace(/^55/, '');
  
  // Format as mobile or landline depending on length
  if (cleanPhone.length === 11) {
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleanPhone.length === 10) {
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  // Return original value if not valid
  return phone;
};

// Format CEP to Brazilian format (XXXXX-XXX)
export const formatCEP = (cep: string | undefined | null): string => {
  if (!cep) return '-';
  
  // Remove any non-digit characters
  const cleanCEP = cep.replace(/\D/g, '');
  
  // Return formatted CEP if it has 8 digits
  if (cleanCEP.length === 8) {
    return cleanCEP.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  
  // Return original value if not valid
  return cep;
};

// Format date to Brazilian format (DD/MM/YYYY)
export const formatDate = (date: string | Date | undefined | null): string => {
  if (!date) return '-';
  
  // Simply split the date string and reformat it without creating a Date object
  // This avoids any timezone adjustments
  if (typeof date === 'string') {
    // Check if it's in ISO format (YYYY-MM-DD)
    const parts = date.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  
  // Fallback to using Date object if not a string or not in expected format
  const dateObj = new Date(date);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
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