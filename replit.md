# Fleet Management Application

## Overview
This full-stack web application provides a centralized solution for multi-company fleet management, optimizing operations for drivers, vehicles, clients, and workflows such as checklists and odometer readings. It incorporates dynamic authentication, job vacancy management, efficient document handling, and integrations with external services. The primary goal is to enhance efficiency and data consistency within the logistics sector, offering a robust platform for fleet managers. The project aims to provide a comprehensive tool that streamlines complex fleet operations and improves overall productivity.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application utilizes React 18 with TypeScript, Vite, Tailwind CSS, Radix UI, and shadcn/ui for a responsive and consistent user experience, including custom dark mode and a comprehensive component library.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, React Router, and TanStack Query.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL via Supabase, leveraging real-time features and Row Level Security (RLS) for multi-tenancy.
- **Authentication**: Dynamic, context-based system using account IDs for multi-company support and data isolation. Includes mandatory email authentication for WiseApp token management.
- **Data Flow**: TanStack Query with direct Supabase calls for optimized caching and state management.
- **WhatsApp Integration**: Seamless photo capture and display using WiseApp API, with automatic storage in Supabase.
- **Document Management**: Direct upload to Supabase Storage with validation.
- **WiseApp Token Management**: Unified session cache, cross-context company synchronization, and token validation via Supabase Edge Functions.
- **Form Validation**: Enhanced CNH validation and real-time input sanitization.
- **Pagination**: Comprehensive system across lists with configurable page sizes.
- **License Plate API**: Real-time vehicle data consultation via FIPE API.
- **Performance Optimization**: Optimized database queries and pagination for large datasets.
- **Fuel Pump Integration**: `bomba_gasolina` table for odometer readings, including price, liters, and photo management with access control.
- **Minuta Management**: Full minuta management in the Hodômetros module with search, filtering, and editing, supporting multiple `romaneio` numbers.
- **Hodômetro km_rodado Calculation**: Advanced reset detection utility (`hodometroResetUtils.ts`) for accurate `km_rodado` calculation in charts and lists, handling both automobiles and ciclomotors. Includes a Fuel Consumption Dashboard with `km_rodado` and total liters calculations, grouped by normalized plate.
- **Vagas Module**: Supports inline entity creation, real-time dashboard statistics, and configurable table/card grid views.
- **Comprovante de Rota Module**: Tabbed interface with Dashboard and List views. Features include statistics cards, driver rankings, media analytics (photos/videos), GPS location display from database relations, and a bulk ZIP download system (frontend-only using JSZip). Smart media loading system handles various formats and WiseApp authentication.
- **Deployment**: Configured for Replit with Vite dev server and Express backend.

### System Design Choices
- **Build**: `tsx` for development, `esbuild` for backend production, and Vite for frontend.
- **Module System**: Consistent use of ES modules.
- **Database Architecture**: Exclusively Supabase; local Replit database disabled.
- **External Integrations**: Modular design, often routed through secure proxy systems (Supabase Edge Functions) for WiseApp API operations and secure token management.

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
- **CEP APIs**: ViaCEP, BrasilAPI, PostMon, RepublicaVirtual for address lookup.
- **CPF API**: For automatic data population in forms.

### Utilities & UI Enhancements
- **Date Handling**: `date-fns`.
- **Icons**: `lucide-react`.
- **Notifications**: `react-hot-toast`.
- **Excel Processing**: `xlsx`.
- **HTTP Client**: `axios`.