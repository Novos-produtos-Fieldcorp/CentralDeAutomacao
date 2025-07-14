import { 
  users, 
  companies,
  motoristas,
  veiculos,
  clientes,
  hodometros,
  checklists,
  grupoResumo,
  type User, 
  type InsertUser,
  type Company,
  type InsertCompany,
  type Motorista,
  type InsertMotorista,
  type Veiculo,
  type InsertVeiculo,
  type Cliente,
  type InsertCliente,
  type Hodometro,
  type InsertHodometro,
  type Checklist,
  type InsertChecklist,
  type GrupoResumo,
  type InsertGrupoResumo
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Company methods
  getCompany(id: number): Promise<Company | undefined>;
  getCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  
  // Motorista methods
  getMotoristas(companyId: number): Promise<Motorista[]>;
  getMotorista(id: number, companyId: number): Promise<Motorista | undefined>;
  createMotorista(motorista: InsertMotorista): Promise<Motorista>;
  updateMotorista(id: number, motorista: Partial<InsertMotorista>, companyId: number): Promise<Motorista | undefined>;
  deleteMotorista(id: number, companyId: number): Promise<boolean>;
  
  // Veiculo methods
  getVeiculos(companyId: number): Promise<Veiculo[]>;
  getVeiculo(id: number, companyId: number): Promise<Veiculo | undefined>;
  createVeiculo(veiculo: InsertVeiculo): Promise<Veiculo>;
  updateVeiculo(id: number, veiculo: Partial<InsertVeiculo>, companyId: number): Promise<Veiculo | undefined>;
  deleteVeiculo(id: number, companyId: number): Promise<boolean>;
  
  // Cliente methods
  getClientes(companyId: number): Promise<Cliente[]>;
  getCliente(id: number, companyId: number): Promise<Cliente | undefined>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: number, cliente: Partial<InsertCliente>, companyId: number): Promise<Cliente | undefined>;
  deleteCliente(id: number, companyId: number): Promise<boolean>;
  
  // Hodometro methods
  getHodometros(companyId: number): Promise<Hodometro[]>;
  getHodometro(id: number, companyId: number): Promise<Hodometro | undefined>;
  createHodometro(hodometro: InsertHodometro): Promise<Hodometro>;
  updateHodometro(id: number, hodometro: Partial<InsertHodometro>, companyId: number): Promise<Hodometro | undefined>;
  deleteHodometro(id: number, companyId: number): Promise<boolean>;
  
  // Checklist methods
  getChecklists(companyId: number): Promise<Checklist[]>;
  getChecklist(id: number, companyId: number): Promise<Checklist | undefined>;
  createChecklist(checklist: InsertChecklist): Promise<Checklist>;
  updateChecklist(id: number, checklist: Partial<InsertChecklist>, companyId: number): Promise<Checklist | undefined>;
  deleteChecklist(id: number, companyId: number): Promise<boolean>;
  
  // Grupo Resumo methods
  getGrupoResumos(companyId: number): Promise<GrupoResumo[]>;
  getGrupoResumo(id: number, companyId: number): Promise<GrupoResumo | undefined>;
  createGrupoResumo(grupo: InsertGrupoResumo): Promise<GrupoResumo>;
  updateGrupoResumo(id: number, grupo: Partial<InsertGrupoResumo>, companyId: number): Promise<GrupoResumo | undefined>;
  deleteGrupoResumo(id: number, companyId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }
  
  // Company methods
  async getCompany(id: number): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.company_id, id));
    return result[0];
  }
  
  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }
  
  async createCompany(company: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(company).returning();
    return result[0];
  }
  
  // Motorista methods
  async getMotoristas(companyId: number): Promise<Motorista[]> {
    return await db.select().from(motoristas).where(eq(motoristas.company_id, companyId));
  }
  
  async getMotorista(id: number, companyId: number): Promise<Motorista | undefined> {
    const result = await db.select().from(motoristas)
      .where(and(eq(motoristas.motorista_id, id), eq(motoristas.company_id, companyId)));
    return result[0];
  }
  
  async createMotorista(motorista: InsertMotorista): Promise<Motorista> {
    const result = await db.insert(motoristas).values(motorista).returning();
    return result[0];
  }
  
  async updateMotorista(id: number, motorista: Partial<InsertMotorista>, companyId: number): Promise<Motorista | undefined> {
    const result = await db.update(motoristas)
      .set(motorista)
      .where(and(eq(motoristas.motorista_id, id), eq(motoristas.company_id, companyId)))
      .returning();
    return result[0];
  }
  
  async deleteMotorista(id: number, companyId: number): Promise<boolean> {
    const result = await db.delete(motoristas)
      .where(and(eq(motoristas.motorista_id, id), eq(motoristas.company_id, companyId)))
      .returning();
    return result.length > 0;
  }
  
  // Veiculo methods
  async getVeiculos(companyId: number): Promise<Veiculo[]> {
    return await db.select().from(veiculos).where(eq(veiculos.company_id, companyId));
  }
  
  async getVeiculo(id: number, companyId: number): Promise<Veiculo | undefined> {
    const result = await db.select().from(veiculos)
      .where(and(eq(veiculos.veiculo_id, id), eq(veiculos.company_id, companyId)));
    return result[0];
  }
  
  async createVeiculo(veiculo: InsertVeiculo): Promise<Veiculo> {
    const result = await db.insert(veiculos).values(veiculo).returning();
    return result[0];
  }
  
  async updateVeiculo(id: number, veiculo: Partial<InsertVeiculo>, companyId: number): Promise<Veiculo | undefined> {
    const result = await db.update(veiculos)
      .set(veiculo)
      .where(and(eq(veiculos.veiculo_id, id), eq(veiculos.company_id, companyId)))
      .returning();
    return result[0];
  }
  
  async deleteVeiculo(id: number, companyId: number): Promise<boolean> {
    const result = await db.delete(veiculos)
      .where(and(eq(veiculos.veiculo_id, id), eq(veiculos.company_id, companyId)))
      .returning();
    return result.length > 0;
  }
  
  // Cliente methods
  async getClientes(companyId: number): Promise<Cliente[]> {
    return await db.select().from(clientes).where(eq(clientes.company_id, companyId));
  }
  
  async getCliente(id: number, companyId: number): Promise<Cliente | undefined> {
    const result = await db.select().from(clientes)
      .where(and(eq(clientes.cliente_id, id), eq(clientes.company_id, companyId)));
    return result[0];
  }
  
  async createCliente(cliente: InsertCliente): Promise<Cliente> {
    const result = await db.insert(clientes).values(cliente).returning();
    return result[0];
  }
  
  async updateCliente(id: number, cliente: Partial<InsertCliente>, companyId: number): Promise<Cliente | undefined> {
    const result = await db.update(clientes)
      .set(cliente)
      .where(and(eq(clientes.cliente_id, id), eq(clientes.company_id, companyId)))
      .returning();
    return result[0];
  }
  
  async deleteCliente(id: number, companyId: number): Promise<boolean> {
    const result = await db.delete(clientes)
      .where(and(eq(clientes.cliente_id, id), eq(clientes.company_id, companyId)))
      .returning();
    return result.length > 0;
  }
  
  // Hodometro methods
  async getHodometros(companyId: number): Promise<Hodometro[]> {
    return await db.select().from(hodometros).where(eq(hodometros.company_id, companyId));
  }
  
  async getHodometro(id: number, companyId: number): Promise<Hodometro | undefined> {
    const result = await db.select().from(hodometros)
      .where(and(eq(hodometros.hodometro_id, id), eq(hodometros.company_id, companyId)));
    return result[0];
  }
  
  async createHodometro(hodometro: InsertHodometro): Promise<Hodometro> {
    const result = await db.insert(hodometros).values(hodometro).returning();
    return result[0];
  }
  
  async updateHodometro(id: number, hodometro: Partial<InsertHodometro>, companyId: number): Promise<Hodometro | undefined> {
    const result = await db.update(hodometros)
      .set(hodometro)
      .where(and(eq(hodometros.hodometro_id, id), eq(hodometros.company_id, companyId)))
      .returning();
    return result[0];
  }
  
  async deleteHodometro(id: number, companyId: number): Promise<boolean> {
    const result = await db.delete(hodometros)
      .where(and(eq(hodometros.hodometro_id, id), eq(hodometros.company_id, companyId)))
      .returning();
    return result.length > 0;
  }
  
  // Checklist methods
  async getChecklists(companyId: number): Promise<Checklist[]> {
    return await db.select().from(checklists).where(eq(checklists.company_id, companyId));
  }
  
  async getChecklist(id: number, companyId: number): Promise<Checklist | undefined> {
    const result = await db.select().from(checklists)
      .where(and(eq(checklists.checklist_id, id), eq(checklists.company_id, companyId)));
    return result[0];
  }
  
  async createChecklist(checklist: InsertChecklist): Promise<Checklist> {
    const result = await db.insert(checklists).values(checklist).returning();
    return result[0];
  }
  
  async updateChecklist(id: number, checklist: Partial<InsertChecklist>, companyId: number): Promise<Checklist | undefined> {
    const result = await db.update(checklists)
      .set(checklist)
      .where(and(eq(checklists.checklist_id, id), eq(checklists.company_id, companyId)))
      .returning();
    return result[0];
  }
  
  async deleteChecklist(id: number, companyId: number): Promise<boolean> {
    const result = await db.delete(checklists)
      .where(and(eq(checklists.checklist_id, id), eq(checklists.company_id, companyId)))
      .returning();
    return result.length > 0;
  }
  
  // Grupo Resumo methods
  async getGrupoResumos(companyId: number): Promise<GrupoResumo[]> {
    return await db.select().from(grupoResumo).where(eq(grupoResumo.company_id, companyId));
  }
  
  async getGrupoResumo(id: number, companyId: number): Promise<GrupoResumo | undefined> {
    const result = await db.select().from(grupoResumo)
      .where(and(eq(grupoResumo.id, id), eq(grupoResumo.company_id, companyId)));
    return result[0];
  }
  
  async createGrupoResumo(grupo: InsertGrupoResumo): Promise<GrupoResumo> {
    const result = await db.insert(grupoResumo).values(grupo).returning();
    return result[0];
  }
  
  async updateGrupoResumo(id: number, grupo: Partial<InsertGrupoResumo>, companyId: number): Promise<GrupoResumo | undefined> {
    const result = await db.update(grupoResumo)
      .set(grupo)
      .where(and(eq(grupoResumo.id, id), eq(grupoResumo.company_id, companyId)))
      .returning();
    return result[0];
  }
  
  async deleteGrupoResumo(id: number, companyId: number): Promise<boolean> {
    const result = await db.delete(grupoResumo)
      .where(and(eq(grupoResumo.id, id), eq(grupoResumo.company_id, companyId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
