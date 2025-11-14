# Fleet Management Application

## Overview
This full-stack web application offers a centralized solution for multi-company fleet management, streamlining operations for drivers, vehicles, clients, and workflows like checklists and odometer readings. It features dynamic authentication, job vacancy management, efficient document handling, and integrations with external services. The project's core purpose is to enhance efficiency and data consistency within the logistics sector, providing a robust platform for fleet managers.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application utilizes React 18 with TypeScript, Vite, Tailwind CSS, Radix UI, and shadcn/ui for a responsive and consistent user experience. It includes custom dark mode implementation and a comprehensive component library.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, React Router, and TanStack Query for state and data fetching.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL via Supabase, leveraging real-time features and Row Level Security (RLS) for multi-tenancy.
- **Authentication**: Dynamic, context-based system using account IDs from URL parameters for multi-company support and data isolation.
- **Data Flow**: TanStack Query with direct Supabase calls for optimized caching and state management, ensuring company-filtered queries via RLS policies.
- **WhatsApp Integration**: Seamless photo capture and display using WiseApp API, with automatic storage in Supabase and real-time avatar updates.
- **Document Management**: Direct upload to Supabase Storage with validation.
- **WiseApp Token Management**: Automatic retrieval of WiseApp tokens from the database based on `company_id`.
- **Form Validation**: Enhanced CNH validation and real-time input sanitization.
- **Pagination**: Comprehensive pagination system across lists with configurable page sizes.
- **License Plate API**: Real-time vehicle data consultation via FIPE API for automatic form filling.
- **Performance Optimization**: Optimized database queries and pagination for large datasets, particularly on pages like `Contratados.tsx`, reducing loading times significantly.
- **Fuel Pump Integration**: Integrated `bomba_gasolina` table for odometer readings, including price, liters, and photo management with granular access control via the Admin page.
- **Minuta Management**: Full minuta management in the Hodômetros module with search, filtering, and editing, including support for multiple `romaneio` numbers per minuta.
- **Hodômetro km_rodado Calculation**: 
  - **List View**: Frontend dynamically calculates `km_rodado` values using two modes (INTER-DAY and INTRA-DAY), prioritizing the highest reading of each day for accuracy and handling both automobiles and ciclomotors.
  - **Fuel Consumption Dashboard**: 
    - **KM Rodado**: Calculated as (most recent reading in selected period - very first reading ever registered in the system)
    - **Total Liters**: Sum of all fuel refills since the beginning (all-time total, not period-limited)
    - **Average Consumption**: km/L = total km rodado ÷ total liters abastecidos (all-time averages)
  - **Plate Normalization (Applied Globally)**:
    - **HodometrosLista.tsx**: Vehicle readings list consolidates by normalized plate (UPPERCASE)
    - **Fuel Consumption Dashboard**: All consumption metrics grouped by normalized plate
    - **HodometrosDashboard.tsx Charts**: "Quilometragem por Veículo" chart uses normalized plates
    - Implementation: All plates normalized to UPPERCASE before aggregation to prevent duplicates (e.g., "Hbz6f14" and "HBZ6F14" treated as "HBZ6F14")
    - Strategy: Calculate km_rodado per veiculo_id first (reliable), then consolidate by normalized plate for final display
- **Vagas Module**: Supports inline creation of related entities, real-time dashboard statistics, and a toggle for table/card grid views with preference persistence.
- **Deployment**: Configured for Replit with Vite dev server accepting all hosts (`0.0.0.0`) and Express backend bound to `0.0.0.0:5000`.

### System Design Choices
- **Build**: `tsx` for development, `esbuild` for backend production bundling, and Vite for frontend bundling.
- **Module System**: ES modules are used consistently.
- **Database Architecture**: Exclusively uses Supabase; local Replit database is disabled.
- **External Integrations**: Modular design, often routed through secure proxy systems (Supabase Edge Functions) for WiseApp API operations, including tag synchronization and secure token management.

## External Dependencies

### Core Framework & Development
- **React Ecosystem**: `@radix-ui/react-components`, `@tanstack/react-query`, `react-router-dom`, `react-hook-form`.
- **Styling**: `tailwindcss`, `shadcn/ui`, `class-variance-authority`.
- **Build Tools**: `vite`, `typescript`, `tsx`, `esbuild`.
- **Database SDK**: `@supabase/supabase-js`.
- **Validation**: `zod`.

### Third-party Services
- **Supabase**: Primary database, real-time features, and document storage.
- **WiseApp**: Integrated for messaging, chat functionality, and communication.
- **FIPE API (placas.fipeapi.com.br)**: For real-time vehicle data consultation.
- **CEP APIs (ViaCEP, BrasilAPI, PostMon, RepublicaVirtual)**: For address lookup with intelligent fallback.
- **CPF API**: For automatic data population in forms.

### Utilities & UI Enhancements
- **Date Handling**: `date-fns`.
- **Icons**: `lucide-react`.
- **Notifications**: `react-hot-toast`.
- **Excel Processing**: `xlsx`.
- **HTTP Client**: `axios` (for general external API requests).