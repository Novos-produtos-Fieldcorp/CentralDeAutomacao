# replit.md

## Overview
This project is a full-stack web application designed for multi-company fleet management within the logistics sector. Its primary purpose is to centralize and streamline operations related to drivers, vehicles, clients, and critical workflows like checklists and odometer readings. The application offers dynamic authentication, comprehensive job vacancy management, efficient document handling, and integrates with external services to enhance functionality, ultimately aiming to boost efficiency and ensure data consistency.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript and Vite.
- **Styling**: Tailwind CSS for custom dark mode and responsiveness, leveraging Radix UI and shadcn/ui components.
- **State Management**: React Context API for global state; TanStack Query for server state management and data fetching.
- **Routing**: React Router.

### Backend
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL via Supabase, including real-time features.
- **Build**: `esbuild` for production.

### Key Architectural Decisions
- **Authentication**: Dynamic context-based system utilizing account IDs from URL parameters to support multi-company environments and data isolation.
- **Database Layer**: Direct integration with Supabase PostgreSQL, employing Row Level Security (RLS) for multi-tenancy, real-time subscriptions, and type-safe operations.
- **UI/UX**: Responsive design, comprehensive component library, dark/light theme support, and consistent styling across the application.
- **Data Flow**: TanStack Query is used with direct Supabase calls for optimized caching and state management, ensuring company-filtered queries via RLS.
- **External Integrations**: Modular design facilitates integration with third-party services like WiseApp, often routed through secure Supabase Edge Functions.
- **Document Management**: Direct uploads to Supabase Storage with validation and URL storage.
- **WiseApp Token Management**: Automatic retrieval of WiseApp tokens from the database based on email, eliminating manual configuration. All WiseApp API operations are routed through Supabase Edge Functions for security and consistent behavior.
- **Form Validation**: Includes enhanced CNH validation and real-time input sanitization.
- **Pagination**: Implemented a comprehensive pagination system across lists with configurable page sizes.
- **License Plate API**: Real-time vehicle data consultation via FIPE API for automated form filling.
- **Odometer Readings**: Integrated `bomba_gasolina` table for odometer readings, including price, liters, and photo management with granular access control.
- **Minuta Management**: Full minuta management in the Hodômetros module with search, filtering, and editing capabilities, supporting multiple `romaneio` numbers.
- **Tag Synchronization**: Bidirectional tag synchronization between WiseApp and the local database, ensuring multi-tenant data isolation and referential integrity.
- **Vagas View Mode**: Allows toggling between table and card grid views, with preference persistence.
- **Database Architecture**: Exclusively uses Supabase; local Replit database is disabled.

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