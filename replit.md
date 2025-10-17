# replit.md

## Overview
This project is a full-stack web application designed as a fleet management system. It facilitates the management of drivers, vehicles, clients, and operational workflows such as checklists and odometer readings. Built with React for the frontend and Express.js for the backend, it leverages PostgreSQL with Drizzle ORM for data persistence and integrates with external services like Supabase for enhanced functionality. The system aims to provide a robust solution for multi-company fleet management, with features like dynamic authentication based on account IDs, comprehensive job vacancy management, and efficient document handling, improving operational efficiency and data consistency within the logistics sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite for development and bundling.
- **Styling**: Tailwind CSS, including custom dark mode implementation and responsiveness.
- **UI Components**: Radix UI primitives with shadcn/ui design system.
- **State Management**: React Context API for global states like authentication, themes, and chat.
- **Routing**: React Router for client-side navigation.
- **HTTP Client**: TanStack Query for server state management and data fetching.

### Backend Architecture
- **Framework**: Express.js with TypeScript, built for scalability.
- **Database**: PostgreSQL via Supabase, providing real-time features and secure data access.
- **Development**: Features hot reload integration with Vite middleware.
- **Session Management**: Currently in-memory, with plans for database persistence.

### Build and Development
- **Development**: Uses `tsx` for TypeScript execution and Vite's dev server.
- **Production**: `esbuild` for backend bundling and Vite for frontend bundling.
- **Module System**: ES modules are used consistently across the stack.

### Key Architectural Decisions
- **Authentication**: Dynamic context-based system using account IDs from URL parameters, enabling multi-company support with company-specific data isolation.
- **Database Layer**: Direct Supabase integration with PostgreSQL, featuring comprehensive Row Level Security (RLS) policies for multi-tenant data isolation, real-time subscriptions, and type-safe operations. Complete migration from Express.js API to direct database access for improved performance.
- **UI/UX**: Emphasis on a comprehensive, responsive component library with dark/light theme support, consistent design via custom CSS variables, and streamlined user interactions.
- **Data Flow**: TanStack Query with direct Supabase calls for optimal caching and state management, ensuring company-filtered queries and secure data isolation through RLS policies.
- **External Integrations**: Designed for modular integration with third-party services like Supabase and WiseApp through a proxy system for secure communication.
- **Vagas Module Migration**: Successfully migrated from Express.js backend API to direct Supabase database access with React Query integration, implementing critical Row Level Security for company-based data isolation and eliminating API roundtrips for improved performance.
- **WhatsApp Integration**: Seamless photo capture system using WiseApp API for contact search, with automatic photo storage in Supabase and real-time avatar updates across all driver management interfaces.
- **Deployment**: Configured for Netlify, utilizing serverless functions and environment-based configurations for seamless development and production transitions, including iframe embedding support.
- **Job Vacancy Management**: A dedicated module with its own data model and APIs, supporting inline creation of related entities (units, operations, statuses) and real-time dashboard statistics.
- **Document Management**: Direct upload to Supabase Storage, with validation and automatic URL storage in the database for driver and vehicle owner documents.
- **WhatsApp Photo Integration**: Automatic capture and display of WhatsApp profile photos for drivers, with seamless integration through FloatingChat component that automatically saves photos when contacts are loaded, eliminating the need for separate API calls and reducing system complexity. The sync button specifically captures and saves WhatsApp profile photos for all motoristas, agregados, and contratados.
- **User Experience Enhancements**: Includes CPF API integration for automatic data population in forms, simplified context menus, and WhatsApp avatar display replacing default user icons across all driver tables.
- **ChatWoot Inbox Caching**: Implemented localStorage caching for ChatWoot API inboxes (chat.wiseapp360.com) with 1-hour expiration to ensure reliable functionality in Netlify deployment. Cache is account-specific and includes automatic expiration handling.
- **Automatic WiseApp Token Management**: System now automatically retrieves WiseApp tokens from the database (`wiseapp_acesso` table) using company_id, eliminating the need for manual token configuration. Includes comprehensive error handling for authentication failures and missing tokens.
- **Enhanced Form Validation**: Improved CNH validation to accept numbers only, with real-time input sanitization and proper error handling across all driver registration forms.
- **Pagination System**: Added comprehensive pagination to HodometrosLista page with configurable page sizes (10, 25, 50, 100) using reusable pagination hooks and components for optimal data viewing.
- **License Plate API Integration**: Real-time vehicle data consultation using FIPE API (placas.fipeapi.com.br) with automatic form filling for vehicle registration. Includes validation for both old and Mercosul license plate formats, proper error handling, and seamless integration in AddVeiculoModal and EditVeiculoModal components.
- **Enhanced Routes System**: Comprehensive backend routes with real WiseApp API integration, multiple CEP APIs with intelligent fallback system (ViaCEP, BrasilAPI, PostMon, RepublicaVirtual), complete CRUD operations for all entities, job vacancy management, and proxy services for external APIs. Includes timeout handling and robust error management across all services.
- **Performance Optimization**: Major performance improvements to the Contratados.tsx page, reducing loading time from 35+ seconds to under 5 seconds by implementing a two-step database approach: first fetching unique motorista_id with server-side pagination, then fetching detailed data only for paginated results. Fixed pagination vs grouping conflicts, implemented proper date filtering with full-day coverage, added global search functionality, and corrected total count calculations to maintain accuracy while achieving scalable performance.
- **Replit Environment Configuration**: Configured for deployment on Replit with Vite dev server accepting all hosts (0.0.0.0) and Express backend properly bound to 0.0.0.0:5000 to work with Replit's proxy system. Workflow configured with webview output type for proper frontend display.
- **Fuel Pump Integration**: Added bomba_gasolina table integration to hodometro readings list, displaying Preço (Price) and Litros (Liters) columns alongside the odometer column. Each shows Lido/Informado values with camera icons for accessing fuel pump photos (foto_bomba). Data is fetched via Supabase join using hodometro_id foreign key relationship. The edit modal includes a dedicated "Dados da Bomba de Gasolina" section with four fields (Preço Lido, Preço Informado, Litros Lido, Litros Informado), allowing users to update or clear fuel pump readings. The system uses maybeSingle() for robust upsert operations, properly handling edge cases like clearing values and preventing duplicate records. The Foto column displays two icons: Gauge icon for hodometer photo and Fuel icon for fuel pump photo, with dynamic modal titles and download filenames based on photo type. The edit modal features two distinct photo upload sections with neutral gray borders for cleaner interface: hodometer photo section (Gauge icon) and fuel pump photo section (Fuel icon), each with preview display, upload/replacement capabilities, remove buttons, and base64 encoding for database storage.
- **Module Access Control for Fuel Pump**: Implemented granular access control for fuel pump functionality through the Admin page (/admin). Added "Bomba" column to the access control table with toggle functionality for each company. The bomba_gasolina_access flag controls visibility of fuel pump-related features: Preço and Litros columns in the readings table, fuel pump data entry fields in the edit modal, fuel pump photo upload section, and fuel pump photo icon in the Foto column. Integrated with useModuleAccess hook for consistent permission checking across the application. Companies without bomba_gasolina_access enabled will see a simplified interface without fuel pump functionality.
- **Minuta Management System**: Implemented complete minuta management in the Hodômetros module with list view, filtering by period, search (motorista, placa, minuta, romaneio, filial), and photo viewing. Changed romaneio field from string to array to support multiple romaneio numbers per minuta. Added edit modal with reference to HodometrosRelatorio.tsx, allowing users to edit minuta_informada, minuta_lida, and manage multiple romaneios with add/remove functionality. The romaneios are displayed as badges in the table and exported to Excel as comma-separated values. Module access controlled by minuta_access flag in company table.
- **Tag Synchronization System**: Implemented bidirectional tag synchronization between WiseApp and local database in TagAdministration component. The "Sincronizar WiseApp" button fetches WiseApp labels by company_id, adds missing local tags, and removes orphaned local tags (after clearing their associations to maintain referential integrity). All operations are scoped by company_id to ensure proper multi-tenant data isolation. Features animated sync icon for visual feedback during synchronization.
- **Vagas View Mode Toggle**: Added view mode toggle in VagasList component with LayoutList (table) and LayoutGrid (cards) icons. Users can switch between traditional table view and responsive card grid (1 column mobile, 2 tablet, 3 desktop). View preference persists in localStorage with key 'vagas-view-mode'. All features (filtering, status updates, actions) work seamlessly in both views.
- **WiseApp Tag Integration Fixes**: Corrected critical bugs in tag assignment and synchronization with WiseApp API. All tag operations now properly preserve existing tags instead of overwriting them. Fixed account ID resolution to fetch `id_conta_wiseapp` from company table instead of using context accountId. Updated bulk tag assignment (BulkActionsModal), individual tag sync (AgregadosLista, MotoristasLista) to fetch existing contact labels before adding/removing tags and send complete label arrays. Tag creation payload simplified to use only `title` and `color` fields as required by WiseApp API. Removed duplicate "Sincronizar WiseApp" button from TagAdministration header, keeping only the button in the lower section for cleaner UX. Fixed WiseAppAccessContext token retrieval to query by `id_conta_wiseapp` (not `company_id` which doesn't exist in wiseapp_acesso table) - retrieves stored token directly without complexity.
- **Database Architecture**: Sistema configurado para usar **EXCLUSIVAMENTE Supabase** - banco de dados local do Replit completamente desabilitado. Todas as queries usam Supabase direto através do client (@supabase/supabase-js). Drizzle config desativado pois não é necessário para Supabase.
- **WiseApp Token Authentication**: Sistema simplificado para autenticação por EMAIL. Fluxo: (1) Usuário fornece email ao entrar na central, (2) Sistema salva email no localStorage (chave: `wiseapp_user_email`), (3) Busca token na tabela `wiseapp_acesso` WHERE email = email_fornecido, (4) Se encontrar token, usa automaticamente; caso contrário, solicita cadastro. Eliminada complexidade de busca por id_conta_wiseapp e lógica de "mais recente".
- **WiseApp Tag Integration Fixes**: Corrected critical bugs in tag assignment and synchronization with WiseApp API. All tag operations now properly preserve existing tags instead of overwriting them. Fixed account ID resolution to fetch `id_conta_wiseapp` from company table instead of using context accountId. Updated bulk tag assignment (BulkActionsModal), individual tag sync (AgregadosLista, MotoristasLista) to fetch existing contact labels before adding/removing tags and send complete label arrays. Tag creation payload simplified to use only `title` and `color` fields as required by WiseApp API. Removed duplicate "Sincronizar WiseApp" button from TagAdministration header, keeping only the button in the lower section for cleaner UX.
- **Secure WiseApp Proxy**: All WiseApp API operations are now routed through Supabase Edge Functions which implement automatic token retrieval from the `wiseapp_acesso` table. The Edge Functions extract accountId from URL, fetch company_id, and retrieve WiseApp tokens automatically. This eliminates security vulnerabilities from localStorage token storage and ensures always-fresh tokens from database.
- **Inbox Selection Flow**: Resolved "Nenhuma inbox selecionada" error by implementing pending data states (pendingPhoneNumber, pendingContactName) that preserve contact information during inbox selection. When user clicks to initiate chat, data is stored; when inbox is selected via handleInboxSelection, the function automatically retrieves pending data, creates/searches for contact, and initiates conversation - eliminating the need for users to re-enter information after selecting an inbox.
- **Supabase Edge Functions Migration**: Migrated all WiseApp API calls from conditional Replit/Netlify routing to exclusive use of Supabase Edge Functions (https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/api). Updated FloatingChat.tsx, ResumosGrupo.tsx, and whatsappPhotoService.ts to use Supabase backend URL for all API operations. The Supabase Edge Functions provide complete WiseApp proxy implementation with all necessary routes, ensuring consistent API behavior across all deployment environments.


## External Dependencies

### Core Framework & Development
- **React Ecosystem**: `@radix-ui/react-components`, `@tanstack/react-query`, `react-router-dom`, `react-hook-form`.
- **Styling**: `tailwindcss`, `shadcn/ui`, `class-variance-authority`.
- **Build Tools**: `vite`, `typescript`, `tsx`, `esbuild`.
- **Database**: `@supabase/supabase-js` for PostgreSQL database operations and real-time features.
- **Validation**: `zod`.

### Third-party Services
- **Supabase**: Used for database services, real-time features, and document storage (`@supabase/supabase-js`).
- **WiseApp**: Integrated for messaging, chat functionality, and communication features.

### Utilities & UI Enhancements
- **Date Handling**: `date-fns`.
- **Icons**: `lucide-react`.
- **Notifications**: `react-hot-toast`.
- **Excel Processing**: `xlsx` (for import/export).
- **External APIs**: `axios` for general HTTP requests, specifically used for CPF API integration.