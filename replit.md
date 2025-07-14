# Replit.md

## Overview

This is a full-stack web application built with React, Node.js, Express, and PostgreSQL. The application uses TypeScript for type safety and modern web development practices. It follows a client-server architecture with a shared schema between frontend and backend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **State Management**: React Context API for global state (Auth, Theme, Chat, Checklist)
- **Routing**: React Router for client-side navigation
- **Data Fetching**: TanStack React Query for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Management**: Drizzle Kit for migrations
- **Session Storage**: PostgreSQL-based sessions with connect-pg-simple

### Development Setup
- **Monorepo Structure**: Client and server code in same repository
- **Hot Reloading**: Vite dev server with HMR
- **Type Safety**: Shared TypeScript types between client and server
- **Path Aliases**: Configured for clean imports (@/, @shared/)

## Key Components

### Authentication System
- **Account-based Authentication**: Uses WiseApp account IDs for authentication
- **Company Isolation**: All data is filtered by company_id
- **Module Access Control**: Granular permissions per company for different modules
- **Session Management**: Server-side sessions with PostgreSQL storage

### Database Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Schema**: Centralized schema definition in shared/schema.ts
- **Migrations**: Managed through Drizzle Kit

### UI/UX Features
- **Dark/Light Theme**: Context-based theme switching with localStorage persistence
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Component Library**: Custom components built on Radix UI primitives
- **Modal System**: Unified modal components for forms and dialogs
- **Loading States**: Consistent loading indicators throughout the app

### Business Modules
- **Dashboard**: Main landing page with module access cards
- **Motoristas**: Driver management with document upload and verification
- **Veículos**: Vehicle management for both company and contractor vehicles
- **Clientes**: Client management with address information
- **Checklist**: Vehicle inspection checklists (weekly, monthly, maintenance)
- **Hodômetros**: Odometer readings and reports
- **Resumos Grupo**: WhatsApp group summary automation

## Data Flow

### Request Flow
1. User interacts with React components
2. Components use React Query for API calls
3. Express server processes requests
4. Drizzle ORM handles database operations
5. Data flows back through the same chain

### Authentication Flow
1. URL contains account_id parameter
2. AuthContext validates account_id against company database
3. If valid, user is authenticated and company_id is set
4. All subsequent requests are filtered by company_id

### File Upload Flow
1. Files uploaded to Supabase Storage
2. File URLs stored in PostgreSQL database
3. Document management through specialized components

## External Dependencies

### Core Dependencies
- **React Ecosystem**: React, React Router, React Query
- **Database**: Drizzle ORM, Neon Database
- **UI Framework**: Radix UI, Tailwind CSS, Lucide React icons
- **Validation**: Zod for schema validation
- **Date Handling**: date-fns for date operations
- **File Processing**: xlsx for Excel import/export

### Development Dependencies
- **TypeScript**: Full type safety across the stack
- **Vite**: Build tool and dev server
- **PostCSS**: CSS processing for Tailwind
- **ESBuild**: Fast JavaScript bundling for production

### External Services
- **Supabase**: Used for file storage and some database operations
- **WiseApp**: External authentication and chat integration
- **WhatsApp Integration**: For messaging and group management

## Deployment Strategy

### Production Build
- **Frontend**: Vite builds static assets to dist/public
- **Backend**: ESBuild bundles server code to dist/index.js
- **Database**: Drizzle migrations handle schema changes

### Environment Configuration
- **Database**: PostgreSQL connection via DATABASE_URL
- **External APIs**: Configured through environment variables
- **File Storage**: Supabase credentials for file uploads

### Development Workflow
- **Local Development**: tsx for TypeScript execution with hot reload
- **Type Checking**: Shared TypeScript configuration
- **Database Updates**: Drizzle Kit push for schema synchronization

The application is designed to be a comprehensive business management system with a focus on transportation and logistics, providing tools for driver management, vehicle tracking, document handling, and automated reporting.