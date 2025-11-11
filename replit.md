# Fleet Management Application

## Overview
This full-stack web application provides a comprehensive solution for multi-company fleet management. It centralizes operations for drivers, vehicles, clients, and workflows like checklists and odometer readings. Key features include dynamic authentication, job vacancy management, efficient document handling, and integrations with external services to boost efficiency and ensure data consistency in the logistics sector. The project aims to streamline complex logistics operations and offer a robust platform for fleet managers.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **Styling**: Tailwind CSS for responsive design, dark mode, utilizing Radix UI and shadcn/ui components.
- **State Management**: React Context API for global states; TanStack Query for server state management and data fetching.
- **Routing**: React Router.

### Backend
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL via Supabase, including real-time features.
- **Build**: `esbuild` for production.

### Key Architectural Decisions
- **Authentication**: Dynamic, context-based system using account IDs from URL parameters to support multi-company environments and data isolation.
- **Database Layer**: Direct Supabase integration with PostgreSQL, leveraging Row Level Security (RLS) for multi-tenancy, real-time subscriptions, and type-safe operations.
- **UI/UX**: Responsive design with a comprehensive component library, dark/light theme support, and consistent styling.
- **Data Flow**: TanStack Query with direct Supabase calls for optimized caching and state management, ensuring company-filtered queries via RLS.
- **External Integrations**: Modular design for third-party services, often routed through secure proxy systems (Supabase Edge Functions).
- **WhatsApp Integration**: Seamless photo capture and display using WiseApp API, with automatic storage in Supabase and real-time avatar updates.
- **Document Management**: Direct upload to Supabase Storage with validation.
- **WiseApp Token Management**: Automatic retrieval of WiseApp tokens from the database based on email.
- **Form Validation**: Enhanced CNH validation and real-time input sanitization.
- **Pagination**: Comprehensive pagination system across lists with configurable page sizes.
- **License Plate API**: Real-time vehicle data consultation via FIPE API for automatic form filling.
- **Performance Optimization**: Optimized database queries and pagination for large datasets.
- **Replit Configuration**: Configured for Replit deployment with Vite dev server accepting all hosts and Express backend bound to `0.0.0.0:5000`.
- **Fuel Pump Integration**: Integrated `bomba_gasolina` table for odometer readings, including price, liters, and photo management with granular access control.
- **Minuta Management**: Full minuta management in Hodômetros module with search, filtering, and editing, including multiple `romaneio` numbers.
- **Tag Synchronization**: Bidirectional tag synchronization between WiseApp and local database, ensuring multi-tenant data isolation and referential integrity.
- **Vagas View Mode**: Toggle between table and card grid views with preference persistence.
- **Secure WiseApp Proxy**: All WiseApp API operations are routed through Supabase Edge Functions for secure token management and consistent API behavior.
- **Database Architecture**: Exclusively uses Supabase; local Replit database is disabled.
- **WiseApp Tag Operations**: All tag operations (create, delete, sync, assign individual/bulk) correctly use `wiseapp-account-id` header for routing and include `companyId` in API URLs for account isolation.
- **Hodômetro km_rodado Calculation**: Frontend dynamically calculates km_rodado values instead of using database column. Two calculation modes: INTER-DAY (when `calculoUmPorDia=true`, compares current day with next day) and INTRA-DAY (when `calculoUmPorDia=false`, compares first/last reading of same day). Handles both automobiles (hod_lido) and ciclomotors (trip_lida) with automatic type detection.

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