# replit.md

## Overview
This project is a full-stack web application for multi-company fleet management. It streamlines operations related to drivers, vehicles, clients, and workflows such as checklists and odometer readings. The system provides dynamic authentication, comprehensive job vacancy management, efficient document handling, and integrates with external services for enhanced functionality, aiming to improve efficiency and data consistency in the logistics sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **Styling**: Tailwind CSS with custom dark mode and responsiveness, utilizing Radix UI and shadcn/ui components.
- **State Management**: React Context API for global states; TanStack Query for server state management and data fetching.
- **Routing**: React Router.

### Backend
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL via Supabase, with real-time features.
- **Build**: `esbuild` for production.

### Key Architectural Decisions
- **Authentication**: Dynamic context-based system using account IDs from URL parameters for multi-company support and data isolation.
- **Database Layer**: Direct Supabase integration with PostgreSQL, leveraging Row Level Security (RLS) for multi-tenancy, real-time subscriptions, and type-safe operations. Migrated from Express.js API to direct database access for performance.
- **UI/UX**: Responsive design with comprehensive component library, dark/light theme support, and consistent styling.
- **Data Flow**: TanStack Query with direct Supabase calls for optimal caching and state management, ensuring company-filtered queries via RLS.
- **External Integrations**: Modular design for third-party services like Supabase and WiseApp, often routed through secure proxy systems (Supabase Edge Functions).
- **Vagas Module**: Migrated to direct Supabase access with RLS for improved performance and data isolation.
- **WhatsApp Integration**: Seamless photo capture and display using WiseApp API, with automatic storage in Supabase and real-time avatar updates.
- **Document Management**: Direct upload to Supabase Storage with validation and URL storage.
- **User Experience**: Includes CPF API integration for form auto-population, simplified context menus, and WhatsApp avatar display.
- **WiseApp Token Management**: Automatic retrieval of WiseApp tokens from the database (`wiseapp_acesso` table) based on email, eliminating manual configuration.
- **Form Validation**: Enhanced CNH validation and real-time input sanitization.
- **Pagination**: Comprehensive pagination system implemented across lists with configurable page sizes.
- **License Plate API**: Real-time vehicle data consultation via FIPE API for automatic form filling.
- **Performance Optimization**: Significant improvements in data loading times for large datasets through optimized database queries and pagination.
- **Replit Configuration**: Configured for Replit deployment with Vite dev server accepting all hosts and Express backend bound to `0.0.0.0:5000`.
- **Fuel Pump Integration**: Integrated `bomba_gasolina` table for odometer readings, including price, liters, and photo management with granular access control via Admin page.
- **Minuta Management**: Full minuta management in Hodômetros module with search, filtering, and editing capabilities, including multiple `romaneio` numbers.
- **Tag Synchronization**: Bidirectional tag synchronization between WiseApp and local database, ensuring multi-tenant data isolation and maintaining referential integrity.
- **Vagas View Mode**: Toggle between table and card grid views, with preference persistence.
- **Secure WiseApp Proxy**: All WiseApp API operations are routed through Supabase Edge Functions for secure token management and consistent API behavior.
- **Database Architecture**: Exclusively uses Supabase; local Replit database is disabled.
- **WiseApp Token Authentication**: Email-based authentication - user provides email once, system saves to localStorage and retrieves token from `wiseapp_acesso` table by email for all subsequent operations.
- **WiseApp Tag Operations**: All tag operations (create, delete, sync, assign individual/bulk) now consistently convert `id_conta_wiseapp` or `accountId` to String before sending in `wiseapp-account-id` header, ensuring correct account routing in WiseApp API. Fixed in: TagAdministration, BulkActionsModal, MotoristaTagsManager, AgregadosLista, MotoristasLista.

## External Dependencies

### Core Framework & Development
- **React Ecosystem**: `@radix-ui/react-components`, `@tanstack/react-query`, `react-router-dom`, `react-hook-form`.
- **Styling**: `tailwindcss`, `shadcn/ui`.
- **Build Tools**: `vite`, `typescript`, `tsx`, `esbuild`.
- **Database**: `@supabase/supabase-js`.
- **Validation**: `zod`.

### Third-party Services
- **Supabase**: Database, real-time features, document storage.
- **WiseApp**: Messaging, chat functionality, communication features.
- **FIPE API**: For license plate data consultation.
- **CPF API**: For automatic data population in forms.
- **CEP APIs**: (ViaCEP, BrasilAPI, PostMon, RepublicaVirtual) for address lookup with intelligent fallback.

### Utilities & UI Enhancements
- **Date Handling**: `date-fns`.
- **Icons**: `lucide-react`.
- **Notifications**: `react-hot-toast`.
- **Excel Processing**: `xlsx`.
- **HTTP Client**: `axios`.