# replit.md

## Overview

This is a full-stack web application built with React (frontend) and Express.js (backend) that appears to be a fleet management system. The application manages drivers (motoristas), vehicles (veiculos), clients (clientes), and various operational features like checklists and odometer readings. It uses PostgreSQL with Drizzle ORM for data persistence and integrates with external services like Supabase for additional functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and bundling
- **Styling**: Tailwind CSS with custom dark mode implementation
- **UI Components**: Radix UI components with shadcn/ui design system
- **State Management**: React Context API for authentication, themes, and chat functionality
- **Routing**: React Router for client-side navigation
- **HTTP Client**: TanStack Query for server state management

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **Development**: Hot reload with Vite middleware integration
- **Session Management**: In-memory storage with plans for database storage

### Build and Development
- **Development**: Uses tsx for TypeScript execution and Vite dev server
- **Production**: esbuild for backend bundling, Vite for frontend building
- **Module System**: ES modules throughout the stack

## Key Components

### Authentication & Authorization
- Context-based authentication system using account IDs from URL parameters
- Company-based access control with module permissions
- WiseApp integration for external authentication
- Admin panel with password protection for system management

### Database Layer
- Drizzle ORM with PostgreSQL dialect
- Schema defined in `shared/schema.ts` with Zod validation
- Connection pooling using Neon's serverless driver
- Database migrations stored in `./migrations` directory

### UI/UX Framework
- Comprehensive component library based on Radix UI primitives
- Dark/light theme toggle with localStorage persistence
- Responsive design with mobile-first approach
- Custom CSS variables for theme consistency

### Fleet Management Features
- Driver management with document upload capabilities
- Vehicle tracking and maintenance records
- Client relationship management
- Checklist system for operational compliance
- Odometer reading tracking

## Data Flow

### Frontend to Backend
1. React components make API calls through custom hooks
2. TanStack Query handles caching and synchronization
3. Company-filtered queries ensure data isolation
4. Context providers manage global state (auth, theme, chat)

### Database Operations
1. Drizzle ORM provides type-safe database queries
2. Schema validation using Zod for data integrity
3. Connection pooling optimizes database performance
4. Migrations handle schema evolution

### External Integrations
1. Supabase integration for additional data services
2. WiseApp API integration for messaging/chat functionality
3. Document storage and retrieval system
4. Excel import/export capabilities

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: @radix-ui components, @tanstack/react-query
- **Development Tools**: Vite, TypeScript, Tailwind CSS
- **Database**: drizzle-orm, @neondatabase/serverless
- **Validation**: Zod for schema validation

### Third-party Services
- **Supabase**: For additional database services and real-time features
- **WiseApp**: For messaging and communication features
- **Excel Processing**: xlsx library for import/export functionality
- **Date Handling**: date-fns for date manipulation and formatting

### UI Enhancement Libraries
- **Icons**: Lucide React for consistent iconography
- **Forms**: React Hook Form with resolvers
- **Notifications**: React Hot Toast for user feedback
- **Styling**: Class Variance Authority for component variants

## Deployment Strategy

### Development Environment
- Vite dev server with HMR (Hot Module Replacement)
- tsx for TypeScript execution without compilation
- Environment variables for database and API configuration
- Replit-specific plugins for development optimization

### Production Build
- Frontend: Vite builds to `dist/public` directory
- Backend: esbuild bundles server code to `dist` directory
- Static file serving through Express in production
- ES module format maintained throughout the build process

### Netlify Deployment
- **Configuration**: `netlify.toml` with build settings and redirects
- **Functions**: Serverless functions in `netlify/functions/` directory
- **Build Command**: `npm run build`
- **Publish Directory**: `dist/public`
- **Environment Variables**: Configured in Netlify dashboard
- **Database**: PostgreSQL connection through environment variables
- **API Routes**: Handled by Netlify Functions with `/api/*` redirects
- **Iframe Support**: Configured to allow embedding via Content-Security-Policy headers

### Database Management
- Drizzle Kit for migrations: `npm run db:push`
- Environment-based configuration for different deployment stages
- Connection string management through DATABASE_URL environment variable

### Scaling Considerations
- Serverless-ready database connection pooling
- Stateless backend design for horizontal scaling
- CDN-ready static asset organization
- Component-based architecture for code splitting
- Netlify Functions for API scaling

## Iframe Configuration (Janeiro 2025)

A aplicação foi configurada para permitir embedding em iframe através das seguintes modificações:

### Servidor Express (server/index.ts)
- Removido header X-Frame-Options restritivo
- Adicionado Content-Security-Policy com frame-ancestors *
- Headers aplicados a todas as rotas

### Configuração Netlify (netlify.toml)
- Removido X-Frame-Options = "DENY"
- Adicionado Content-Security-Policy = "frame-ancestors *;"
- Headers aplicados globalmente

### Função Serverless (netlify/functions/api.js)
- Adicionado Content-Security-Policy aos headers da API
- Configuração aplicada a todas as respostas

### Teste de Iframe
- Arquivo test-iframe.html criado para validação
- Aplicação pode ser embutida em qualquer domínio

## Resolução de Conflitos de Merge (Janeiro 2025)

### Problema Inicial
- Múltiplos conflitos de merge impedindo push/merge das alterações
- Erros de TypeScript relacionados a conversões de telefone
- Imports faltantes de componentes WiseApp
- Lock file do git impedindo operações

### Soluções Implementadas
- Resolvidos todos os conflitos de merge mantendo conteúdo da seção especificada
- Corrigidas conversões de `telefone?.toString()` para `String(telefone)`
- Adicionadas importações faltantes: WiseAppBulkSyncPanel, WiseAppSyncButton
- Instalada dependência cross-env que estava ausente
- Aplicação funcionando perfeitamente na porta 5000

### Arquivos Principais Corrigidos
- `client/src/pages/contratacao/MotoristasLista.tsx`: Conversões de telefone
- `client/src/context/AuthContext.tsx`: Imports WiseApp
- `client/src/index.css`: Conflitos de CSS removidos
- `package.json`: Dependência cross-env adicionada
- Múltiplos arquivos: Marcadores de merge <<<< >>>> removidos

### Status Final
- ✅ Aplicação rodando sem erros
- ✅ Todos os conflitos resolvidos
- ✅ TypeScript sem erros
- ✅ Dependências instaladas
- ⚠️ Requer resolução manual do git lock para push

## Correções de Chat (Janeiro 2025)

### Problema de Cache HTTP 304
- Headers de cache-busting adicionados no frontend e backend
- Requisições forçadas sem cache usando timestamps
- Headers no-cache aplicados em respostas da API

### Proxy da API WiseApp
- Proxy criado em `/api/api/v1/*` para redirecionar para API externa
- Todas as instâncias do axios configuradas para usar o proxy local
- Headers de autenticação mantidos através do proxy
- Função Netlify atualizada com proxy para WiseApp API
- Suporte completo para produção via netlify/functions/api.js

### Configuração Netlify (netlify.toml)
- Redirects específicos para `/api/api/v1/*` com force=true
- Headers no-cache aplicados para todas as rotas `/api/*`
- Configuração de funções serverless com esbuild
- Ordem correta de redirects (mais específicos primeiro)

## Upload de Documentos do Proprietário (Janeiro 2025)

### Sistema de Upload
- Substituído uso do DocumentUploader por upload direto no bucket `imagensdocs`
- Upload de foto de documento (RG/CNH) para proprietários pessoa física
- Upload de comprovante de residência para ambos os tipos de proprietários
- URLs salvos nas colunas corretas das tabelas do banco de dados

### Funcionalidades Implementadas
- Upload direto ao Supabase Storage bucket `imagensdocs`
- Validação de tipo de arquivo (JPEG, PNG, PDF)
- Validação de tamanho (máximo 15MB)
- Nomeação única de arquivos com timestamp
- Salvamento automático de URLs públicos no banco de dados

### Estrutura do Banco de Dados
- Tabela `pessoa_fisica_dono_veiculo`: colunas `foto_documento` e `comprovante_residencia`
- Tabela `pessoa_juridica_dono_veiculo`: coluna `comprovante_residencia`
- URLs dos documentos armazenados como texto no banco

### Correções de Upsert (Janeiro 2025)
- Corrigido problema de múltiplas inserções no banco de dados
- Implementado sistema de upsert (insert ou update) para dados do proprietário
- Verificação prévia de registros existentes antes de inserir
- Prevenção de registros duplicados para o mesmo documento de veículo
- Busca limitada a 1 registro para evitar erro de múltiplas linhas

## Exibição de Proprietário do Veículo para Agregados (Janeiro 2025)

### Funcionalidade Implementada
- Busca e exibição de informações do proprietário do veículo apenas no modal de agregados
- Relacionamento: motorista → veículo → documento_veiculo → pessoa_fisica/juridica_dono_veiculo
- Exibição na aba "Documentos" do UnifiedAgregadoModal
- Suporte a proprietários pessoa física e pessoa jurídica

### Dados Exibidos
- **Pessoa Física**: nome, CPF, RG, órgão expedidor, nomes dos pais, documentos
- **Pessoa Jurídica**: razão social, CNPJ, inscrição estadual, comprovante de endereço
- Links para visualização de documentos armazenados no Supabase Storage
- Preview de imagens quando não são PDFs

## Correção de Comentários no Modal de Motoristas (Janeiro 2025)

### Problema Identificado
- Aba comentários no UnifiedMotoristaModal resetava automaticamente para "details"
- Problema causado pelo callback `onSuccess` do ComentariosTab que chamava `fetchMotoristas`
- `fetchMotoristas` causava re-renderização do componente pai, resetando o estado do modal

### Solução Implementada
- Removido `onSuccess?.()` do callback `onUpdateSuccess` do ComentariosTab
- Mantido apenas `fetchComentariosCount()` para atualizar contador de comentários
- Implementado sistema useRef para controle de inicialização mais robusto
- Adicionada key estável ao modal baseada no motorista_id para evitar remontagens

### Resultado
- Aba comentários agora funciona corretamente sem reset automático
- Mantida funcionalidade de atualização do contador de comentários
- Sistema mais estável e performático

## Integração CPF API em Formulários de Ajudante e Proprietário de Veículo (Janeiro 2025)

### Funcionalidade Implementada
- Criado serviço reutilizável `client/src/utils/cpfService.ts` para consulta de CPF
- API endpoint: `https://api.gw.cellereit.com.br/bg-check/cpf-completo?cpf=${cpf}`
- Integração em três componentes principais:
  - `AddAjudanteModal.tsx`: Adição de novos ajudantes
  - `EditAjudanteModal.tsx`: Edição de ajudantes existentes
  - `DocumentoMotoristaForm.tsx`: Formulário de proprietário pessoa física do veículo

### Dados Preenchidos Automaticamente
- **Pessoa Física**: nome, telefone, endereço completo (logradouro, número, complemento, bairro, cidade, estado, CEP)
- **Validação**: CPF deve conter exatamente 11 dígitos
- **Trigger**: onBlur no campo CPF quando possui 11 dígitos
- **Feedback**: Toast de sucesso ou erro para informar o usuário

### Arquivos Modificados
- `client/src/utils/cpfService.ts`: Serviço de consulta CPF (novo)
- `client/src/components/AddAjudanteModal.tsx`: Integração CPF API
- `client/src/components/EditAjudanteModal.tsx`: Integração CPF API
- `client/src/components/DocumentoMotoristaForm.tsx`: Integração CPF API para proprietário pessoa física

### Benefícios
- Redução de erros de digitação
- Preenchimento automático de dados pessoais
- Padronização de endereços
- Melhoria na experiência do usuário
- Consistência de dados no sistema

## Sistema de Tags Completo com Suporte a Temas (Janeiro 2025)

### Funcionalidade Implementada
- Sistema completo de tags para categorização de motoristas
- Criação manual de tabelas via SQL (evitando conflitos com Drizzle)
- Backend API com CRUD completo para gerenciamento de tags
- Frontend com componentes dedicados para administração e atribuição
- Navegação incluída no menu principal da aplicação

### Componentes Criados
- `TagManager.tsx`: Administração completa de tags (criação, edição, exclusão)
- `MotoristaTagsManager.tsx`: Gerenciamento de tags para motoristas específicos
- `TagsAdmin.tsx`: Página dedicada para administração do sistema de tags

### Suporte a Temas Dark/Light
- Aplicado suporte completo a tema escuro e claro em todos os componentes
- Transições suaves entre temas com `transition-colors`
- Cores consistentes com o sistema de design da aplicação
- Modais e formulários adaptados para ambos os temas

### Estrutura de Banco de Dados
- Tabela `tags`: id, nome, cor, company_id, created_at
- Tabela `motorista_tags`: id, motorista_id, tag_id, company_id, created_at
- Relacionamentos adequados para isolamento por empresa

### Funcionalidades
- Criação de tags personalizadas com cores customizáveis
- Atribuição/remoção de tags para motoristas individuais
- Interface visual consistente com o restante da aplicação
- Integração preparada para sincronização com WiseApp via Chatwoot API

### Navegação
- Item "Tags" adicionado ao menu principal com ícone da Lucide React
- Rota `/tags-admin` configurada no sistema de roteamento
- Acesso direto através do menu lateral da aplicação
## Migração Replit Agent para Replit (Janeiro 2025)

### Migração Completa
- **Status**: ✅ Concluída com sucesso
- **Data**: Janeiro 2025
- **Ambiente**: Aplicação rodando na porta 5000

### Correções e Melhorias Implementadas
- **LSP Errors**: Corrigidos todos os erros de TypeScript nos arquivos `server/routes.ts` e `shared/wiseAppService.ts`
- **UI Consistency**: Removido botão duplicado "Adicionar Gestão de Risco" na aba de gestão de risco
- **Modal Styling**: Padronizada a estética dos modais de alteração de função para motoristas e agregados
- **Database**: Mantida configuração Supabase existente conforme solicitado
- **WiseApp Integration**: Proxy funcionando corretamente para integração com chat

### Arquivos Principais Modificados
- `client/src/components/GestaoRiscoTab.tsx`: Removido botão duplicado
- `client/src/pages/contratacao/MotoristasLista.tsx`: Estética modal padronizada
- `client/src/pages/contratacao/AgregadosLista.tsx`: Estética modal padronizada  
- `server/routes.ts`: Correções de TypeScript
- `shared/wiseAppService.ts`: Correções de TypeScript

### Status Final da Migração
- ✅ Todas as dependências instaladas
- ✅ Workflow funcionando corretamente
- ✅ Supabase mantido conforme solicitado
- ✅ APIs e integrações funcionais
- ✅ Interface padronizada
- ✅ Aplicação pronta para uso

## Sistema de Autenticação Dinâmico (Janeiro 2025)

### Funcionalidade Implementada
- **Autenticação por Account ID**: Sistema dinâmico que busca empresa real baseada no account_id da URL
- **API Backend**: Rota `/api/company/by-account/:accountId` para buscar dados da empresa
- **Mapeamento Automático**: account_id da URL mapeia para company_id no banco de dados
- **Suporte Multi-Empresa**: Cada account_id carrega dados específicos da empresa correspondente
- **Produção e Desenvolvimento**: Funcionamento tanto no Replit quanto no Netlify

### Estrutura Implementada
- **Frontend**: `client/src/context/AuthContext.tsx` com busca dinâmica de empresa
- **Backend Replit**: `server/routes.ts` com rota para buscar empresa via Supabase
- **Backend Netlify**: `netlify/functions/api.js` com todas as rotas necessárias
- **Sistema de Vagas**: Rotas completas para CRUD de vagas, clientes, unidades, operações e status
- **Proxy WiseApp**: Mantido para funcionalidade de chat e caixas de entrada

### Rotas da API Netlify
- `GET /api/company/by-account/:accountId`: Buscar empresa por account_id
- `GET /api/vagas/dashboard/:accountId`: Dashboard de estatísticas das vagas
- `GET /api/vagas/:accountId`: Listar vagas da empresa
- `POST /api/vagas`: Criar nova vaga
- `PUT /api/vagas/:id`: Atualizar vaga existente
- `GET /api/clientes/:accountId`: Listar clientes da empresa
- `GET /api/unidades/:accountId`: Listar unidades da empresa
- `GET /api/operacoes/:accountId`: Listar operações da empresa
- `GET /api/status-vagas/:accountId`: Listar status de vagas da empresa
- `POST /api/unidades`, `/api/operacoes`, `/api/status-vagas`: Criação inline
- Proxy `/api/api/v1/*`: Redirecionamento para WiseApp API (chat/caixas de entrada)

### Benefícios
- **Isolamento de Dados**: Cada empresa vê apenas seus próprios dados
- **Escalabilidade**: Sistema preparado para múltiplas empresas
- **Flexibilidade**: URL com ?account_id=X carrega empresa correspondente
- **Compatibilidade**: Funciona tanto em desenvolvimento quanto produção
- **Manutenção**: Código centralizado e reutilizável

### Deploy no Netlify (Janeiro 2025)
- **Status**: ✅ Pronto para produção - Sistema de detecção automática de ambiente
- **Configuração**: netlify.toml criado com redirects e headers
- **Função Serverless**: netlify/functions/api.mjs (ES Modules) com todas as rotas
- **Build**: Testado localmente - funcionando perfeitamente  
- **Variáveis**: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CHAT_API_URL, VITE_CHAT_API_KEY, VITE_CHAT_ACCOUNT_ID
- **Instruções**: Documentadas em DEPLOY_NETLIFY_INSTRUCTIONS.md
- **Correções**: Removido parseInt() e melhorado tratamento de erros nas consultas
- **Debug**: Logs adicionados para troubleshooting no Netlify
- **API Dinâmica**: Frontend detecta automaticamente se está no Netlify e usa URLs corretas
- **Compatibilidade**: Funciona tanto no Replit quanto no Netlify sem modificações

## Melhorias na Interface do Usuário (Janeiro 2025)

### Context Menu - Simplificação das Opções
- **Funcionalidades Removidas**: 
  - Opção "Editar Motorista" do menu de contexto (botão direito)
  - Opção "Gerenciar Documentos" do menu de contexto (botão direito)
- **Aplicado em**: Listas de Motoristas e Agregados
- **Motivo**: Simplificação da interface e redução de opções desnecessárias
- **Opções Mantidas**: 
  - Motoristas: Visualizar Detalhes, Iniciar Chat, Excluir Motorista
  - Agregados: Visualizar Detalhes, Iniciar Chat
- **Arquivos Modificados**: 
  - `client/src/pages/contratacao/MotoristasLista.tsx`
  - `client/src/pages/contratacao/AgregadosLista.tsx`

## Sistema de Gestão de Vagas (Janeiro 2025)

### Funcionalidade Implementada
- **Novo Módulo**: Sistema completo de gestão de vagas de trabalho
- **Acessível via**: `/vagas` URL com estrutura de abas igual ao módulo de Contratações
- **Design**: Segue o mesmo padrão visual dos módulos Motoristas/Contratados
- **Database**: Migrado completamente para Supabase com RLS configurado
- **Status Final**: Sistema 100% funcional com dados reais
- **✅ Criação de Vagas**: Sistema funcionando perfeitamente com todos os campos
- **✅ Data Limite Opcional**: Campo dt_limite agora é opcional no formulário
- **✅ Foreign Keys**: Mapeamento correto de account_id para company_id resolvido

### Estrutura do Banco de Dados
- **Tabelas Criadas**:
  - `vaga`: Tabela principal com nome, descrição, quantidade, dias de trabalho, horário, data limite
  - `unidade`: Unidades organizacionais (3 unidades criadas)
  - `operacao`: Tipos de operação (1 operação criada)
  - `st_vaga`: Status das vagas (2 status criados: Em Andamento, Pausada)
  - `end_vaga`: Endereços das vagas
- **Relacionamentos**: Vagas vinculadas a empresa, cliente, unidade, operação e status
- **Supabase RLS**: Configurado e funcionando para todas as tabelas
- **Mapeamento**: account_id (URL) → company_id (Fox-e: id=1, account_id=6)

### Interface do Usuário
- **Layout**: Abas Dashboard e Vagas seguindo padrão do módulo Contratações
- **Dashboard**: Cards estatísticos mostrando total de vagas, abertas, fechadas e vencendo
- **Lista de Vagas**: Tabela com informações de cliente/unidade, operação, quantidade, data limite e status
- **Modal de Criação**: Formulário completo para adicionar nova vaga com dropdowns para cliente, unidade, operação e status

### Arquivos Criados/Modificados
- `shared/schema.ts`: Adicionadas tabelas e tipos para o sistema de vagas
- `client/src/pages/Vagas.tsx`: Página principal com estrutura de abas
- `client/src/components/VagasList.tsx`: Componente de listagem de vagas
- `client/src/components/AddVagaModal.tsx`: Modal para adicionar novas vagas
- `client/src/components/DashboardStats.tsx`: Componente reutilizável para cards estatísticos
- `server/routes.ts`: APIs para CRUD de vagas e dados auxiliares
- `client/src/App.tsx`: Rota adicionada para `/vagas/*`

### APIs Implementadas
- `GET /api/vagas/dashboard/:companyId`: Dados do dashboard
- `GET /api/vagas/:companyId`: Lista de vagas por empresa
- `POST /api/vagas`: Criação de nova vaga
- `GET /api/clientes/:companyId`: Lista de clientes
- `GET /api/unidades/:companyId`: Lista de unidades
- `POST /api/unidades`: Criação de nova unidade
- `GET /api/operacoes/:companyId`: Lista de operações
- `POST /api/operacoes`: Criação de nova operação
- `GET /api/status-vagas/:companyId`: Lista de status de vagas
- `POST /api/status-vagas`: Criação de novo status

### Funcionalidades de Criação Inline (Janeiro 2025)
- **Dropdowns com Criação**: Unidades, Operações e Status permitem criação inline
- **Interface**: Opção "+ Adicionar nova..." no final de cada dropdown
- **Funcionamento**: Seleção da opção "+" transforma campo em input de texto
- **Ações**: Botões ✓ (salvar) e ✗ (cancelar) para confirmar ou cancelar criação
- **Validação**: Enter para confirmar, dados salvos automaticamente no banco
- **Isolamento**: Todas as criações respeitam company_id para isolamento de dados
- **Auto-seleção**: Item criado é automaticamente selecionado no dropdown
- **Persistência**: Dados realmente salvos nas tabelas do banco (unidade, operacao, st_vaga)
- **Integração**: APIs implementadas com real inserção e busca no PostgreSQL via Drizzle ORM
- **Mapeamento Account**: Sistema mapeia account_id da URL para company_id através de id_conta_wiseapp
- **Exemplo**: account_id=6 na URL → busca company onde id_conta_wiseapp='6' → usa company_id=1

