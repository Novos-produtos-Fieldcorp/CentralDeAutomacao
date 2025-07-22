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