import axios from 'axios';

export interface WiseAppContact {
  id?: number;
  name: string;
  phone_number: string;
  email?: string;
  custom_attributes?: {
    source: string;
    source_type: 'motorista' | 'agregado' | 'contratado';
    motorista_id?: number;
    cpf?: string;
    city?: string;
    company_id?: number;
    [key: string]: any;
  };
}

export interface WiseAppTag {
  id: number;
  name: string;
  description?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WiseAppConfig {
  apiKey: string;
  accountId: string;
  baseURL: string;
}

export class WiseAppService {
  private api: any;
  private config: WiseAppConfig;

  constructor(config: WiseAppConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: config.baseURL || 'https://chat.wiseapp360.com',
      headers: {
        'api_access_token': config.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Formatar número de telefone para padrão internacional brasileiro
   */
  private formatPhoneNumber(phone: string | number): string {
    const phoneStr = phone.toString().replace(/\D/g, '');
    
    // Se não começa com 55 e tem 11 dígitos ou menos, adicionar código do país
    if (!phoneStr.startsWith('55') && phoneStr.length <= 11) {
      return `+55${phoneStr}`;
    }
    
    // Se já tem código do país, apenas adicionar + se necessário
    if (!phoneStr.startsWith('+')) {
      return `+${phoneStr}`;
    }
    
    return phoneStr;
  }

  /**
   * Buscar contato existente por telefone ou CPF
   */
  async searchContact(searchTerm: string): Promise<WiseAppContact | null> {
    try {
      const response = await this.api.get(`/api/v1/accounts/${this.config.accountId}/contacts/search`, {
        params: { q: searchTerm }
      });
      
      if (response.data?.payload?.[0]) {
        return response.data.payload[0];
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar contato WiseApp:', error);
      return null;
    }
  }

  /**
   * Buscar foto do perfil do contato no WhatsApp
   */
  async getContactProfilePhoto(phoneNumber: string): Promise<string | null> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const response = await this.api.get(`/api/v1/accounts/${this.config.accountId}/contacts/search`, {
        params: { q: formattedPhone }
      });
      
      if (response.data?.payload?.[0]?.avatar) {
        return response.data.payload[0].avatar;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar foto do contato:', error);
      return null;
    }
  }

  /**
   * Criar novo contato no WiseApp
   */
  async createContact(contactData: WiseAppContact): Promise<WiseAppContact | null> {
    try {
      const formattedPhone = this.formatPhoneNumber(contactData.phone_number);
      
      const payload = {
        name: contactData.name,
        phone_number: formattedPhone,
        email: contactData.email,
        custom_attributes: {
          source: 'website_sync',
          ...contactData.custom_attributes
        }
      };

      const response = await this.api.post(`/api/v1/accounts/${this.config.accountId}/contacts`, payload);
      
      if (response.data) {
        console.log(`✓ Contato criado no WiseApp: ${contactData.name} (${formattedPhone})`);
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao criar contato WiseApp:', error);
      throw error;
    }
  }

  /**
   * Atualizar contato existente no WiseApp
   */
  async updateContact(contactId: number, contactData: Partial<WiseAppContact>): Promise<WiseAppContact | null> {
    try {
      const payload: any = {};
      
      if (contactData.name) payload.name = contactData.name;
      if (contactData.phone_number) payload.phone_number = this.formatPhoneNumber(contactData.phone_number);
      if (contactData.email) payload.email = contactData.email;
      if (contactData.custom_attributes) {
        payload.custom_attributes = {
          ...contactData.custom_attributes,
          source: 'website_sync'
        };
      }

      const response = await this.api.put(`/api/v1/accounts/${this.config.accountId}/contacts/${contactId}`, payload);
      
      if (response.data) {
        console.log(`✓ Contato atualizado no WiseApp: ${contactData.name} (ID: ${contactId})`);
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao atualizar contato WiseApp:', error);
      throw error;
    }
  }

  /**
   * Sincronizar motorista/agregado com WiseApp
   */
  async syncMotorista(motorista: {
    motorista_id: number;
    nome: string;
    telefone: number;
    email?: string;
    cpf: string;
    funcao: string;
    company_id: number;
    cidade?: string;
    estado?: string;
  }): Promise<{ success: boolean; contactId?: number; error?: string }> {
    try {
      if (!motorista.telefone) {
        throw new Error('Telefone é obrigatório para sincronização com WiseApp');
      }

      const formattedPhone = this.formatPhoneNumber(motorista.telefone);
      
      // Primeiro, tentar encontrar contato existente
      let existingContact = await this.searchContact(formattedPhone);
      
      // Se não encontrou por telefone, tentar buscar por CPF
      if (!existingContact && motorista.cpf) {
        existingContact = await this.searchContact(motorista.cpf);
      }

      const contactData: WiseAppContact = {
        name: motorista.nome,
        phone_number: formattedPhone,
        email: motorista.email,
        custom_attributes: {
          source: 'website_sync',
          source_type: motorista.funcao.toLowerCase() === 'agregado' ? 'agregado' : 
                       motorista.funcao.toLowerCase() === 'contratado' ? 'contratado' : 'motorista',
          motorista_id: motorista.motorista_id,
          cpf: motorista.cpf,
          city: motorista.cidade,
          state: motorista.estado,
          company_id: motorista.company_id,
          funcao: motorista.funcao,
          last_sync: new Date().toISOString()
        }
      };

      let result: WiseAppContact | null = null;

      if (existingContact) {
        // Atualizar contato existente
        result = await this.updateContact(existingContact.id!, contactData);
        return {
          success: true,
          contactId: existingContact.id
        };
      } else {
        // Criar novo contato
        result = await this.createContact(contactData);
        return {
          success: true,
          contactId: result?.id
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`Erro ao sincronizar motorista ${motorista.nome} com WiseApp:`, error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Sincronizar múltiplos motoristas/agregados
   */
  async syncMultipleMotoristas(motoristas: Array<{
    motorista_id: number;
    nome: string;
    telefone: number;
    email?: string;
    cpf: string;
    funcao: string;
    company_id: number;
    cidade?: string;
    estado?: string;
  }>): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    errors: Array<{ motorista_id: number; nome: string; error: string }>;
  }> {
    const results = {
      totalProcessed: motoristas.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ motorista_id: number; nome: string; error: string }>
    };

    for (const motorista of motoristas) {
      try {
        const syncResult = await this.syncMotorista(motorista);
        
        if (syncResult.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            motorista_id: motorista.motorista_id,
            nome: motorista.nome,
            error: syncResult.error || 'Erro desconhecido'
          });
        }
        
        // Delay entre requisições para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.failed++;
        results.errors.push({
          motorista_id: motorista.motorista_id,
          nome: motorista.nome,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    return results;
  }

  /**
   * Validar configuração do WiseApp
   */
  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await this.api.get(`/api/v1/accounts/${this.config.accountId}`);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Erro de validação'
      };
    }
  }

  /**
   * Buscar todas as tags do WiseApp
   */
  async getTags(): Promise<WiseAppTag[]> {
    try {
      const response = await this.api.get(`/api/v1/accounts/${this.config.accountId}/labels`);
      
      if (response.data?.payload) {
        return response.data.payload.map((tag: any) => ({
          id: tag.id,
          name: tag.title,
          description: tag.description,
          color: tag.color,
          created_at: tag.created_at,
          updated_at: tag.updated_at
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Erro ao buscar tags do WiseApp:', error);
      return [];
    }
  }

  /**
   * Criar nova tag no WiseApp
   */
  async createTag(tagData: { name: string; description?: string; color?: string }): Promise<WiseAppTag | null> {
    try {
      const payload = {
        title: tagData.name,
        description: tagData.description || '',
        color: tagData.color || '#3B82F6'
      };

      const response = await this.api.post(`/api/v1/accounts/${this.config.accountId}/labels`, payload);
      
      if (response.data?.payload) {
        const tag = response.data.payload;
        return {
          id: tag.id,
          name: tag.title,
          description: tag.description,
          color: tag.color,
          created_at: tag.created_at,
          updated_at: tag.updated_at
        };
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao criar tag no WiseApp:', error);
      return null;
    }
  }

  /**
   * Atualizar tag no WiseApp
   */
  async updateTag(tagId: number, tagData: { name: string; description?: string; color?: string }): Promise<WiseAppTag | null> {
    try {
      const payload = {
        title: tagData.name,
        description: tagData.description || '',
        color: tagData.color || '#3B82F6'
      };

      const response = await this.api.patch(`/api/v1/accounts/${this.config.accountId}/labels/${tagId}`, payload);
      
      if (response.data?.payload) {
        const tag = response.data.payload;
        return {
          id: tag.id,
          name: tag.title,
          description: tag.description,
          color: tag.color,
          created_at: tag.created_at,
          updated_at: tag.updated_at
        };
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao atualizar tag no WiseApp:', error);
      return null;
    }
  }

  /**
   * Excluir tag do WiseApp
   */
  async deleteTag(tagId: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/v1/accounts/${this.config.accountId}/labels/${tagId}`);
      return true;
    } catch (error) {
      console.error('Erro ao excluir tag do WiseApp:', error);
      return false;
    }
  }

  /**
   * Aplicar tag a um contato no WiseApp
   */
  async applyTagToContact(contactId: number, tagId: number): Promise<boolean> {
    try {
      await this.api.post(`/api/v1/accounts/${this.config.accountId}/contacts/${contactId}/labels`, {
        labels: [tagId]
      });
      return true;
    } catch (error) {
      console.error('Erro ao aplicar tag ao contato no WiseApp:', error);
      return false;
    }
  }

  /**
   * Remover tag de um contato no WiseApp
   */
  async removeTagFromContact(contactId: number, tagId: number): Promise<boolean> {
    try {
      await this.api.delete(`/api/v1/accounts/${this.config.accountId}/contacts/${contactId}/labels/${tagId}`);
      return true;
    } catch (error) {
      console.error('Erro ao remover tag do contato no WiseApp:', error);
      return false;
    }
  }
}

/**
 * Função auxiliar para obter instância do WiseAppService
 */
export function getWiseAppService(config?: Partial<WiseAppConfig>): WiseAppService | null {
  try {
    // For Netlify compatibility, config should always provide the apiKey and accountId
    const apiKey = config?.apiKey || (typeof localStorage !== 'undefined' ? localStorage?.getItem('wiseapp_token') : null);
    const accountId = config?.accountId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('account_id') : null) || (typeof localStorage !== 'undefined' ? localStorage?.getItem('account_id') : null);
    const baseURL = config?.baseURL || 'https://chat.wiseapp360.com';

    if (!apiKey || !accountId) {
      console.warn('WiseApp API key ou Account ID não encontrados');
      return null;
    }

    return new WiseAppService({
      apiKey,
      accountId,
      baseURL
    });
  } catch (error) {
    console.error('Erro ao inicializar WiseAppService:', error);
    return null;
  }
}