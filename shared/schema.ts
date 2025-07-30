import { pgTable, text, serial, integer, boolean, timestamp, varchar, numeric, date, bigint, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Company table
export const company = pgTable("company", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cnpj: text("cnpj"),
  id_conta_wiseapp: text("id_conta_wiseapp"),
  company_id: serial("company_id").unique(),
  st_company: boolean("st_company").default(true),
  checklist_access: boolean("checklist_access").default(true),
  motorista_access: boolean("motorista_access").default(true),
  hodometro_acsess: boolean("hodometro_acsess").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Motorista table
export const motorista = pgTable("motorista", {
  motorista_id: serial("motorista_id").primaryKey(),
  nome: text("nome"),
  cpf: text("cpf").notNull(),
  dt_nascimento: date("dt_nascimento"),
  genero: text("genero"),
  telefone: bigint("telefone", { mode: "number" }),
  email: text("email"),
  funcao: text("funcao").default("Motorista"),
  origem_usuario: text("origem_usuario"),
  st_cadastro: text("st_cadastro").default("Cadastrado"),
  autorizacao_lgpd: text("autorizacao_lgpd"),
  company_id: integer("company_id").references(() => company.id),
  data_cadastro: date("data_cadastro").defaultNow(),
  cliente_id: integer("cliente_id"),
  conversation_id: text("conversation_id"),
  ativo: boolean("ativo").default(true),
});

// Estado table
export const estado = pgTable("estado", {
  id_estado: serial("id_estado").primaryKey(),
  estado: text("estado").notNull(),
  sigla_estado: text("sigla_estado").notNull(),
});

// Cidade table
export const cidade = pgTable("cidade", {
  id_cidade: serial("id_cidade").primaryKey(),
  cidade: text("cidade").notNull(),
  id_estado: integer("id_estado").references(() => estado.id_estado),
});

// Bairro table
export const bairro = pgTable("bairro", {
  id_bairro: serial("id_bairro").primaryKey(),
  bairro: text("bairro").notNull(),
  id_cidade: integer("id_cidade").references(() => cidade.id_cidade),
});

// Logradouro table
export const logradouro = pgTable("logradouro", {
  id_logradouro: serial("id_logradouro").primaryKey(),
  logradouro: text("logradouro").notNull(),
  nr_cep: text("nr_cep").notNull(),
  id_bairro: integer("id_bairro").references(() => bairro.id_bairro),
});

// End_motorista table (addresses)
export const end_motorista = pgTable("end_motorista", {
  id_end_motorista: serial("id_end_motorista").primaryKey(),
  id_motorista: integer("id_motorista").references(() => motorista.motorista_id),
  id_logradouro: integer("id_logradouro").references(() => logradouro.id_logradouro),
  nr_end: integer("nr_end"),
  ds_complemento_end: text("ds_complemento_end"),
  st_end: boolean("st_end").default(true),
});

// Cliente table
export const cliente = pgTable("cliente", {
  cliente_id: serial("cliente_id").primaryKey(),
  nome: text("nome").notNull(),
  company_id: integer("company_id").references(() => company.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Veiculo table
export const veiculo = pgTable("veiculo", {
  veiculo_id: serial("veiculo_id").primaryKey(),
  motorista_id: integer("motorista_id").references(() => motorista.motorista_id),
  placa: text("placa"),
  status_veiculo: boolean("status_veiculo").default(true),
  marca_veiculo: text("marca_veiculo"),
  tipologia: text("tipologia"),
  ano: integer("ano"),
  combustivel: text("combustivel"),
  peso: text("peso"),
  cubagem: text("cubagem"),
  possui_rastreador: boolean("possui_rastreador").default(false),
  marca_rastreador: text("marca_rastreador"),
  cor: text("cor"),
  tipo: text("tipo"),
});

// Documento_motorista table
export const documento_motorista = pgTable("documento_motorista", {
  id_documento_motorista: serial("id_documento_motorista").primaryKey(),
  motorista_id: integer("motorista_id").references(() => motorista.motorista_id),
  foto_cnh: text("foto_cnh"),
  foto_comprovante_residencia: text("foto_comprovante_residencia"),
  uf_cnh: text("uf_cnh"),
  validade_cnh: date("validade_cnh"),
  nr_registro_cnh: text("nr_registro_cnh"),
  categoria_cnh: text("categoria_cnh"),
  nome_pai: text("nome_pai"),
  nome_mae: text("nome_mae"),
});

// Documento_ajudante table
export const documento_ajudante = pgTable("documento_ajudante", {
  id_ajudante: serial("id_ajudante").primaryKey(),
  nome: text("nome").notNull(),
  cpf: bigint("cpf", { mode: "number" }),
  telefone: text("telefone"),
  genero: text("genero"),
  motorista_id: integer("motorista_id").references(() => motorista.motorista_id),
});

// Documento_veiculo table
export const documento_veiculo = pgTable("documento_veiculo", {
  id_documento_veiculo: bigint("id_documento_veiculo", { mode: "number" }).primaryKey(),
  veiculo_id: bigint("veiculo_id", { mode: "number" }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Pessoa_fisica_dono_veiculo table
export const pessoa_fisica_dono_veiculo = pgTable("pessoa_fisica_dono_veiculo", {
  id_pessoa_fisica_dono_veiculo: bigint("id_pessoa_fisica_dono_veiculo", { mode: "number" }).primaryKey(),
  nr_rg: numeric("nr_rg"),
  id_documento_veiculo: bigint("id_documento_veiculo", { mode: "number" }),
  data_emissao: text("data_emissao"),
  cpf: numeric("cpf"),
  orgao_expedidor: text("orgao_expedidor"),
  nome_mae: text("nome_mae"),
  nome_pai: text("nome_pai"),
  nome: text("nome"),
  foto_documento: text("foto_documento"),
  comprovante_residencia: text("comprovante_residencia"),
});

// Pessoa_juridica_dono_veiculo table
export const pessoa_juridica_dono_veiculo = pgTable("pessoa_juridica_dono_veiculo", {
  id_pessoa_juridica_dono_veiculo: bigint("id_pessoa_juridica_dono_veiculo", { mode: "number" }).primaryKey(),
  cnpj: numeric("cnpj"),
  inscricao_estadual: text("inscricao_estadual"),
  razao_social: text("razao_social"),
  id_documento_veiculo: bigint("id_documento_veiculo", { mode: "number" }),
  comprovante_residencia: text("comprovante_residencia"),
});

// Comentario table
export const comentario = pgTable("comentario", {
  id: serial("id").primaryKey(),
  id_motorista: integer("id_motorista").references(() => motorista.motorista_id),
  id_atendente: integer("id_atendente"),
  comentario: text("comentario"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Gestao_risco table
export const gestao_risco = pgTable("gestao_risco", {
  id: serial("id").primaryKey(),
  motorista_id: integer("motorista_id").references(() => motorista.motorista_id),
  motivo: text("motivo"),
  observacao: text("observacao"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Checklist table
export const checklist = pgTable("checklist", {
  id: serial("id").primaryKey(),
  motorista_id: integer("motorista_id").references(() => motorista.motorista_id),
  data_checklist: date("data_checklist"),
  itens_checklist: jsonb("itens_checklist"),
  status: text("status").default("pendente"),
  created_at: timestamp("created_at").defaultNow(),
});

// Hodometro table
export const hodometro = pgTable("hodometro", {
  id: serial("id").primaryKey(),
  veiculo_id: integer("veiculo_id").references(() => veiculo.veiculo_id),
  motorista_id: integer("motorista_id").references(() => motorista.motorista_id),
  km_inicial: numeric("km_inicial"),
  km_final: numeric("km_final"),
  data_leitura: date("data_leitura"),
  created_at: timestamp("created_at").defaultNow(),
});

// Relations
export const motoristaRelations = relations(motorista, ({ one, many }) => ({
  company: one(company, {
    fields: [motorista.company_id],
    references: [company.id],
  }),
  endereco: many(end_motorista),
  veiculo: many(veiculo),
  documentos: one(documento_motorista, {
    fields: [motorista.motorista_id],
    references: [documento_motorista.motorista_id],
  }),
  ajudantes: many(documento_ajudante),
  comentarios: many(comentario),
  gestaoRisco: many(gestao_risco),
  checklists: many(checklist),
  hodometros: many(hodometro),
}));

export const companyRelations = relations(company, ({ many }) => ({
  motoristas: many(motorista),
  clientes: many(cliente),
}));

export const endMotoristaRelations = relations(end_motorista, ({ one }) => ({
  motorista: one(motorista, {
    fields: [end_motorista.id_motorista],
    references: [motorista.motorista_id],
  }),
  logradouro: one(logradouro, {
    fields: [end_motorista.id_logradouro],
    references: [logradouro.id_logradouro],
  }),
}));

export const logradouroRelations = relations(logradouro, ({ one, many }) => ({
  bairro: one(bairro, {
    fields: [logradouro.id_bairro],
    references: [bairro.id_bairro],
  }),
  enderecos: many(end_motorista),
}));

export const bairroRelations = relations(bairro, ({ one, many }) => ({
  cidade: one(cidade, {
    fields: [bairro.id_cidade],
    references: [cidade.id_cidade],
  }),
  logradouros: many(logradouro),
}));

export const cidadeRelations = relations(cidade, ({ one, many }) => ({
  estado: one(estado, {
    fields: [cidade.id_estado],
    references: [estado.id_estado],
  }),
  bairros: many(bairro),
}));

export const estadoRelations = relations(estado, ({ many }) => ({
  cidades: many(cidade),
}));

// Insert schemas
export const insertMotoristaSchema = createInsertSchema(motorista).omit({
  motorista_id: true,
  data_cadastro: true,
});

export const insertClienteSchema = createInsertSchema(cliente).omit({
  cliente_id: true,
  created_at: true,
});

export const insertVeiculoSchema = createInsertSchema(veiculo).omit({
  veiculo_id: true,
});

export const insertComentarioSchema = createInsertSchema(comentario).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDocumentoVeiculoSchema = createInsertSchema(documento_veiculo).omit({
  id_documento_veiculo: true,
  created_at: true,
  updated_at: true,
});

export const insertPessoaFisicaDonoVeiculoSchema = createInsertSchema(pessoa_fisica_dono_veiculo).omit({
  id_pessoa_fisica_dono_veiculo: true,
});

export const insertPessoaJuridicaDonoVeiculoSchema = createInsertSchema(pessoa_juridica_dono_veiculo).omit({
  id_pessoa_juridica_dono_veiculo: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Motorista = typeof motorista.$inferSelect;
export type InsertMotorista = z.infer<typeof insertMotoristaSchema>;
export type Cliente = typeof cliente.$inferSelect;
export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type Veiculo = typeof veiculo.$inferSelect;
export type InsertVeiculo = z.infer<typeof insertVeiculoSchema>;
export type DocumentoMotorista = typeof documento_motorista.$inferSelect;
export type DocumentoAjudante = typeof documento_ajudante.$inferSelect;
export type DocumentoVeiculo = typeof documento_veiculo.$inferSelect;
export type PessoaFisicaDonoVeiculo = typeof pessoa_fisica_dono_veiculo.$inferSelect;
export type PessoaJuridicaDonoVeiculo = typeof pessoa_juridica_dono_veiculo.$inferSelect;
export type InsertDocumentoVeiculo = z.infer<typeof insertDocumentoVeiculoSchema>;
export type InsertPessoaFisicaDonoVeiculo = z.infer<typeof insertPessoaFisicaDonoVeiculoSchema>;
export type InsertPessoaJuridicaDonoVeiculo = z.infer<typeof insertPessoaJuridicaDonoVeiculoSchema>;
export type Comentario = typeof comentario.$inferSelect;
export type InsertComentario = z.infer<typeof insertComentarioSchema>;
export type EndMotorista = typeof end_motorista.$inferSelect;
export type Logradouro = typeof logradouro.$inferSelect;
export type Bairro = typeof bairro.$inferSelect;
export type Cidade = typeof cidade.$inferSelect;
export type Estado = typeof estado.$inferSelect;

// Job-related types
export type Vaga = typeof vaga.$inferSelect;
export type InsertVaga = z.infer<typeof insertVagaSchema>;
export type Unidade = typeof unidade.$inferSelect;
export type InsertUnidade = z.infer<typeof insertUnidadeSchema>;
export type Operacao = typeof operacao.$inferSelect;
export type InsertOperacao = z.infer<typeof insertOperacaoSchema>;
export type StVaga = typeof st_vaga.$inferSelect;
export type InsertStVaga = z.infer<typeof insertStVagaSchema>;
export type EndVaga = typeof end_vaga.$inferSelect;
export type InsertEndVaga = z.infer<typeof insertEndVagaSchema>;

// Extended types for joins
// Job-related tables
export const st_vaga = pgTable("st_vaga", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  status_vaga: text("status_vaga"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at"),
  company_id: bigint("company_id", { mode: "number" }).references(() => company.id),
});

export const operacao = pgTable("operacao", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at"),
  operacao: text("operacao"),
  company_id: bigint("company_id", { mode: "number" }).references(() => company.id),
});

export const unidade = pgTable("unidade", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  unidade: text("unidade"),
  company_id: bigint("company_id", { mode: "number" }).references(() => company.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at"),
});

export const vaga = pgTable("vaga", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  nome: text("nome"),
  descricao: text("descricao"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at"),
  quantidade: numeric("quantidade"),
  dias_trabalho: text("dias_trabalho").array(),
  horario: text("horario"),
  dt_limite: timestamp("dt_limite"),
  company_id: bigint("company_id", { mode: "number" }).references(() => company.id),
  unidade_id: bigint("unidade_id", { mode: "number" }).references(() => unidade.id),
  operacao_id: bigint("operacao_id", { mode: "number" }).references(() => operacao.id),
  st_vaga_id: bigint("st_vaga_id", { mode: "number" }).references(() => st_vaga.id),
  cliente_id: bigint("cliente_id", { mode: "number" }).references(() => cliente.cliente_id),
  gr_id: bigint("gr_id", { mode: "number" }),
});

export const end_vaga = pgTable("end_vaga", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  numero: numeric("numero"),
  ds_complemento: text("ds_complemento"),
  st_end: boolean("st_end"),
  logradouro_id: bigint("logradouro_id", { mode: "number" }).references(() => logradouro.id_logradouro),
  vaga_id: bigint("vaga_id", { mode: "number" }).references(() => vaga.id),
});

// Relations for new tables
export const vagaRelations = relations(vaga, ({ one }) => ({
  company: one(company, {
    fields: [vaga.company_id],
    references: [company.id],
  }),
  unidade: one(unidade, {
    fields: [vaga.unidade_id],
    references: [unidade.id],
  }),
  operacao: one(operacao, {
    fields: [vaga.operacao_id],
    references: [operacao.id],
  }),
  st_vaga: one(st_vaga, {
    fields: [vaga.st_vaga_id],
    references: [st_vaga.id],
  }),
  cliente: one(cliente, {
    fields: [vaga.cliente_id],
    references: [cliente.cliente_id],
  }),
  endereco: one(end_vaga, {
    fields: [vaga.id],
    references: [end_vaga.vaga_id],
  }),
}));

export const unidadeRelations = relations(unidade, ({ one }) => ({
  company: one(company, {
    fields: [unidade.company_id],
    references: [company.id],
  }),
}));

export const operacaoRelations = relations(operacao, ({ one }) => ({
  company: one(company, {
    fields: [operacao.company_id],
    references: [company.id],
  }),
}));

export const stVagaRelations = relations(st_vaga, ({ one }) => ({
  company: one(company, {
    fields: [st_vaga.company_id],
    references: [company.id],
  }),
}));

export const endVagaRelations = relations(end_vaga, ({ one }) => ({
  vaga: one(vaga, {
    fields: [end_vaga.vaga_id],
    references: [vaga.id],
  }),
  logradouro: one(logradouro, {
    fields: [end_vaga.logradouro_id],
    references: [logradouro.id_logradouro],
  }),
}));

// Insert schemas for new tables  
export const insertVagaSchema = createInsertSchema(vaga).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  dt_limite: z.string().optional(),
});

export const insertUnidadeSchema = createInsertSchema(unidade).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertOperacaoSchema = createInsertSchema(operacao).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertStVagaSchema = createInsertSchema(st_vaga).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertEndVagaSchema = createInsertSchema(end_vaga).omit({
  id: true,
  created_at: true,
});

export interface MotoristaWithAddress extends Motorista {
  endereco?: {
    id_end_motorista: number;
    nr_end: number | null;
    ds_complemento_end: string | null;
    st_end: boolean | null;
    logradouro?: string | null;
    nr_cep?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    sigla_estado?: string | null;
  };
  veiculo?: Veiculo;
}
