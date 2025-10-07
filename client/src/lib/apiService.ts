// API Service for Netlify deployment
// This service handles all API calls to avoid CORS issues with direct Supabase calls

import { createApiUrl } from './api-config';

const API_BASE_URL = '';

export interface DashboardData {
  // Vagas data
  totalVagas: number;
  vagasAbertas: number;
  vagasPreenchidas: number;
  vagasVencidas: number;
  taxaPreenchimento: number;
  
  // Clientes data
  totalClientes: number;
  clientesAtivos: number;
  clientesDesativos: number;
  
  // Motoristas data
  totalMotoristas: number;
  totalAgregados: number;
  
  // Veiculos data
  totalVeiculos: number;
  
  // Hodometro data
  hodometroArray: Array<{ month: string; count: number }>;
  
  // Comprovantes data
  totalComprovantes: number;
  comprovantesCurrentMonth: number;
  
  // Checklist data
  totalChecklists: number;
  checklistCurrentMonth: number;
  
  // Recent data
  recentMotoristas: any[];
  recentVeiculos: any[];
  recentVagas: any[];
  recentComprovantes: any[];
  recentClientes: any[];
}

export interface VagasDashboardData {
  totalVagas: number;
  vagasAbertas: number;
  vagasFechadas: number;
  vagasVencendo: number;
}

export interface CompanyData {
  company_id: number;
}

// Generic API request function
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Company API
export const companyApi = {
  getByAccount: async (accountId: string): Promise<CompanyData> => {
    return apiRequest<CompanyData>(`/company/by-account/${accountId}`);
  }
};

// Dashboard API
export const dashboardApi = {
  getDashboardData: async (companyId: number): Promise<DashboardData> => {
    return apiRequest<DashboardData>(`/dashboard/${companyId}`);
  },
  
  getVagasDashboard: async (companyId: number): Promise<VagasDashboardData> => {
    return apiRequest<VagasDashboardData>(`/vagas/dashboard/${companyId}`);
  }
};

// WiseApp API
export const wiseAppApi = {
  getLabels: async (companyId: number, token: string, accountId: string) => {
    return apiRequest(`/wiseapp/${companyId}/labels`, {
      headers: {
        'wiseapp-token': token,
        'wiseapp-account-id': accountId
      }
    });
  },
  
  searchContacts: async (companyId: number, phone: string, token: string, accountId: string) => {
    return apiRequest(`/wiseapp/${companyId}/contacts/search?phone=${phone}`, {
      headers: {
        'wiseapp-token': token,
        'wiseapp-account-id': accountId
      }
    });
  },
  
  applyLabels: async (companyId: number, contactId: number, labels: string[], token: string, accountId: string) => {
    return apiRequest(`/wiseapp/${companyId}/contacts/${contactId}/labels`, {
      method: 'POST',
      headers: {
        'wiseapp-token': token,
        'wiseapp-account-id': accountId
      },
      body: JSON.stringify({ labels })
    });
  },
  
  syncAllMotoristas: async (companyId: number, token: string, accountId: string) => {
    // Usar backend Express (função Supabase não está deployada)
    const url = createApiUrl('wiseapp/sync-all-motoristas');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'wiseapp-token': token,
        'wiseapp-account-id': accountId
      },
      body: JSON.stringify({ companyId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Sync all motoristas failed');
    }
    
    return response.json();
  }
};

// Health check
export const healthApi = {
  check: async () => {
    return apiRequest('/health');
  }
};

export default {
  company: companyApi,
  dashboard: dashboardApi,
  wiseApp: wiseAppApi,
  health: healthApi
};
