import { 
  pgTable, 
  text, 
  varchar, 
  integer, 
  timestamp, 
  serial, 
  boolean, 
  date, 
  time,
  bigint,
  decimal,
  bigserial
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Companies table
export const companies = pgTable("company", {
  company_id: serial("company_id").primaryKey(),
  nome: text("nome").notNull(),
  cnpj: varchar("cnpj", { length: 18 }),
  email: varchar("email", { length: 255 }),
  telefone: varchar("telefone", { length: 20 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Estados table
export const estados = pgTable("estado", {
  id_estado: serial("id_estado").primaryKey(),
  estado: varchar("estado", { length: 100 }).notNull(),
  sigla_estado: varchar("sigla_estado", { length: 2 }).notNull(),
});

// Cidades table
export const cidades = pgTable("cidade", {
  id_cidade: serial("id_cidade").primaryKey(),
  cidade: varchar("cidade", { length: 100 }).notNull(),
  id_estado: integer("id_estado").references(() => estados.id_estado),
});

// Bairros table
export const bairros = pgTable("bairro", {
  id_bairro: serial("id_bairro").primaryKey(),
  bairro: varchar("bairro", { length: 100 }).notNull(),
  id_cidade: integer("id_cidade").references(() => cidades.id_cidade),
});

// Logradouros table
export const logradouros = pgTable("logradouro", {
  id_logradouro: serial("id_logradouro").primaryKey(),
  logradouro: varchar("logradouro", { length: 255 }).notNull(),
  nr_cep: varchar("nr_cep", { length: 10 }),
  id_bairro: integer("id_bairro").references(() => bairros.id_bairro),
});

// Clientes table
export const clientes = pgTable("cliente", {
  cliente_id: serial("cliente_id").primaryKey(),
  nome: text("nome").notNull(),
  cnpj: varchar("cnpj", { length: 18 }),
  email: varchar("email", { length: 255 }),
  telefone: varchar("telefone", { length: 20 }),
  st_cliente: boolean("st_cliente").default(true),
  company_id: integer("company_id").references(() => companies.company_id).notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Motoristas table
export const motoristas = pgTable("motorista", {
  motorista_id: serial("motorista_id").primaryKey(),
  cpf: varchar("cpf", { length: 14 }).notNull(),
  dt_nascimento: date("dt_nascimento"),
  genero: varchar("genero", { length: 20 }),
  telefone: bigint("telefone", { mode: "number" }),
  email: varchar("email", { length: 255 }),
  funcao: varchar("funcao", { length: 50 }).notNull(),
  nome: text("nome").notNull(),
  origem_usuario: varchar("origem_usuario", { length: 50 }),
  st_cadastro: varchar("st_cadastro", { length: 50 }),
  autorizacao_lgpd: varchar("autorizacao_lgpd", { length: 10 }),
  company_id: integer("company_id").references(() => companies.company_id).notNull(),
  data_cadastro: timestamp("data_cadastro").defaultNow(),
  cliente_id: integer("cliente_id").references(() => clientes.cliente_id),
  conversation_id: varchar("conversation_id", { length: 255 }),
  ativo: boolean("ativo").default(true),
  comentario: text("comentario"),
});

// Endereços dos motoristas
export const enderecosMotoristas = pgTable("end_motorista", {
  id_end_motorista: serial("id_end_motorista").primaryKey(),
  id_motorista: integer("id_motorista").references(() => motoristas.motorista_id),
  id_logradouro: integer("id_logradouro").references(() => logradouros.id_logradouro),
  nr_end: integer("nr_end"),
  ds_complemento_end: varchar("ds_complemento_end", { length: 255 }),
  st_end: boolean("st_end").default(true),
});

// Documentos dos motoristas
export const documentosMotoristas = pgTable("documento_motorista", {
  id_documento_motorista: serial("id_documento_motorista").primaryKey(),
  motorista_id: integer("motorista_id").references(() => motoristas.motorista_id),
  foto_cnh: text("foto_cnh"),
  foto_comprovante_residencia: text("foto_comprovante_residencia"),
  nr_registro_cnh: varchar("nr_registro_cnh", { length: 20 }),
  categoria_cnh: varchar("categoria_cnh", { length: 10 }),
  validade_cnh: date("validade_cnh"),
  uf_cnh: varchar("uf_cnh", { length: 2 }),
  nome_pai: varchar("nome_pai", { length: 255 }),
  nome_mae: varchar("nome_mae", { length: 255 }),
});

// Ajudantes/Auxiliares
export const documentosAjudantes = pgTable("documento_ajudante", {
  id_ajudante: serial("id_ajudante").primaryKey(),
  motorista_id: integer("motorista_id").references(() => motoristas.motorista_id),
  nome: text("nome").notNull(),
  cpf: varchar("cpf", { length: 14 }),
  telefone: bigint("telefone", { mode: "number" }),
  genero: varchar("genero", { length: 20 }),
  comprovante_residencia: text("comprovante_residencia"),
});

// RG dos ajudantes
export const rgAjudantes = pgTable("rg_ajudante", {
  id: serial("id").primaryKey(),
  id_ajudante: integer("id_ajudante").references(() => documentosAjudantes.id_ajudante),
  nr_rg: varchar("nr_rg", { length: 20 }),
  data_emissao: date("data_emissao"),
  orgao_expedidor: varchar("orgao_expedidor", { length: 50 }),
  filiacao: text("filiacao"),
  foto_rg: text("foto_rg"),
});

// CNH dos ajudantes
export const cnhAjudantes = pgTable("cnh_ajudante", {
  id: serial("id").primaryKey(),
  id_ajudante: integer("id_ajudante").references(() => documentosAjudantes.id_ajudante),
  nr_registro: varchar("nr_registro", { length: 20 }),
  categoria: varchar("categoria", { length: 10 }),
  nome_pai: varchar("nome_pai", { length: 255 }),
  nome_mae: varchar("nome_mae", { length: 255 }),
  foto_cnh: text("foto_cnh"),
});

// Endereços dos ajudantes
export const enderecosAjudantes = pgTable("end_ajudante", {
  id: serial("id").primaryKey(),
  id_ajudante: integer("id_ajudante").references(() => documentosAjudantes.id_ajudante),
  id_logradouro: integer("id_logradouro").references(() => logradouros.id_logradouro),
  nr_end: integer("nr_end"),
  ds_complemento_end: varchar("ds_complemento_end", { length: 255 }),
  st_end: boolean("st_end").default(true),
});

// Veículos table
export const veiculos = pgTable("veiculo", {
  veiculo_id: serial("veiculo_id").primaryKey(),
  motorista_id: integer("motorista_id").references(() => motoristas.motorista_id),
  placa: varchar("placa", { length: 10 }).notNull(),
  status_veiculo: boolean("status_veiculo").default(true),
  marca: varchar("marca", { length: 50 }),
  tipologia: varchar("tipologia", { length: 50 }),
  ano: integer("ano"),
  combustivel: varchar("combustivel", { length: 30 }),
  peso: decimal("peso", { precision: 10, scale: 2 }),
  cubagem: decimal("cubagem", { precision: 10, scale: 2 }),
  possui_rastreador: boolean("possui_rastreador").default(false),
  marca_rastreador: varchar("marca_rastreador", { length: 50 }),
  cor: varchar("cor", { length: 30 }),
  tipo: varchar("tipo", { length: 50 }),
  company_id: integer("company_id").references(() => companies.company_id).notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Documentos dos veículos
export const documentosVeiculos = pgTable("documento_veiculo", {
  id_documento_veiculo: serial("id_documento_veiculo").primaryKey(),
  veiculo_id: integer("veiculo_id").references(() => veiculos.veiculo_id),
  foto_crv: text("foto_crv"),
  renavam: varchar("renavam", { length: 15 }),
  chassi: varchar("chassi", { length: 20 }),
  ipva_vencimento: date("ipva_vencimento"),
  licenciamento_status: varchar("licenciamento_status", { length: 50 }),
});

// Hodômetros
export const hodometros = pgTable("hodometro", {
  hodometro_id: serial("hodometro_id").primaryKey(),
  veiculo_id: integer("veiculo_id").references(() => veiculos.veiculo_id),
  km_atual: integer("km_atual"),
  data_leitura: date("data_leitura"),
  observacoes: text("observacoes"),
  foto_hodometro: text("foto_hodometro"),
  company_id: integer("company_id").references(() => companies.company_id).notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// Checklists
export const checklists = pgTable("checklist", {
  checklist_id: serial("checklist_id").primaryKey(),
  veiculo_id: integer("veiculo_id").references(() => veiculos.veiculo_id),
  tipo_checklist: varchar("tipo_checklist", { length: 50 }).notNull(),
  data_checklist: date("data_checklist"),
  status: varchar("status", { length: 50 }),
  observacoes: text("observacoes"),
  company_id: integer("company_id").references(() => companies.company_id).notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// Grupo Resumo (WhatsApp Groups)
export const grupoResumo = pgTable("grupo_resumo", {
  id: serial("id").primaryKey(),
  nome_grupo: text("nome_grupo").notNull(),
  url_grupo: text("url_grupo").notNull(),
  horario: time("horario").default("08:00").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  company_id: integer("company_id").references(() => companies.company_id).notNull(),
  icon_name: varchar("icon_name", { length: 50 }),
  color_name: varchar("color_name", { length: 50 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Envio Resumo (Summary Delivery Log)
export const envioResumo = pgTable("envio_resumo", {
  id: serial("id").primaryKey(),
  grupo_id: integer("grupo_id").references(() => grupoResumo.id),
  company_id: integer("company_id").references(() => companies.company_id).notNull(),
  data_envio: timestamp("data_envio").defaultNow(),
  horario_execucao_utc: varchar("horario_execucao_utc", { length: 10 }),
  status: varchar("status", { length: 20 }),
  mensagem: text("mensagem"),
});

// Risk Management Tables
export const grStatus = pgTable("gr_status", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const grEmpresa = pgTable("gr_empresa", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

export const grMotorista = pgTable("gr_motorista", {
  id: serial("id").primaryKey(),
  motorista_id: integer("motorista_id").references(() => motoristas.motorista_id).notNull(),
  empresa_id: integer("empresa_id").references(() => grEmpresa.id).notNull(),
  status_id: integer("status_id").references(() => grStatus.id).notNull(),
  motivo: text("motivo"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const grAjudante = pgTable("gr_ajudante", {
  id: serial("id").primaryKey(),
  ajudante_id: integer("ajudante_id").references(() => documentosAjudantes.id_ajudante).notNull(),
  empresa_id: integer("empresa_id").references(() => grEmpresa.id).notNull(),
  status_id: integer("status_id").references(() => grStatus.id).notNull(),
  motivo: text("motivo"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Eventos de Cliente para Motorista
export const motoristaEventosCliente = pgTable("motorista_eventos_cliente", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  motorista_id: bigint("motorista_id", { mode: "bigint" }).references(() => motoristas.motorista_id),
  integracao: boolean("integracao"),
  integracao_data: date("integracao_data"),
  treinamento: boolean("treinamento"),
  treinamento_data: date("treinamento_data"),
});

// Comentários de Motorista
export const motoristaComentarios = pgTable("motorista_comentarios", {
  id: serial("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
  id_motorista: integer("id_motorista").references(() => motoristas.motorista_id),
  id_atendente: integer("id_atendente"),
  comentario: text("comentario"),
});

// Users table (for authentication)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  motoristas: many(motoristas),
  clientes: many(clientes),
  veiculos: many(veiculos),
  hodometros: many(hodometros),
  checklists: many(checklists),
  grupoResumo: many(grupoResumo),
}));

export const motoristasRelations = relations(motoristas, ({ one, many }) => ({
  company: one(companies, {
    fields: [motoristas.company_id],
    references: [companies.company_id],
  }),
  cliente: one(clientes, {
    fields: [motoristas.cliente_id],
    references: [clientes.cliente_id],
  }),
  endereco: one(enderecosMotoristas, {
    fields: [motoristas.motorista_id],
    references: [enderecosMotoristas.id_motorista],
  }),
  documentos: many(documentosMotoristas),
  ajudantes: many(documentosAjudantes),
  veiculos: many(veiculos),
  grMotorista: many(grMotorista),
  comentarios: many(motoristaComentarios),
}));

export const veiculosRelations = relations(veiculos, ({ one, many }) => ({
  motorista: one(motoristas, {
    fields: [veiculos.motorista_id],
    references: [motoristas.motorista_id],
  }),
  company: one(companies, {
    fields: [veiculos.company_id],
    references: [companies.company_id],
  }),
  documentos: many(documentosVeiculos),
  hodometros: many(hodometros),
  checklists: many(checklists),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  company_id: true,
  created_at: true,
  updated_at: true,
});

export const insertMotoristaSchema = createInsertSchema(motoristas).omit({
  motorista_id: true,
  data_cadastro: true,
});

export const insertVeiculoSchema = createInsertSchema(veiculos).omit({
  veiculo_id: true,
  created_at: true,
  updated_at: true,
});

export const insertClienteSchema = createInsertSchema(clientes).omit({
  cliente_id: true,
  created_at: true,
  updated_at: true,
});

export const insertHodometroSchema = createInsertSchema(hodometros).omit({
  hodometro_id: true,
  created_at: true,
});

export const insertChecklistSchema = createInsertSchema(checklists).omit({
  checklist_id: true,
  created_at: true,
});

export const insertGrupoResumoSchema = createInsertSchema(grupoResumo).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Motorista = typeof motoristas.$inferSelect;
export type InsertMotorista = z.infer<typeof insertMotoristaSchema>;
export type Veiculo = typeof veiculos.$inferSelect;
export type InsertVeiculo = z.infer<typeof insertVeiculoSchema>;
export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type Hodometro = typeof hodometros.$inferSelect;
export type InsertHodometro = z.infer<typeof insertHodometroSchema>;
export type Checklist = typeof checklists.$inferSelect;
export type InsertChecklist = z.infer<typeof insertChecklistSchema>;
export type GrupoResumo = typeof grupoResumo.$inferSelect;
export type InsertGrupoResumo = z.infer<typeof insertGrupoResumoSchema>;
