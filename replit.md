# Fleet Management Application

## Overview
This full-stack web application offers a centralized multi-company fleet management solution. It aims to optimize operations for drivers, vehicles, clients, and workflows like checklists and odometer readings. Key capabilities include dynamic authentication, job vacancy management, efficient document handling, and integration with external services. The project's vision is to streamline complex logistics operations, improve data consistency, and enhance overall productivity for fleet managers.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application uses React 18 with TypeScript, Vite, Tailwind CSS, Radix UI, and shadcn/ui to deliver a responsive and consistent user experience, including custom dark mode and a comprehensive component library.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, React Router, and TanStack Query.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL via Supabase, utilizing real-time features and Row Level Security (RLS) for multi-tenancy.
- **Authentication**: Dynamic, context-based system with email authentication for multi-company support and data isolation, primarily for WiseApp token management.
- **Data Flow**: TanStack Query with direct Supabase calls for optimized caching and state management.
- **WhatsApp Integration**: Seamless photo capture and display using WiseApp API, with automatic storage in Supabase.
- **Document Management**: Direct upload to Supabase Storage with validation.
- **WiseApp Token Management**: Unified session cache and cross-context company synchronization. `WiseAppAccessContext` is the authoritative source for `accountId`.
- **Company Data Isolation**: Tenant-scoped `accountId` and `companyId` are provided via a centralized `useCurrentAccount()` hook. All tenant-aware components must use this hook.
- **Vehicle Management**: Includes CNH validation, license plate API integration (FIPE), and duplicate vehicle prevention/detection with bulk removal capabilities.
- **Odometer & Fuel Management**: `bomba_gasolina` table for odometer readings, fuel pump data, and an advanced `km_rodado` calculation utility for accurate fuel consumption tracking and a dedicated dashboard.
- **Job Vacancy Management (Vagas Module)**: Supports inline entity creation, real-time dashboard statistics, and configurable table/card grid views.
- **Route Proof Management (Comprovante de Rota Module)**: Tabbed interface with Dashboard and List views, featuring driver rankings, media analytics (photos/videos), GPS location display, and bulk ZIP download.
- **Operations Module**: Comprehensive module for trip and operations management, including:
    - **Dashboard**: Statistics, 30-day trip histogram, and custom operation cards.
    - **Trips (Viagens)**: Filterable list with auto-refresh.
    - **Financial (Financeiro)**: Lists billing records by operation with global date filtering and multi-tenant isolation.
    - **Pricing (Preços)**: Inline editing for operation-specific pricing.
    - **Operation Types**: Specific pricing models and detail layouts for SADA, SUPERTERMINAIS, MITSUBISHI, AUTOSERVICE, TEGMA, and CESARI operations, each with unique pricing structures (per-vehicle, fixed, route-based) and commission calculations. Includes detailed modal views with data translation and media previews.
    - **Backend API Proxy**: Secure routing for financial and pricing queries through Express endpoints to bypass Supabase RLS.
- **Bulk Trip Import**: Via Excel, supporting per-operation templates, backend lookup for motorista/veiculo, and two-step insert with error reporting.
- **Oil Change Alerts**: Checklist module feature for configuring per-vehicle oil change intervals and sending WiseApp alerts based on current and projected mileage.

### System Design Choices
- **Build**: `tsx` for development, `esbuild` for backend production, and Vite for frontend.
- **Module System**: ES modules.
- **Database Architecture**: Exclusively Supabase.
- **External Integrations**: Modular design, often routed through secure proxy systems (Supabase Edge Functions).

## External Dependencies

### Core Framework & Development
- **React Ecosystem**: `@radix-ui/react-components`, `@tanstack/react-query`, `react-router-dom`, `react-hook-form`.
- **Styling**: `tailwindcss`, `shadcn/ui`, `class-variance-authority`.
- **Build Tools**: `vite`, `typescript`, `tsx`, `esbuild`.
- **Database SDK**: `@supabase/supabase-js`.
- **Validation**: `zod`.

### Third-party Services
- **Supabase**: Database, real-time features, document storage.
- **WiseApp**: Messaging and communication integration.
- **FIPE API (placas.fipeapi.com.br)**: Real-time vehicle data.
- **CEP APIs**: ViaCEP, BrasilAPI, PostMon, RepublicaVirtual for address lookup.
- **CPF API**: Automatic data population.
- **n8n Webhook**: External AI-powered group summary generation (`https://n8nqp.wiseapp360.com/webhook/resumo-grupo`).
- **Groq AI (via CrewAI)**: AI-powered conversation/email summary generation.

### AI Summary Service (ai_service/)
- **Technology**: Python 3.11 with CrewAI and FastAPI.
- **LLM Provider**: Groq (llama-3.3-70b-versatile).
- **Purpose**: Used for conversation and email summaries (group summaries handled by n8n webhook).
- **Configuration**: Requires `GROQ_API_KEY` environment variable.

### Utilities & UI Enhancements
- **Date Handling**: `date-fns`.
- **Icons**: `lucide-react`.
- **Notifications**: `react-hot-toast`.
- **Excel Processing**: `xlsx`.
- **HTTP Client**: `axios`.