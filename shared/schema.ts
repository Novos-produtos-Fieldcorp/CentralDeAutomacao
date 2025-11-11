import { pgTable, text, serial, integer, boolean, timestamp, varchar, numeric, date, bigint, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Company table
export const company = pgTable("company", {
  nome_company: text("nome_company").notNull(),
  cnpj: text("cnpj"),
  telefone: text("telefone"),
  email: text("email"),
  id_conta_wiseapp: text("id_conta_wiseapp"),
  company_id: serial("company_id").unique(),
  st_company: boolean("st_company").default(true),
  checklist_access: boolean("checklist_access").default(true),
  motorista_access: boolean("motorista_access").default(true),
  vagas_access: boolean("vagas_access").default(true),
  hodometro_acsess: boolean("hodometro_acsess").default(true),
  resumo_access: boolean("resumo_access").default(false),
  tags_access: boolean("tags_access").default(true),
  bomba_gasolina_access: boolean("bomba_gasolina_access").default(false),
  calculo_um_por_dia: boolean("calculo_um_por_dia").default(false),

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
  company_id: integer("company_id").references(() => company.company_id),
  data_cadastro: date("data_cadastro").defaultNow(),
  cliente_id: integer("cliente_id"),
  conversation_id: text("conversation_id"),
  foto_whatsapp: text("foto_whatsapp"),
  ativo: boolean("ativo").default(true),
});

// Tags table for WiseApp integration
export const tags = pgTable("tag", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cor: text("cor").default("#3B82F6"), // Default blue color
  limite_max: integer("limite_max"), // Maximum associates limit
  company_id: integer("company_id").references(() => company.company_id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Tag assignments (many-to-many relationship with motoristas)
export const associacao_tags = pgTable("associacao_tags", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  motorista_id: bigint("motorista_id", { mode: "number" }).references(() => motorista.motorista_id),
  tag_id: bigint("tag_id", { mode: "number" }).references(() => tags.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Legacy alias for backward compatibility
export const motorista_tags = associacao_tags;

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
  cnpj: text("cnpj"),
  st_cliente: boolean("st_cliente").default(true),
  email: text("email"),
  telefone: text("telefone"),
  company_id: integer("company_id").references(() => company.company_id),
  created_at: timestamp("created_at").defaultNow(),
});

// End_cliente table (addresses for clients)
export const end_cliente = pgTable("end_cliente", {
  id_end_cliente: serial("id_end_cliente").primaryKey(),
  cliente_id: integer("cliente_id").references(() => cliente.cliente_id),
  id_logradouro: integer("id_logradouro").references(() => logradouro.id_logradouro),
  nr_end: integer("nr_end"),
  ds_complemento_end: text("ds_complemento_end"),
  st_end: boolean("st_end").default(true),
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

// Checklist table (updated with real structure from database)
export const checklist = pgTable("checklist", {
  checklist_id: serial("checklist_id").primaryKey(),
  data: date("data"),
  hora: text("hora"),
  quilometragem: text("quilometragem"),
  id_tipo_checklist: integer("id_tipo_checklist"), // 1=Mensal, 2=Semanal
  veiculo_id: integer("veiculo_id").references(() => veiculo.veiculo_id),
  motorista_id: integer("motorista_id").references(() => motorista.motorista_id),
  company_id: integer("company_id").references(() => company.company_id),
  status: text("status").default("pendente"),
  created_at: timestamp("created_at").defaultNow(),
});

// Hodometro table (real structure from database)
export const hodometro = pgTable("hodometro", {
  id_hodometro: serial("id_hodometro").primaryKey(),
  veiculo_id: integer("veiculo_id").references(() => veiculo.veiculo_id),
  motorista_id: integer("motorista_id").references(() => motorista.motorista_id),
  cliente_id: integer("cliente_id").references(() => cliente.cliente_id),
  data: date("data"),
  hora: text("hora"),
  hod_informado: numeric("hod_informado"),
  hod_lido: numeric("hod_lido"),
  trip_lida: text("trip_lida"),
  trip_informada: text("trip_informada"),
  km_rodado: numeric("km_rodado"),
  verificacao: boolean("verificacao").default(false),
  comparacao_leitura: text("comparacao_leitura"),
  foto_hodometro: text("foto_hodometro"),
  company_id: integer("company_id").references(() => company.company_id),
  bateria: text("bateria"),
});

// Bomba_gasolina table (real structure from database)
export const bomba_gasolina = pgTable("bomba_gasolina", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  data: date("data"),
  hora: text("hora"),
  litro_informado: text("litro_informado"),
  litro_lido: text("litro_lido"),
  preco_informado: text("preco_informado"),
  preco_lido: text("preco_lido"),
  foto_bomba: text("foto_bomba"),
  comparacao_leitura: boolean("comparacao_leitura"),
  motorista_id: bigint("motorista_id", { mode: "number" }).references(() => motorista.motorista_id),
  veiculo_id: bigint("veiculo_id", { mode: "number" }).references(() => veiculo.veiculo_id),
  cliente_id: bigint("cliente_id", { mode: "number" }).references(() => cliente.cliente_id),
  company_id: bigint("company_id", { mode: "number" }).references(() => company.company_id),
  hodometro_id: bigint("hodometro_id", { mode: "number" }).references(() => hodometro.id_hodometro),
});

// Relations
export const motoristaRelations = relations(motorista, ({ one, many }) => ({
  company: one(company, {
    fields: [motorista.company_id],
    references: [company.company_id],
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
  tags: many(motorista_tags),
}));

export const checklistRelations = relations(checklist, ({ one }) => ({
  motorista: one(motorista, {
    fields: [checklist.motorista_id],
    references: [motorista.motorista_id],
  }),
  veiculo: one(veiculo, {
    fields: [checklist.veiculo_id],
    references: [veiculo.veiculo_id],
  }),
  company: one(company, {
    fields: [checklist.company_id],
    references: [company.company_id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  company: one(company, {
    fields: [tags.company_id],
    references: [company.company_id],
  }),
  motoristas: many(motorista_tags),
}));

export const motoristaTagsRelations = relations(motorista_tags, ({ one }) => ({
  motorista: one(motorista, {
    fields: [motorista_tags.motorista_id],
    references: [motorista.motorista_id],
  }),
  tag: one(tags, {
    fields: [motorista_tags.tag_id],
    references: [tags.id],
  }),
}));

export const companyRelations = relations(company, ({ many }) => ({
  motoristas: many(motorista),
  clientes: many(cliente),
  tags: many(tags),
  checklists: many(checklist),
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

export const insertHodometroSchema = createInsertSchema(hodometro).omit({
  id_hodometro: true,
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

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertMotoristaTagSchema = createInsertSchema(motorista_tags).omit({
  id: true,
  created_at: true,
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
export type Hodometro = typeof hodometro.$inferSelect;
export type InsertHodometro = z.infer<typeof insertHodometroSchema>;
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
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type MotoristaTag = typeof motorista_tags.$inferSelect;
export type InsertMotoristaTag = z.infer<typeof insertMotoristaTagSchema>;

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
  company_id: bigint("company_id", { mode: "number" }).references(() => company.company_id),
});

export const operacao = pgTable("operacao", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at"),
  operacao: text("operacao"),
  company_id: bigint("company_id", { mode: "number" }).references(() => company.company_id),
});

export const unidade = pgTable("unidade", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  unidade: text("unidade"),
  company_id: bigint("company_id", { mode: "number" }).references(() => company.company_id),
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
  tipo_contrato: text("tipo_contrato"),
  company_id: integer("company_id").references(() => company.company_id),
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
    references: [company.company_id],
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
    references: [company.company_id],
  }),
}));

export const operacaoRelations = relations(operacao, ({ one }) => ({
  company: one(company, {
    fields: [operacao.company_id],
    references: [company.company_id],
  }),
}));

export const stVagaRelations = relations(st_vaga, ({ one }) => ({
  company: one(company, {
    fields: [st_vaga.company_id],
    references: [company.company_id],
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
  nome: z.string().min(1, "Nome da vaga é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  quantidade: z.string().min(1, "Quantidade é obrigatória"),
  dias_trabalho: z.array(z.string()).min(1, "Selecione pelo menos um dia de trabalho"),
  horario: z.string().min(1, "Horário é obrigatório"),
  company_id: z.number().min(1, "ID da empresa é obrigatório"),
  cliente_id: z.number().min(1, "Cliente é obrigatório"),
  unidade_id: z.number().min(1, "Unidade é obrigatória"),
  operacao_id: z.number().min(1, "Operação é obrigatória"),
  st_vaga_id: z.number().min(1, "Status é obrigatório"),
  dt_limite: z.string().optional(), // Único campo opcional
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

// WiseApp Access table
export const wiseapp_acesso = pgTable("wiseapp_acesso", {
  wiseapp_acesso_id: serial("wiseapp_acesso_id").primaryKey(),
  email: text("email").notNull(),
  nome: text("nome"),
  id_conta_wiseapp: numeric("id_conta_wiseapp").notNull(),
  access_token_wiseapp: text("access_token_wiseapp"),
  created_at: timestamp("created_at").defaultNow(),
});

// Grupo Resumo table - WhatsApp Group Summary
export const grupo_resumo = pgTable("grupo_resumo", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  nome_grupo: text("nome_grupo").notNull(),
  nome_inbox: text("nome_inbox").notNull(),
  horario: text("horario").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  company_id: integer("company_id").notNull().references(() => company.company_id, { onDelete: 'cascade' }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  color_name: text("color_name"),
  icon_name: text("icon_name"),
  atendente_id: integer("atendente_id").references(() => wiseapp_acesso.wiseapp_acesso_id),
  inbox_id: text("inbox_id"),
});

// Envio Resumo table - Summary Sending History
export const envio_resumo = pgTable("envio_resumo", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  grupo_id: bigint("grupo_id", { mode: "number" }).notNull().references(() => grupo_resumo.id),
  data_envio: timestamp("data_envio", { withTimezone: true }).notNull(),
  status: boolean("status").notNull(),
  mensagem: text("mensagem").notNull(),
  resumo_grupo: text("resumo_grupo"),
  company_id: integer("company_id").notNull().references(() => company.company_id, { onDelete: 'cascade' }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Comprovante tables
export const comprovante = pgTable("comprovante", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  company_id: bigint("company_id", { mode: "number" }).references(() => company.company_id),
  motorista_id: bigint("motorista_id", { mode: "number" }).references(() => motorista.motorista_id),
  cliente_id: bigint("cliente_id", { mode: "number" }).references(() => cliente.cliente_id),
  foto_comprovante: text("foto_comprovante"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const end_comprovante_entrega = pgTable("end_comprovante_entrega", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  nr_end: numeric("nr_end"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  id_comprovante: bigint("id_comprovante", { mode: "number" }).references(() => comprovante.id),
  id_logradouro: bigint("id_logradouro", { mode: "number" }).references(() => logradouro.id_logradouro),
  coordenada: text("coordenada"),
});

// Gestão de Risco tables
export const gr_empresa = pgTable("gr_empresa", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  company_id: integer("company_id").references(() => company.company_id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const gr_status = pgTable("gr_status", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  company_id: integer("company_id").references(() => company.company_id),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const gr_motorista = pgTable("gr_motorista", {
  id: serial("id").primaryKey(),
  motorista_id: integer("motorista_id").references(() => motorista.motorista_id).notNull(),
  empresa_id: integer("empresa_id").references(() => gr_empresa.id).notNull(),
  status_id: integer("status_id").references(() => gr_status.id).notNull(),
  motivo: text("motivo"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Relations for Gestão de Risco tables
export const grEmpresaRelations = relations(gr_empresa, ({ one }) => ({
  company: one(company, {
    fields: [gr_empresa.company_id],
    references: [company.company_id],
  }),
}));

export const grStatusRelations = relations(gr_status, ({ one }) => ({
  company: one(company, {
    fields: [gr_status.company_id],
    references: [company.company_id],
  }),
}));

export const grMotoristaRelations = relations(gr_motorista, ({ one }) => ({
  motorista: one(motorista, {
    fields: [gr_motorista.motorista_id],
    references: [motorista.motorista_id],
  }),
  empresa: one(gr_empresa, {
    fields: [gr_motorista.empresa_id],
    references: [gr_empresa.id],
  }),
  status: one(gr_status, {
    fields: [gr_motorista.status_id],
    references: [gr_status.id],
  }),
}));

// Insert schemas for Gestão de Risco tables
export const insertGrEmpresaSchema = createInsertSchema(gr_empresa).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertGrStatusSchema = createInsertSchema(gr_status).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertGrMotoristaSchema = createInsertSchema(gr_motorista).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Types for Gestão de Risco
export type GrEmpresa = typeof gr_empresa.$inferSelect;
export type InsertGrEmpresa = z.infer<typeof insertGrEmpresaSchema>;
export type GrStatus = typeof gr_status.$inferSelect;
export type InsertGrStatus = z.infer<typeof insertGrStatusSchema>;
export type GrMotorista = typeof gr_motorista.$inferSelect;
export type InsertGrMotorista = z.infer<typeof insertGrMotoristaSchema>;

// Comprovante relations
export const comprovanteRelations = relations(comprovante, ({ one, many }) => ({
  company: one(company, {
    fields: [comprovante.company_id],
    references: [company.company_id],
  }),
  motorista: one(motorista, {
    fields: [comprovante.motorista_id],
    references: [motorista.motorista_id],
  }),
  cliente: one(cliente, {
    fields: [comprovante.cliente_id],
    references: [cliente.cliente_id],
  }),
  endereco: many(end_comprovante_entrega),
}));

export const endComprovanteEntregaRelations = relations(end_comprovante_entrega, ({ one }) => ({
  comprovante: one(comprovante, {
    fields: [end_comprovante_entrega.id_comprovante],
    references: [comprovante.id],
  }),
  logradouro: one(logradouro, {
    fields: [end_comprovante_entrega.id_logradouro],
    references: [logradouro.id_logradouro],
  }),
}));

// Insert schemas for Comprovante tables
export const insertComprovanteSchema = createInsertSchema(comprovante).omit({
  id: true,
  created_at: true,
});

export const insertEndComprovanteEntregaSchema = createInsertSchema(end_comprovante_entrega).omit({
  id: true,
  created_at: true,
});

// Types for Comprovante
export type Comprovante = typeof comprovante.$inferSelect;
export type InsertComprovante = z.infer<typeof insertComprovanteSchema>;
export type EndComprovanteEntrega = typeof end_comprovante_entrega.$inferSelect;
export type InsertEndComprovanteEntrega = z.infer<typeof insertEndComprovanteEntregaSchema>;

// Insert schemas for Grupo Resumo
export const insertGrupoResumoSchema = createInsertSchema(grupo_resumo).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertEnvioResumoSchema = createInsertSchema(envio_resumo).omit({
  id: true,
  created_at: true,
});

// Types for Grupo Resumo
export type GrupoResumo = typeof grupo_resumo.$inferSelect;
export type InsertGrupoResumo = z.infer<typeof insertGrupoResumoSchema>;
export type EnvioResumo = typeof envio_resumo.$inferSelect;
export type InsertEnvioResumo = z.infer<typeof insertEnvioResumoSchema>;

// Relations for Grupo Resumo
export const grupoResumoRelations = relations(grupo_resumo, ({ one, many }) => ({
  company: one(company, {
    fields: [grupo_resumo.company_id],
    references: [company.company_id],
  }),
  atendente: one(wiseapp_acesso, {
    fields: [grupo_resumo.atendente_id],
    references: [wiseapp_acesso.wiseapp_acesso_id],
  }),
  envios: many(envio_resumo),
}));

export const envioResumoRelations = relations(envio_resumo, ({ one }) => ({
  grupo: one(grupo_resumo, {
    fields: [envio_resumo.grupo_id],
    references: [grupo_resumo.id],
  }),
  company: one(company, {
    fields: [envio_resumo.company_id],
    references: [company.company_id],
  }),
}));

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
