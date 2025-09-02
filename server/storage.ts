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
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Motorista methods
  async getMotoristas(
    companyId: number, 
    page: number = 1, 
    limit: number = 20, 
    search?: string
  ): Promise<{ motoristas: MotoristaWithAddress[], total: number }> {
    let query = db
      .select({
        motorista_id: motorista.motorista_id,
        nome: motorista.nome,
        cpf: motorista.cpf,
        dt_nascimento: motorista.dt_nascimento,
        genero: motorista.genero,
        telefone: motorista.telefone,
        email: motorista.email,
        funcao: motorista.funcao,
        origem_usuario: motorista.origem_usuario,
        st_cadastro: motorista.st_cadastro,
        autorizacao_lgpd: motorista.autorizacao_lgpd,
        company_id: motorista.company_id,
        data_cadastro: motorista.data_cadastro,
        cliente_id: motorista.cliente_id,
        conversation_id: motorista.conversation_id,
        foto_whatsapp: motorista.foto_whatsapp,
        ativo: motorista.ativo,
        // Address fields
        id_end_motorista: end_motorista.id_end_motorista,
        nr_end: end_motorista.nr_end,
        ds_complemento_end: end_motorista.ds_complemento_end,
        st_end: end_motorista.st_end,
        logradouro: logradouro.logradouro,
        nr_cep: logradouro.nr_cep,
        nome_bairro: bairro.bairro,
        nome_cidade: cidade.cidade,
        nome_estado: estado.estado,
        sigla_estado: estado.sigla_estado,
      })
      .from(motorista)
      .leftJoin(end_motorista, eq(motorista.motorista_id, end_motorista.id_motorista))
      .leftJoin(logradouro, eq(end_motorista.id_logradouro, logradouro.id_logradouro))
      .leftJoin(bairro, eq(logradouro.id_bairro, bairro.id_bairro))
      .leftJoin(cidade, eq(bairro.id_cidade, cidade.id_cidade))
      .leftJoin(estado, eq(cidade.id_estado, estado.id_estado))
      .where(eq(motorista.company_id, companyId));

    if (search) {
      const baseQuery = db
        .select({
          motorista_id: motorista.motorista_id,
          nome: motorista.nome,
          cpf: motorista.cpf,
          dt_nascimento: motorista.dt_nascimento,
          genero: motorista.genero,
          telefone: motorista.telefone,
          email: motorista.email,
          funcao: motorista.funcao,
          origem_usuario: motorista.origem_usuario,
          st_cadastro: motorista.st_cadastro,
          autorizacao_lgpd: motorista.autorizacao_lgpd,
          company_id: motorista.company_id,
          data_cadastro: motorista.data_cadastro,
          cliente_id: motorista.cliente_id,
          conversation_id: motorista.conversation_id,
          foto_whatsapp: motorista.foto_whatsapp,
          ativo: motorista.ativo,
          // Address fields
          id_end_motorista: end_motorista.id_end_motorista,
          nr_end: end_motorista.nr_end,
          ds_complemento_end: end_motorista.ds_complemento_end,
          st_end: end_motorista.st_end,
          logradouro: logradouro.logradouro,
          nr_cep: logradouro.nr_cep,
          nome_bairro: bairro.bairro,
          nome_cidade: cidade.cidade,
          nome_estado: estado.estado,
          sigla_estado: estado.sigla_estado,
        })
        .from(motorista)
        .leftJoin(end_motorista, eq(motorista.motorista_id, end_motorista.id_motorista))
        .leftJoin(logradouro, eq(end_motorista.id_logradouro, logradouro.id_logradouro))
        .leftJoin(bairro, eq(logradouro.id_bairro, bairro.id_bairro))
        .leftJoin(cidade, eq(bairro.id_cidade, cidade.id_cidade))
        .leftJoin(estado, eq(cidade.id_estado, estado.id_estado))
        .where(
          and(
            eq(motorista.company_id, companyId),
            or(
              like(motorista.nome, `%${search}%`),
              like(motorista.cpf, `%${search}%`),
              like(motorista.email, `%${search}%`),
              like(sql`${motorista.telefone}::text`, `%${search}%`)
            )
          )
        );
      
      query = baseQuery;
    }

    const totalResult = await db
      .select({ count: count() })
      .from(motorista)
      .where(eq(motorista.company_id, companyId));

    const total = totalResult[0]?.count || 0;

    const results = await query
      .orderBy(desc(motorista.data_cadastro))
      .limit(limit)
      .offset((page - 1) * limit);

    const motoristas: MotoristaWithAddress[] = results.map(row => ({
      motorista_id: row.motorista_id,
      nome: row.nome,
      cpf: row.cpf,
      dt_nascimento: row.dt_nascimento,
      genero: row.genero,
      telefone: row.telefone,
      email: row.email,
      funcao: row.funcao,
      origem_usuario: row.origem_usuario,
      st_cadastro: row.st_cadastro,
      autorizacao_lgpd: row.autorizacao_lgpd,
      company_id: row.company_id,
      data_cadastro: row.data_cadastro,
      cliente_id: row.cliente_id,
      conversation_id: row.conversation_id,
      foto_whatsapp: row.foto_whatsapp,
      ativo: row.ativo,
      endereco: row.id_end_motorista ? {
        id_end_motorista: row.id_end_motorista,
        nr_end: row.nr_end,
        ds_complemento_end: row.ds_complemento_end,
        st_end: row.st_end,
        logradouro: row.logradouro,
        nr_cep: row.nr_cep,
        bairro: row.nome_bairro,
        cidade: row.nome_cidade,
        estado: row.nome_estado,
        sigla_estado: row.sigla_estado,
      } : undefined
    }));

    return { motoristas, total };
  }

  async getMotoristasById(id: number): Promise<MotoristaWithAddress | undefined> {
    const result = await db
      .select({
        motorista_id: motorista.motorista_id,
        nome: motorista.nome,
        cpf: motorista.cpf,
        dt_nascimento: motorista.dt_nascimento,
        genero: motorista.genero,
        telefone: motorista.telefone,
        email: motorista.email,
        funcao: motorista.funcao,
        origem_usuario: motorista.origem_usuario,
        st_cadastro: motorista.st_cadastro,
        autorizacao_lgpd: motorista.autorizacao_lgpd,
        company_id: motorista.company_id,
        data_cadastro: motorista.data_cadastro,
        cliente_id: motorista.cliente_id,
        conversation_id: motorista.conversation_id,
        foto_whatsapp: motorista.foto_whatsapp,
        ativo: motorista.ativo,
        // Address fields
        id_end_motorista: end_motorista.id_end_motorista,
        nr_end: end_motorista.nr_end,
        ds_complemento_end: end_motorista.ds_complemento_end,
        st_end: end_motorista.st_end,
        logradouro: logradouro.logradouro,
        nr_cep: logradouro.nr_cep,
        nome_bairro: bairro.bairro,
        nome_cidade: cidade.cidade,
        nome_estado: estado.estado,
        sigla_estado: estado.sigla_estado,
      })
      .from(motorista)
      .leftJoin(end_motorista, eq(motorista.motorista_id, end_motorista.id_motorista))
      .leftJoin(logradouro, eq(end_motorista.id_logradouro, logradouro.id_logradouro))
      .leftJoin(bairro, eq(logradouro.id_bairro, bairro.id_bairro))
      .leftJoin(cidade, eq(bairro.id_cidade, cidade.id_cidade))
      .leftJoin(estado, eq(cidade.id_estado, estado.id_estado))
      .where(eq(motorista.motorista_id, id))
      .limit(1);

    if (!result.length) return undefined;

    const row = result[0];
    return {
      motorista_id: row.motorista_id,
      nome: row.nome,
      cpf: row.cpf,
      dt_nascimento: row.dt_nascimento,
      genero: row.genero,
      telefone: row.telefone,
      email: row.email,
      funcao: row.funcao,
      origem_usuario: row.origem_usuario,
      st_cadastro: row.st_cadastro,
      autorizacao_lgpd: row.autorizacao_lgpd,
      company_id: row.company_id,
      data_cadastro: row.data_cadastro,
      cliente_id: row.cliente_id,
      conversation_id: row.conversation_id,
      foto_whatsapp: row.foto_whatsapp,
      ativo: row.ativo,
      endereco: row.id_end_motorista ? {
        id_end_motorista: row.id_end_motorista,
        nr_end: row.nr_end,
        ds_complemento_end: row.ds_complemento_end,
        st_end: row.st_end,
        logradouro: row.logradouro,
        nr_cep: row.nr_cep,
        bairro: row.nome_bairro,
        cidade: row.nome_cidade,
        estado: row.nome_estado,
        sigla_estado: row.sigla_estado,
      } : undefined
    };
  }

  async createMotorista(insertMotorista: InsertMotorista): Promise<Motorista> {
    const [newMotorista] = await db
      .insert(motorista)
      .values(insertMotorista)
      .returning();
    return newMotorista;
  }

  async updateMotorista(id: number, updateData: Partial<InsertMotorista>): Promise<Motorista | undefined> {
    const [updatedMotorista] = await db
      .update(motorista)
      .set(updateData)
      .where(eq(motorista.motorista_id, id))
      .returning();
    return updatedMotorista || undefined;
  }

  async deleteMotorista(id: number): Promise<boolean> {
    const result = await db
      .delete(motorista)
      .where(eq(motorista.motorista_id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Cliente methods
  async getClientes(companyId: number): Promise<Cliente[]> {
    return await db
      .select()
      .from(cliente)
      .where(eq(cliente.company_id, companyId));
  }

  async createCliente(insertCliente: InsertCliente): Promise<Cliente> {
    const [newCliente] = await db
      .insert(cliente)
      .values(insertCliente)
      .returning();
    return newCliente;
  }

  // Veiculo methods
  async getVeiculos(motoristaId?: number): Promise<Veiculo[]> {
    if (motoristaId) {
      return await db.select().from(veiculo).where(eq(veiculo.motorista_id, motoristaId));
    }
    
    return await db.select().from(veiculo);
  }

  async createVeiculo(insertVeiculo: InsertVeiculo): Promise<Veiculo> {
    const [newVeiculo] = await db
      .insert(veiculo)
      .values(insertVeiculo)
      .returning();
    return newVeiculo;
  }

  // Comentario methods
  async getComentarios(motoristaId: number): Promise<Comentario[]> {
    return await db
      .select()
      .from(comentario)
      .where(eq(comentario.id_motorista, motoristaId))
      .orderBy(desc(comentario.created_at));
  }

  async createComentario(insertComentario: InsertComentario): Promise<Comentario> {
    const [newComentario] = await db
      .insert(comentario)
      .values(insertComentario)
      .returning();
    return newComentario;
  }

  // Document methods
  async getDocumentoMotorista(motoristaId: number): Promise<DocumentoMotorista | undefined> {
    const [documento] = await db
      .select()
      .from(documento_motorista)
      .where(eq(documento_motorista.motorista_id, motoristaId))
      .limit(1);
    return documento || undefined;
  }

  async getDocumentosAjudante(motoristaId: number): Promise<DocumentoAjudante[]> {
    return await db
      .select()
      .from(documento_ajudante)
      .where(eq(documento_ajudante.motorista_id, motoristaId));
  }

  // Tags methods
  async getTags(companyId: number): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tag')
      .select('*')
      .eq('company_id', companyId);
    
    if (error) throw new Error(`Failed to get tags: ${error.message}`);
    return data || [];
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const { data, error } = await supabase
      .from('tag')
      .insert(insertTag)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create tag: ${error.message}`);
    return data;
  }

  async updateTag(id: number, insertTag: Partial<InsertTag>): Promise<Tag | undefined> {
    const { data, error } = await supabase
      .from('tag')
      .update(insertTag)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update tag: ${error.message}`);
    return data || undefined;
  }

  async deleteTag(id: number): Promise<boolean> {
    const { error } = await supabase
      .from('tag')
      .delete()
      .eq('id', id);
    
    return !error;
  }

  // Motorista Tags methods
  async getMotoristaTagsWithDetails(motoristaId: number): Promise<Tag[]> {
    try {
      // Use Supabase directly to avoid WebSocket connection issues if available
      if (supabase) {
        const { data: result, error } = await supabase
          .from('associacao_tags')
          .select(`
            tag_id,
            tag:tag_id (
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

        if (error) {
          console.error('Error fetching motorista tags:', error);
          return [];
        }

        // Transform the result to match the expected Tag[] format
        return result?.map((item: any) => ({
          id: item.tag.id,
          nome: item.tag.nome,
          cor: item.tag.cor,
          company_id: item.tag.company_id,
          limite_max: item.tag.limite_max,
          created_at: item.tag.created_at,
          updated_at: item.tag.updated_at
        })) || [];
      }

      // Fallback to Drizzle if Supabase not available
      const result = await db
        .select({
          id: tags.id,
          nome: tags.nome,
          cor: tags.cor,
          company_id: tags.company_id,
          limite_max: tags.limite_max,
          created_at: tags.created_at,
          updated_at: tags.updated_at
        })
        .from(motorista_tags)
        .innerJoin(tags, eq(motorista_tags.tag_id, tags.id))
        .where(eq(motorista_tags.motorista_id, motoristaId));
      
      return result;
    } catch (error) {
      console.error('Error in getMotoristaTagsWithDetails:', error);
      return [];
    }
  }

  async addTagToMotorista(motoristaId: number, tagId: number): Promise<MotoristaTag> {
    try {
      // Use Supabase directly to avoid WebSocket connection issues if available
      if (supabase) {
        const { data, error } = await supabase
          .from('associacao_tags')
          .insert({
            motorista_id: motoristaId,
            tag_id: tagId
          })
          .select()
          .single();

        if (error) {
          console.error('Error adding tag to motorista:', error);
          throw new Error('Failed to add tag to motorista');
        }

        return data;
      }

      // Fallback to Drizzle
      const [motoristaTag] = await db
        .insert(motorista_tags)
        .values({ 
          motorista_id: motoristaId, 
          tag_id: tagId
        })
        .returning();
      return motoristaTag;
    } catch (error) {
      console.error('Error in addTagToMotorista:', error);
      throw error;
    }
  }

  async removeTagFromMotorista(motoristaId: number, tagId: number): Promise<boolean> {
    try {
      // Use Supabase directly to avoid WebSocket connection issues if available
      if (supabase) {
        const { error } = await supabase
          .from('associacao_tags')
          .delete()
          .eq('motorista_id', motoristaId)
          .eq('tag_id', tagId);

        if (error) {
          console.error('Error removing tag from motorista:', error);
          return false;
        }

        return true;
      }

      // Fallback to Drizzle
      const result = await db
        .delete(motorista_tags)
        .where(
          and(
            eq(motorista_tags.motorista_id, motoristaId),
            eq(motorista_tags.tag_id, tagId)
          )
        );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error in removeTagFromMotorista:', error);
      return false;
    }
  }

  // WiseApp token method - queries wiseapp_acesso table
  async getWiseappToken(companyId: number): Promise<string | null> {
    console.log(`Fetching WiseApp token for company ${companyId}`);
    try {
      const [token] = await db
        .select({ access_token_wiseapp: wiseapp_acesso.access_token_wiseapp })
        .from(wiseapp_acesso)
        .where(eq(wiseapp_acesso.company_id, companyId))
        .limit(1);
      
      if (token?.access_token_wiseapp) {
        console.log(`Found WiseApp token for company ${companyId}`);
        return token.access_token_wiseapp;
      } else {
        console.log(`No WiseApp token found for company ${companyId}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching WiseApp token for company ${companyId}:`, error);
      return null;
    }
  }
}

export const storage = new DatabaseStorage();
