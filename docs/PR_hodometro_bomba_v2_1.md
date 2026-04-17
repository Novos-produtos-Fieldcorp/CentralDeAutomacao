# Pull Request — Fluxo Hodômetro + Bomba de Combustível v2

**Projeto:** MB Transportes  
**Fluxo:** Registro de Hodômetro e Abastecimento via WhatsApp  
**Ferramentas:** Typebot + n8n + Supabase  
**Data:** 2026-04-17  

---

## Resumo

Correções e melhorias no fluxo de registro de hodômetro e bomba de combustível, com foco em garantir que o `hodometro_id` seja corretamente capturado após o INSERT no Supabase e propagado até o webhook do n8n que salva os dados da bomba.

---

## Problema Identificado

O campo `hodometro_id` chegava sempre como `null` no webhook n8n `salva-bomba`, impedindo o vínculo correto entre o registro de hodômetro e o abastecimento no banco de dados Supabase.

### Causa Raiz

O Typebot estava tentando capturar o `id` do hodômetro com o path `data[0].id`, porém a tabela `hodometro` no Supabase utiliza o nome de coluna `id_hodometro` — não `id`. Por isso a variável `id_hodometro` nunca recebia valor e era enviada como `null` para o n8n.

---

## Mudanças Realizadas

### 1. Correção do path de captura do `id_hodometro` no Typebot

**Onde:** Bloco "Save in variables" do request POST do hodômetro  
**Antes:** `data[0].id`  
**Depois:** `data[0].id_hodometro`

O retorno real do Supabase confirmado via "Test the request":

```json
{
  "statusCode": 201,
  "data": [
    {
      "id_hodometro": 1983,
      "data": "2026-04-17",
      "hora": "10:00:00",
      ...
    }
  ]
}
```

O campo correto é `id_hodometro`, não `id`.

---

### 2. Validação da configuração do bloco "Save in variables"

Confirmado que o bloco estava corretamente configurado com:

- **Value:** `Custom`
- **Modo:** `Code` (não `Text`) — necessário para avaliar a expressão como código
- **Save in results:** ativado
- **Expressão:** `data[0].id_hodometro`

---

### 3. Validação do header `Prefer: return=representation` no POST do hodômetro

Confirmado que o header estava presente e correto, garantindo que o Supabase retorne o registro criado com todos os campos (incluindo `id_hodometro`) na resposta do INSERT.

---

### 4. Validação do body do POST da bomba no Typebot

Confirmado que o campo `hodometro_id` estava presente no body enviado ao n8n:

```json
{
  "data": "{{data}}",
  "hora": "{{hora}}",
  "litro_informado": "{{litros}}",
  "litro_lido": "{{litros_lido}}",
  "preco_informado": "{{preço}}",
  "preco_lido": "{{preco_lido}}",
  "cliente_id": "{{cliente_id}}",
  "motorista_id": "{{motorista_id}}",
  "veiculo_id": "{{veiculo_id}}",
  "company_id": "{{company_id}}",
  "hodometro_id": "{{id_hodometro}}",
  "foto_bomba": "{{foto_bomba}}"
}
```

---

### 5. Correção do fuso horário — padronização para `America/Sao_Paulo`

**Onde:** Bloco de código que gera a `hora` no Typebot  
**Antes:** `America/Recife`  
**Depois:** `America/Sao_Paulo`

Recife não observa horário de verão, causando defasagem de 1 hora entre os campos `data` e `hora` durante o verão brasileiro (outubro–fevereiro).

**Código corrigido — Hora:**

```js
const dataAtual = new Date();
const d = new Date(dataAtual.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

const horas = d.getHours();
const minutos = d.getMinutes();
const segundos = d.getSeconds();

return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
```

**Código corrigido — Data:**

```js
const dataAtual = new Date();
const d = new Date(dataAtual.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

const dia = d.getDate();
const mes = d.getMonth() + 1;
const ano = d.getFullYear();

return `${ano}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
```

---

## Fluxo de Dados — Após Correções

```
Motorista envia foto do hodômetro
        ↓
Typebot: POST /hodometro → Supabase
  body: { data, hora, hod_informado, hod_lido, motorista_id, veiculo_id, ... }
  header: Prefer: return=representation
        ↓
Supabase retorna: [{ id_hodometro: 1983, ... }]
        ↓
Typebot captura: data[0].id_hodometro → salva em id_hodometro ✅
        ↓
Motorista envia foto da bomba
        ↓
Typebot: POST /salva-bomba → n8n
  body: { ..., hodometro_id: 1983, foto_bomba: "url..." }
        ↓
n8n: valida campos → POST /bomba_gasolina → Supabase
  body: { hodometro_id: 1983, ... } ✅
```

---

## Webhook n8n — `salvar-bomba-combustivel`

O workflow n8n permanece inalterado. Ele recebe o payload via webhook POST em `/salva-bomba`, processa os campos via Code node e insere no Supabase na tabela `bomba_gasolina`.

**Campos esperados no payload:**

| Campo | Tipo | Descrição |
|---|---|---|
| `data` | string | Data do abastecimento (YYYY-MM-DD) |
| `hora` | string | Hora do abastecimento (HH:MM:SS) |
| `litro_informado` | string | Litros digitados pelo motorista |
| `litro_lido` | string | Litros lidos pela IA |
| `preco_informado` | string | Preço digitado pelo motorista |
| `preco_lido` | string | Preço lido pela IA |
| `cliente_id` | number | ID do cliente |
| `motorista_id` | number | ID do motorista |
| `veiculo_id` | number | ID do veículo |
| `company_id` | number | ID da empresa |
| `hodometro_id` | number | ID do hodômetro vinculado ✅ |
| `foto_bomba` | string | URL da foto da bomba |

---

---

## Melhorias de UX — Mensagens ao Motorista

As mensagens exibidas ao motorista foram revisadas com adição de emojis e negrito para facilitar a leitura e reduzir erros de interpretação no WhatsApp.

### Solicitação de foto do hodômetro

**Antes:**
> Agora preciso que você tire uma foto do hodômetro (painel interno do veículo).

**Depois:**
> Agora preciso que você tire uma foto do **hodômetro** (painel interno do veículo). 🚗📊

---

### Primeiro registro do veículo — aviso de atenção

**Antes:**
> Hodômetro lido: [Km_Lido] km. Este valor será a base de todos os próximos registros. Confirme com atenção antes de prosseguir. As informações acima estão corretas?

**Depois:**
> ⚠️ **Primeiro registro deste veículo!**
> Hodômetro lido: **[Km_Lido]** km
> *(Aviso)* Este valor será a base de todos os próximos registros. **Confirme com atenção** antes de prosseguir.
> As informações acima estão corretas?

---

### Valor lido parece menor que histórico

**Antes:**
> O valor lido parece menor. Por favor, tente enviar novamente a foto.

**Depois:**
> Último hodômetro registrado foi: **[ultimo_hodometro]**
> O valor lido parece menor. Por favor, tente enviar novamente a foto.

---

### Imagem ilegível — solicitação de digitação manual (bomba)

**Antes:**
> Não conseguimos ler a imagem. Por favor, digite o preço da bomba.

**Depois:**
> Infelizmente não conseguimos ler a imagem.
> 🟢 Por favor, **digite o preço da bomba**. Exemplo: 1.500,00

---

### Digitação manual de litros

**Depois:**
> 🟢 Por favor, **digite os litros da bomba**. Exemplo: 100,00

---

### Confirmação de dados — hodômetro

**Antes:**
> Esses foram os dados que conseguimos extrair da leitura: Quilometragem: [Km_Lido] km. As informações acima estão corretas?

**Depois:**
> Pronto! 🎉
> Esses foram os dados que conseguimos extrair da leitura:
> Quilometragem: **[Km_Lido]** km
> As informações acima estão corretas?

---

### Confirmação de dados — bomba (validação cruzada)

**Depois:**
> Os valores lidos não parecem consistentes entre si. ⚠️
> Valor lido: R$ **[preco_lido]**
> Litros lidos: **[litros_lido]** l
> Se estiver correto, confirme. Caso contrário, tire nova foto ou corrija manualmente.
> Responda com um número correspondente:
> 1 - Está correto
> 2 - Tirar uma nova foto
> 3 - Escrever manualmente

---

### Mensagem de não conseguiu ler o hodômetro

**Antes:**
> Não consegui ler o hodômetro. Tire uma nova foto mais próxima do display.

**Depois:**
> Não consegui ler o hodômetro. **Tire uma nova foto mais próxima do display.**

---

### Mensagem de não conseguiu confirmar a leitura

**Depois:**
> Não consegui confirmar a leitura. **Tire uma nova foto mais próxima do display.**

---

### Encerramento do fluxo

**Depois:**
> Obrigado por enviar os dados do seu **Hodômetro e Bomba!**
> Até a próxima! 👋 😊

---

## Pendências Recomendadas

- **Rotacionar chaves de API do Supabase** — as chaves `apikey` e `Authorization` estão expostas no workflow n8n. Recomendado rotacionar e armazenar em variáveis de ambiente do n8n.
- **Validação histórica do hodômetro** — comparar a leitura atual com o último valor registrado para o veículo e bloquear automaticamente saltos implausíveis.
- **Limite de tentativas para foto ilegível** — definir máximo de reenvios antes de forçar digitação manual.
- **Verificação de duplicidade** — checar `veiculo_id + data` antes do INSERT para evitar registros duplicados no mesmo dia.
