# Automação WhatsApp — Dionizio Transportes

Documento de referência para quem for montar o bot/fluxo de automação (ex.: n8n) do menu de WhatsApp da Dionizio Transportes. Descreve, para cada opção do menu, **em qual tabela do banco (Supabase) a resposta deve ser gravada** e **qual consulta/insert a automação precisa executar**. Nada aqui foi criado ou rodado — é só a especificação. Onde o fluxo do bot não bate 100% com o schema atual, isso está sinalizado explicitamente como **lacuna/sugestão**, sem aplicar nada.

Tabelas atuais de referência: `scripts/setup-dionizio-transportes.sql` (schema já criado no Supabase pelo usuário).

## 1. Visão geral

| Opção do menu | Tabela do banco | Grava no banco? |
|---|---|---|
| Nossos Serviços / Contatos Comerciais | — | Não — puramente informativo |
| Financeiro → Pagamento de Descarga | `dionizio_solicitacoes_financeiras` *(não existe ainda — ver §4)* | Sim, quando a tabela existir |
| Financeiro → Abastecimento fora do Mime | `dionizio_solicitacoes_financeiras` *(não existe ainda — ver §4)* | Sim, quando a tabela existir |
| Financeiro → Pagamento Borracharia | `dionizio_solicitacoes_financeiras` *(não existe ainda — ver §4)* | Sim, quando a tabela existir |
| Financeiro → Outros pagamentos | `dionizio_solicitacoes_financeiras` *(não existe ainda — ver §4)* | Sim, quando a tabela existir |
| Departamento Pessoal → Envio de Currículo | — | Não — só encaminhar (e-mail/notificação) |
| Departamento Pessoal → Envio de Documentos | — | Não — só encaminhar (e-mail/notificação) |
| Departamento Pessoal → Mais informações | — | Não — só encaminhar |
| Operacional → Controle de Abastecimento | `dionizio_abastecimentos` | Sim, parcial (ver §6.1) |
| Operacional → Controle de Entregas | `dionizio_viagens` | Sim, upsert (ver §6.2) |
| Operacional → Aviso de Ocorrência (Guincho/Incidente/Problema com mercadoria) | `dionizio_ocorrencias` | Sim, após estender a tabela (ver §6.3) |
| Solicitação de Hotel | `dionizio_hoteis` | Sim, parcial (ver §6.4) |
| Cotações | — | Não — só encaminhar (e-mail/notificação) |

## 2. Padrão de identificação (reutilizado em todo o fluxo)

O bot roda no WhatsApp, então quem está mandando a mensagem é sempre um motorista com um número de telefone. Esse número deve ser usado para resolver `motorista_id` automaticamente, sem precisar perguntar "qual é o seu nome" toda vez.

**Motorista pelo telefone:**
```sql
select id
from dionizio_motoristas
where regexp_replace(telefone, '[^0-9]', '', 'g')
    = regexp_replace(:numero_whatsapp, '[^0-9]', '', 'g')
limit 1;
```
> Se não encontrar nenhum motorista com esse telefone, o bot deve avisar "motorista não cadastrado" e não seguir com o insert (ou registrar `motorista_id = null` onde a coluna permitir, dependendo do fluxo).

**Veículo pela placa** (mesma normalização usada no resto do app — minúsculas, sem espaço):
```sql
select id
from dionizio_veiculos
where placa = lower(trim(:placa_informada))
limit 1;
```

**Cliente/Empresa pelo nome** (usado em Controle de Entregas) — upsert, mesmo padrão do `motoristas_jpd` do painel JPD:
```sql
insert into dionizio_clientes (nome)
values (trim(:empresa))
on conflict (nome) do nothing;

select id from dionizio_clientes where nome = trim(:empresa) limit 1;
```
> **Nota:** hoje `dionizio_clientes.nome` não tem constraint `UNIQUE`, então o `ON CONFLICT` acima não funciona ainda — é preciso adicionar `UNIQUE` nessa coluna (listado no resumo de gaps, §8) antes de usar esse padrão.

## 3. Nossos Serviços / Contatos Comerciais

Missão/Visão/Valores, Serviços Carga Fechada, Serviços Guincho, Contatos — tudo texto estático mostrado pelo próprio bot. **Não grava nada no banco.**

## 4. Financeiro (Solicitações)

As 4 subopções (Pagamento de Descarga, Abastecimento fora do Mime, Pagamento Borracharia, Outros pagamentos) pedem praticamente os mesmos campos: Placa, Valor, um campo que varia (Carga ou Km), e a Chave Pix para o pagamento.

**Lacuna:** não existe hoje nenhuma tabela equivalente a "solicitação financeira/pagamento pendente", nem coluna de chave Pix em nenhuma tabela `dionizio_*`. `dionizio_descargas` e `dionizio_abastecimentos` representam **operações já realizadas** (com nota fiscal, litros, etc.), não **pedidos de pagamento** — são conceitos diferentes, por isso não fazem sentido como destino desses 4 itens.

**Sugestão** (schema ainda não criado — para o usuário decidir se quer aplicar):
```sql
create table if not exists public.dionizio_solicitacoes_financeiras (
  id             serial primary key,
  tipo           text not null, -- 'descarga' | 'abastecimento_fora_rede' | 'borracharia' | 'outros'
  motorista_id   integer references public.dionizio_motoristas(id),
  veiculo_id     integer references public.dionizio_veiculos(id),
  valor          numeric not null,
  km             numeric,          -- usado em abastecimento_fora_rede e borracharia
  carga          text,             -- usado em pagamento de descarga e outros pagamentos
  chave_pix      text not null,
  status         text not null default 'pendente', -- pendente | pago | recusado
  origem         text default 'whatsapp',
  created_at     timestamp default now()
);
alter table public.dionizio_solicitacoes_financeiras disable row level security;
```

Insert que o bot faria, uma vez essa tabela existindo (exemplo para "Abastecimento fora do Mime"):
```sql
insert into dionizio_solicitacoes_financeiras
  (tipo, motorista_id, veiculo_id, valor, km, chave_pix)
values
  ('abastecimento_fora_rede', :motorista_id, :veiculo_id, :valor, :km, :chave_pix);
```
Para "Pagamento de Descarga" e "Outros pagamentos", trocar `km` por `carga` (o texto informado em "Preencher Carga") e `tipo` por `'descarga'` / `'outros'`. Para "Pagamento Borracharia", usar `tipo = 'borracharia'` e preencher `km`.

## 5. Departamento Pessoal

- **Envio de Currículo** (Currículo + E-mail) e **Envio de Documentos** (CNH, Comprovante de Residência, Certificado de Reservista, Número PIS, Carteira de Trabalho Digital + E-mail): por decisão do usuário, **não precisa gravar na plataforma** — a automação deve apenas encaminhar os arquivos/e-mail recebidos (ex.: e-mail para o RH, ou notificação em um canal interno). Nenhuma tabela envolvida.
- **Mais informações** (texto livre): mesmo tratamento — só encaminhar, sem persistência.

## 6. Operacional (Solicitações)

### 6.1 Controle de Abastecimento (Foto, Placa, Km)

Mapeia para `dionizio_abastecimentos`, mas só com uma fração dos campos que a tela do painel usa.

```sql
insert into dionizio_abastecimentos
  (veiculo_id, quilometragem_atual, nota_fiscal_url, data_abastecimento)
values
  (:veiculo_id, :km, :foto_url, current_date);
```

**Lacuna:** hoje `litros`, `valor_total` e `local_abastecimento` são `NOT NULL` em `dionizio_abastecimentos`, então esse insert vai falhar até essas 3 colunas virarem opcionais (`ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL`). A ideia é o registro entrar "incompleto" e alguém completar os valores depois direto na tela do painel.

### 6.2 Controle de Entregas (Empresa, N° Viagem, Data Saída, Data Retorno, Horário Saída, Horário Retorno, N° entrega Realizada, N° entrega Escala)

Mapeia para `dionizio_viagens`. Como o fluxo do bot é usado tanto para abrir uma viagem quanto para atualizar o progresso de entregas de uma viagem já em andamento, o comportamento correto é um **upsert por referência + motorista**:

```sql
-- 1) resolve motorista pelo telefone (ver §2)
-- 2) resolve veículo pela placa — pergunta nova a ser adicionada no fluxo do bot (ver observação abaixo)
-- 3) resolve/cria cliente pelo nome da Empresa (ver §2)

-- 4) tenta achar a viagem já existente:
select id from dionizio_viagens
where referencia = :numero_viagem
  and motorista_id = :motorista_id
limit 1;
```

Se **encontrar** (viagem já existe, bot está só atualizando o progresso):
```sql
update dionizio_viagens set
  horario_saida = coalesce(:horario_saida, horario_saida),
  horario_retorno = coalesce(:horario_retorno, horario_retorno),
  entregas_estimadas = :entregas_escala,
  entregas_realizadas = :entregas_realizada,
  updated_at = now()
where id = :viagem_id;
```

Se **não encontrar** (bot está abrindo uma viagem nova):
```sql
insert into dionizio_viagens
  (referencia, origem, cliente_id, data_saida, data_retorno,
   horario_saida, horario_retorno, veiculo_id, motorista_id,
   entregas_estimadas, entregas_realizadas, status)
values
  (:numero_viagem, :empresa, :cliente_id, :data_saida, :data_retorno,
   :horario_saida, :horario_retorno, :veiculo_id, :motorista_id,
   :entregas_escala, :entregas_realizada, 'em_andamento');
```

> **Observação importante:** o fluxo do bot enviado pelo usuário **não pergunta a Placa do veículo**, mas `dionizio_viagens.veiculo_id` é `NOT NULL`. Por decisão do usuário, a automação deve **adicionar uma pergunta de Placa** nesse ponto do fluxo (junto com Empresa/N° Viagem) para conseguir resolver `veiculo_id`. `origem` também não é perguntado — sugerido usar o próprio nome da Empresa como valor de `origem` até existir um campo melhor (ou perguntar Origem/Destino também, se fizer sentido no fluxo real).

### 6.3 Aviso de Ocorrência (Guincho / Incidente / Problema com mercadoria)

Mapeia para `dionizio_ocorrencias`, mas essa tabela hoje só tem os tipos `Avaria`, `Acidente`, `Multa`, `Manutenção`, e não tem colunas `local` nem `km` (só tem `tipo_evento`, `data`, `veiculo_id`, `gravidade`, `status`, `descricao_detalhada`, `observacoes_gerais`, `fotos`).

**Extensão sugerida** (aprovada pelo usuário, ainda não aplicada):
```sql
alter table public.dionizio_ocorrencias
  add column if not exists local text,
  add column if not exists km numeric;
```
> `tipo_evento` já é `text` livre (não é um enum no Postgres), então "Guincho", "Incidente" e "Problema com mercadoria" já podem ser gravados sem alteração de schema — só precisam ser adicionados como opções na tela do painel (`client/src/pages/dionizio-transportes/DionizioOcorrenciaForm.tsx`, array `TIPOS_EVENTO`) para aparecerem também na edição manual.

Insert que o bot faria (comum aos 3 subtipos, variando `tipo_evento`):
```sql
insert into dionizio_ocorrencias
  (tipo_evento, data, veiculo_id, local, km, descricao_detalhada, fotos, status)
values
  (:tipo_evento, current_date, :veiculo_id, :local, :km, :relato, :fotos_array, 'pendente');
```
Onde `:tipo_evento` é `'Guincho'`, `'Incidente'` ou `'Problema com mercadoria'`, e `:fotos_array` é um array JSON de URLs (`['https://.../foto1.jpg']`) — igual ao campo `fotos` já usado pela tela de Ocorrências.

### 6.4 Solicitação de Hotel (Placa, Cidade)

Mapeia para `dionizio_hoteis`, também parcial.

```sql
insert into dionizio_hoteis
  (data, veiculo_id, motorista_id, local)
values
  (current_date, :veiculo_id, :motorista_id, :cidade);
```

**Lacuna:** `nome_hotel` e `valor_hotel` são `NOT NULL` hoje em `dionizio_hoteis`. Esse insert só funciona depois que essas 2 colunas virarem opcionais (`DROP NOT NULL`) — o registro entra como "solicitação" e alguém completa nome do hotel e valor depois, na tela do painel.

## 7. Cotações (Peso, Local Saída, Local Chegada, Foto)

Não existe tabela para cotações hoje. Por decisão do usuário, **não precisa gravar na plataforma** — a automação deve encaminhar essas informações (ex.: e-mail/notificação para o time comercial), sem persistir no banco.

## 8. Resumo consolidado de gaps de schema (nada disso foi aplicado)

Para o usuário avaliar e decidir quando/se quer rodar:

```sql
-- Controle de Abastecimento (bot) precisa que estas colunas aceitem NULL:
alter table public.dionizio_abastecimentos alter column litros drop not null;
alter table public.dionizio_abastecimentos alter column valor_total drop not null;
alter table public.dionizio_abastecimentos alter column local_abastecimento drop not null;

-- Solicitação de Hotel (bot) precisa que estas colunas aceitem NULL:
alter table public.dionizio_hoteis alter column nome_hotel drop not null;
alter table public.dionizio_hoteis alter column valor_hotel drop not null;

-- Aviso de Ocorrência (bot) precisa de duas colunas novas:
alter table public.dionizio_ocorrencias add column if not exists local text;
alter table public.dionizio_ocorrencias add column if not exists km numeric;

-- Upsert de Cliente/Empresa (Controle de Entregas) precisa de UNIQUE em nome:
alter table public.dionizio_clientes add constraint dionizio_clientes_nome_uk unique (nome);

-- Financeiro (Solicitações) precisa de uma tabela nova — ver §4 para o CREATE TABLE completo:
-- dionizio_solicitacoes_financeiras
```

Também vale considerar um índice para acelerar a busca por telefone normalizado (usada em quase todo o fluxo):
```sql
create index if not exists dionizio_motoristas_telefone_idx
  on public.dionizio_motoristas (regexp_replace(telefone, '[^0-9]', '', 'g'));
```
