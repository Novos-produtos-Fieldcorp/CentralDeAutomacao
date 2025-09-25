import { 
  users, 
  motorista, 
  cliente, 
  veiculo, 
  documento_motorista, 
  documento_ajudante, 
  comentario, 
  gestao_risco, 
  end_motorista, 
  logradouro, 
  bairro, 
  cidade, 
  estado,
  tags,
  motorista_tags,
  wiseapp_acesso,

  type User, 
  type InsertUser,
  type Motorista,
  type InsertMotorista,
  type Cliente,
  type InsertCliente,
  type Veiculo,
  type InsertVeiculo,
  type DocumentoMotorista,
  type DocumentoAjudante,
  type Comentario,
  type InsertComentario,
  type EndMotorista,
  type MotoristaWithAddress,
  type Tag,
  type InsertTag,
  type MotoristaTag,
  type InsertMotoristaTag
} from "@shared/schema";
import { supabase } from "./db";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Motorista methods
  getMotoristas(companyId: number, page?: number, limit?: number, search?: string): Promise<{ motoristas: MotoristaWithAddress[], total: number }>;
  getMotoristasById(id: number): Promise<MotoristaWithAddress | undefined>;
  createMotorista(motorista: InsertMotorista): Promise<Motorista>;
  updateMotorista(id: number, motorista: Partial<InsertMotorista>): Promise<Motorista | undefined>;
  deleteMotorista(id: number): Promise<boolean>;
  
  // Cliente methods
  getClientes(companyId: number): Promise<Cliente[]>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  
  // Veiculo methods
  getVeiculos(motoristaId?: number): Promise<Veiculo[]>;
  createVeiculo(veiculo: InsertVeiculo): Promise<Veiculo>;
  
  // Comentario methods
  getComentarios(motoristaId: number): Promise<Comentario[]>;
  createComentario(comentario: InsertComentario): Promise<Comentario>;
  
  // Document methods
  getDocumentoMotorista(motoristaId: number): Promise<DocumentoMotorista | undefined>;
  getDocumentosAjudante(motoristaId: number): Promise<DocumentoAjudante[]>;

  // Tags methods
  getTags(companyId: number): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: number): Promise<boolean>;

  // Motorista Tags methods
  getMotoristaTagsWithDetails(motoristaId: number): Promise<Tag[]>;
  addTagToMotorista(motoristaId: number, tagId: number): Promise<MotoristaTag>;
  removeTagFromMotorista(motoristaId: number, tagId: number): Promise<boolean>;

  // WiseApp methods
  getWiseappToken(companyId: number): Promise<string | null>;
  getWiseappTokenByEmail(email: string, companyId?: number): Promise<string | null>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    return data as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error || !data) return undefined;
    return data as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(insertUser)
      .select()
      .single();
    
    if (error || !data) throw error;
    return data as User;
  }

  // Motorista methods - usando view para dados completos
  async getMotoristas(
    companyId: number, 
    page: number = 1, 
    limit: number = 20, 
    search?: string
  ): Promise<{ motoristas: MotoristaWithAddress[], total: number }> {
    let query = supabase
      .from('vw_motoristas_completo')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId);

    if (search) {
      query = query.or(`nome.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('data_cadastro', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    return { 
      motoristas: (data || []) as MotoristaWithAddress[], 
      total: count || 0 
    };
  }

  async getMotoristasById(id: number): Promise<MotoristaWithAddress | undefined> {
    const { data, error } = await supabase
      .from('vw_motoristas_completo')
      .select('*')
      .eq('motorista_id', id)
      .single();

    if (error || !data) return undefined;
    return data as MotoristaWithAddress;
  }

  async createMotorista(insertMotorista: InsertMotorista): Promise<Motorista> {
    const { data, error } = await supabase
      .from('motorista')
      .insert(insertMotorista)
      .select()
      .single();
    
    if (error || !data) throw error;
    return data as Motorista;
  }

  async updateMotorista(id: number, updateData: Partial<InsertMotorista>): Promise<Motorista | undefined> {
    const { data, error } = await supabase
      .from('motorista')
      .update(updateData)
      .eq('motorista_id', id)
      .select()
      .single();
    
    if (error || !data) return undefined;
    return data as Motorista;
  }

  async deleteMotorista(id: number): Promise<boolean> {
    const { error } = await supabase
      .from('motorista')
      .delete()
      .eq('motorista_id', id);
    
    return !error;
  }

  // Cliente methods
  async getClientes(companyId: number): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from('cliente')
      .select('*')
      .eq('company_id', companyId);
    
    if (error) throw error;
    return (data || []) as Cliente[];
  }

  async createCliente(insertCliente: InsertCliente): Promise<Cliente> {
    const { data, error } = await supabase
      .from('cliente')
      .insert(insertCliente)
      .select()
      .single();
    
    if (error || !data) throw error;
    return data as Cliente;
  }

  // Veiculo methods
  async getVeiculos(motoristaId?: number): Promise<Veiculo[]> {
    let query = supabase.from('veiculo').select('*');
    
    if (motoristaId) {
      query = query.eq('motorista_id', motoristaId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Veiculo[];
  }

  async createVeiculo(insertVeiculo: InsertVeiculo): Promise<Veiculo> {
    const { data, error } = await supabase
      .from('veiculo')
      .insert(insertVeiculo)
      .select()
      .single();
    
    if (error || !data) throw error;
    return data as Veiculo;
  }

  // Comentario methods
  async getComentarios(motoristaId: number): Promise<Comentario[]> {
    const { data, error } = await supabase
      .from('comentario')
      .select('*')
      .eq('id_motorista', motoristaId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as Comentario[];
  }

  async createComentario(insertComentario: InsertComentario): Promise<Comentario> {
    const { data, error } = await supabase
      .from('comentario')
      .insert(insertComentario)
      .select()
      .single();
    
    if (error || !data) throw error;
    return data as Comentario;
  }

  // Document methods
  async getDocumentoMotorista(motoristaId: number): Promise<DocumentoMotorista | undefined> {
    const { data, error } = await supabase
      .from('documento_motorista')
      .select('*')
      .eq('motorista_id', motoristaId)
      .single();
    
    if (error || !data) return undefined;
    return data as DocumentoMotorista;
  }

  async getDocumentosAjudante(motoristaId: number): Promise<DocumentoAjudante[]> {
    const { data, error } = await supabase
      .from('documento_ajudante')
      .select('*')
      .eq('motorista_id', motoristaId);
    
    if (error) throw error;
    return (data || []) as DocumentoAjudante[];
  }

  // Tags methods
  async getTags(companyId: number): Promise<Tag[]> {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('company_id', companyId);
      
      if (error) throw error;
      return (data || []) as Tag[];
    } catch (error) {
      throw new Error(`Failed to get tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert(insertTag)
        .select()
        .single();
      
      if (error || !data) throw error;
      return data as Tag;
    } catch (error) {
      throw new Error(`Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateTag(id: number, insertTag: Partial<InsertTag>): Promise<Tag | undefined> {
    try {
      const { data, error } = await supabase
        .from('tags')
        .update(insertTag)
        .eq('id', id)
        .select()
        .single();
      
      if (error || !data) return undefined;
      return data as Tag;
    } catch (error) {
      throw new Error(`Failed to update tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteTag(id: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);
      
      return !error;
    } catch (error) {
      console.error('Error deleting tag:', error);
      return false;
    }
  }

  // Motorista Tags methods
  async getMotoristaTagsWithDetails(motoristaId: number): Promise<Tag[]> {
    try {
      const { data, error } = await supabase
        .from('associacao_tags')
        .select(`
          tag_id,
          tag:tags (
            id,
            nome,
            cor,
            company_id,
            limite_max,
            created_at,
            updated_at
          )
        `)
        .eq('motorista_id', motoristaId);
      
      if (error) throw error;
      
      return (data || []).map((item: any) => item.tag).filter(Boolean);
    } catch (error) {
      console.error('Error in getMotoristaTagsWithDetails:', error);
      return [];
    }
  }

  async addTagToMotorista(motoristaId: number, tagId: number): Promise<MotoristaTag> {
    try {
      const { data, error } = await supabase
        .from('associacao_tags')
        .insert({ 
          motorista_id: motoristaId, 
          tag_id: tagId
        })
        .select()
        .single();
      
      if (error || !data) throw error;
      return data as MotoristaTag;
    } catch (error) {
      console.error('Error in addTagToMotorista:', error);
      throw error;
    }
  }

  async removeTagFromMotorista(motoristaId: number, tagId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('associacao_tags')
        .delete()
        .eq('motorista_id', motoristaId)
        .eq('tag_id', tagId);
      
      return !error;
    } catch (error) {
      console.error('Error in removeTagFromMotorista:', error);
      return false;
    }
  }

  // WiseApp token method
  async getWiseappToken(companyId: number): Promise<string | null> {
    console.log(`Fetching WiseApp token for company ${companyId}`);
    try {
      const { data, error } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('company_id', companyId)
        .single();
      
      if (error || !data?.access_token_wiseapp) {
        console.log(`No WiseApp token found for company ${companyId}`);
        return null;
      }
      
      console.log(`Found WiseApp token for company ${companyId}`);
      return data.access_token_wiseapp;
    } catch (error) {
      console.error(`Error fetching WiseApp token for company ${companyId}:`, error);
      return null;
    }
  }

  // New method to get WiseApp token by email (primary search)
  async getWiseappTokenByEmail(email: string, companyId?: number): Promise<string | null> {
    console.log(`Fetching WiseApp token for email ${email}${companyId ? ` and company ${companyId}` : ''}`);
    try {
      let query = supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp, company_id, email, nome')
        .eq('email', email)
        .not('access_token_wiseapp', 'is', null);

      // If companyId provided, filter by it as well
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error(`Error fetching WiseApp token for email ${email}:`, error);
        return null;
      }

      if (!data || data.length === 0) {
        console.log(`No WiseApp token found for email ${email}${companyId ? ` and company ${companyId}` : ''}`);
        
        // Debug: Show all records for this email
        const { data: allRecords } = await supabase
          .from('wiseapp_acesso')
          .select('email, company_id, nome, access_token_wiseapp')
          .eq('email', email);
        
        if (allRecords && allRecords.length > 0) {
          console.log(`Found ${allRecords.length} records for email ${email}:`, 
            allRecords.map(r => ({ 
              company_id: r.company_id, 
              nome: r.nome, 
              has_token: !!r.access_token_wiseapp 
            }))
          );
        }
        
        return null;
      }

      // If multiple results, prefer the one with specified companyId or the first one
      const selectedRecord = companyId 
        ? data.find(record => record.company_id === companyId) || data[0]
        : data[0];
      
      if (!selectedRecord?.access_token_wiseapp) {
        console.log(`Token is null for selected record - email: ${email}, company: ${selectedRecord?.company_id}`);
        return null;
      }
      
      console.log(`Found WiseApp token for email ${email}, using company ${selectedRecord.company_id} (${selectedRecord.nome})`);
      return selectedRecord.access_token_wiseapp;
    } catch (error) {
      console.error(`Error fetching WiseApp token for email ${email}:`, error);
      return null;
    }
  }
}

export const storage = new DatabaseStorage();