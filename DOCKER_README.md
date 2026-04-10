# Docker Setup

Este projeto está configurado para rodar em containers Docker com suporte para:

- **Frontend**: React + Vite
- **Backend**: Express.js + TypeScript
- **AI Service**: Python/FastAPI (CrewAI)
- **Banco de Dados**: Supabase (externo) ou PostgreSQL (opcional local)

## 🚀 Início Rápido

### Pré-requisitos
- Docker e Docker Compose instalados
- Arquivo `.env` configurado (veja `.env.example`)

### 1. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### 2. Construir e Iniciar os Serviços

```bash
# Construir e iniciar em modo detached
docker-compose up -d --build

# Ou para ver os logs em tempo real
docker-compose up --build
```

### 3. Acessar a Aplicação

- **Aplicação Principal**: http://localhost:5000
- **AI Service**: http://localhost:8000
- **API Docs (FastAPI)**: http://localhost:8000/docs

## Desenvolvimento com Docker

Para desenvolvimento rápido, use [docker-compose.dev.yml](/Users/gabrielmauro/Documents/CentralDeAutomacao/docker-compose.dev.yml). Esse fluxo não gera imagem de produção e sobe o backend Express com Vite middleware em modo desenvolvimento, com recarga a quente servida na mesma porta `5000`.

### Subir ambiente dev

```bash
docker compose -f docker-compose.dev.yml up
```

### Subir em background

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Parar ambiente dev

```bash
docker compose -f docker-compose.dev.yml down
```

### Como funciona

- O código-fonte é montado no container via volume.
- As dependências Node ficam em um volume nomeado para evitar `npm ci` completo a cada subida.
- O comando `npm run dev` agora usa `tsx watch`, então mudanças no backend reiniciam o servidor.
- O frontend continua sendo servido pelo Vite middleware embutido no Express, então o acesso segue por `http://localhost:5000`.

## 📁 Estrutura dos Arquivos Docker

### Dockerfile
Multi-stage build otimizado:
- **Stage 1**: Build da aplicação (Node.js)
- **Stage 2**: Runtime de produção com Python + Node.js

### docker-compose.yml
Define os serviços:
- `app`: Serviço principal com frontend + backend + AI service
- `postgres`: (opcional) PostgreSQL local
- `redis`: (opcional) Redis para sessões

### .dockerignore
Otimizado para ignorar arquivos desnecessários e reduzir o tamanho da imagem.

## 🔧 Comandos Úteis

```bash
# Ver status dos containers
docker-compose ps

# Ver logs
docker-compose logs -f app

# Parar os serviços
docker-compose down

# Reconstruir imagem
docker-compose build --no-cache

# Executar comandos no container
docker-compose exec app sh

# Limpar volumes (cuidado!)
docker-compose down -v
```

## 🌍 Variáveis de Ambiente

### Obrigatórias
- `DATABASE_URL`: URL do banco de dados
- `SUPABASE_URL`: URL do Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `SESSION_SECRET`: Segredo para sessões

### Opcionais
- `PORT`: Porta da aplicação (default: 5000)
- `NODE_ENV`: Ambiente (default: production)

### Build-time (Vite)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CHAT_API_URL`
- `VITE_CHAT_API_KEY`
- `VITE_CHAT_ACCOUNT_ID`

## 🐛 Troubleshooting

### Problemas Comuns

1. **Porta já em uso**
   ```bash
   # Verificar processos na porta 5000
   lsof -i :5000
   # Ou usar outra porta
   PORT=3000 docker-compose up
   ```

2. **Permissões do docker-entrypoint.sh**
   ```bash
   chmod +x docker-entrypoint.sh
   ```

3. **Build lento**
   - O primeiro build pode demorar por baixar dependências
   - Builds subsequentes são mais rápidos devido ao cache de camadas

4. **AI Service não inicia**
   ```bash
   # Ver logs específicos do AI service
   docker-compose exec app cat /app/ai_service/logs/*
   ```

### Desenvolvimento vs Produção

Para desenvolvimento local, pode ser mais rápido usar:
```bash
npm run dev
```

O Docker é recomendado para:
- Ambientes de produção
- Consistência entre diferentes máquinas
- CI/CD pipelines
- Deploy em nuvem

## 📊 Monitoramento e Saúde

### Health Checks
- Container principal: Verifica HTTP na porta 5000
- Intervalo: 30 segundos
- Timeout: 10 segundos
- Tentativas: 3

### Logs
- Logs da aplicação: `docker-compose logs app`
- Logs do AI service: `docker-compose exec app tail -f /app/ai_service/logs/*`

## 🔒 Segurança

- Segredos são passados em runtime (não na imagem)
- `.dockerignore` evita leak de arquivos sensíveis
- Usuário não-root no container de produção
- Apenas portas necessárias expostas

## 🚀 Deploy

### AWS ECS
```bash
# Push para ECR
docker-compose -f docker-compose.prod.yml push
```

### DigitalOcean App Platform
- Conectar repositório Git
- Configurar variáveis de ambiente
- Deploy automático

### Railway/Vercel
- Usar Dockerfile existente
- Configurar variáveis de ambiente no painel
