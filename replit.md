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
- **Hodômetro km_rodado Calculation with Reset Detection**: 
  - **Reset Detection Utility** (`client/src/utils/hodometroResetUtils.ts`):
    - `buildOdometerTimeline()`: Detects odometer resets (when reading decreases by >100 km) and creates segments
    - **Reset Tolerance**: 100 km threshold to ignore data entry errors (decreases < 100 km are treated as input mistakes)
    - Returns baseline value (first reading after last reset) for accurate calculations
    - Supports multiple resets throughout vehicle history
    - Type-safe TypeScript implementation with proper interfaces
    - Handles both automobiles (hod_lido) and ciclomotors (trip_lida)
  - **Vehicle Mileage Chart** (Quilometragem por Veículo): km_rodado = (latest valid reading in period) - (baseline after last reset)
    - Detects odometer resets chronologically
    - Uses baseline after last reset, not first-ever reading
    - Optimized: queries only vehicles present in the selected period
    - Skips null readings to find first and last VALID values
    - Groups by normalized plate (UPPERCASE) to consolidate duplicate entries
    - Handles negative values by detecting resets, not just clamping to 0
  - **List View**: Frontend dynamically calculates `km_rodado` values using two modes (INTER-DAY and INTRA-DAY), prioritizing the highest reading of each day for accuracy and handling both automobiles and ciclomotors.
  - **Fuel Consumption Dashboard**: 
    - **KM Rodado**: Calculated as (latest valid reading in selected period) - (baseline after last reset)
    - Uses reset detection utility for accurate calculations across resets
    - **Total Liters**: Sum of fuel refills up to YESTERDAY (excludes today's refills)
      - Fetches fuel records from startDate to (endDate - 1 day)
      - Logic: .gte('data', startDate).lte('data', yesterdayDate)
      - Excludes current day refills to reflect fuel already consumed
    - **Average Consumption**: km/L = km rodados no período ÷ litros abastecidos até ontem
    - Uses same optimized reset-aware logic as Vehicle Mileage Chart for consistency
    - This calculation reflects fuel efficiency: kilometers driven using fuel refilled before today
  - **Plate Normalization (Applied Globally)**:
    - **HodometrosLista.tsx**: Vehicle readings list consolidates by normalized plate (UPPERCASE)
    - **Fuel Consumption Dashboard**: All consumption metrics grouped by normalized plate
    - **HodometrosDashboard.tsx Charts**: "Quilometragem por Veículo" chart uses normalized plates
    - Implementation: All plates normalized to UPPERCASE before aggregation to prevent duplicates (e.g., "Hbz6f14" and "HBZ6F14" treated as "HBZ6F14")
    - Strategy: Calculate km_rodado per veiculo_id first (reliable), then consolidate by normalized plate for final display
- **Vagas Module**: Supports inline creation of related entities, real-time dashboard statistics, and a toggle for table/card grid views with preference persistence.
- **Comprovante de Rota Module**: Tabbed interface with Dashboard and Lista (List) views following the same pattern as Hodômetros and Checklist modules:
  - **Dashboard**: Statistics cards showing total comprovantes, today's count, monthly count, and active drivers; Top 5 drivers chart with visual progress bars
  - **Lista**: Professional table layout matching HodometrosRelatorio aesthetics with:
    - Period filter (Hoje, 15 dias, 30 dias, Personalizado with custom date range)
    - Search by motorista name or ID with safe null handling
    - **GPS Location Display with Reverse Geocoding** (ACTIVE):
      - Data fetched from `end_comprov_rota` table via LEFT JOIN on `id_comprov_rota`
      - Latitude/longitude stored as TEXT in database, converted to numbers in frontend
      - **Reverse Geocoding via Nominatim (OpenStreetMap)**:
        - Backend service (`server/geocoding-service.ts`) with in-memory cache (30-day TTL)
        - Rate limiting: 1 request/second (Nominatim compliance)
        - Batch endpoint: `POST /api/geocode/reverse/batch` for efficient processing
        - Request tracking system prevents stale updates from race conditions
      - Table column displays:
        * Full address (when geocoded successfully)
        * "Carregando..." state while fetching
        * Coordinates as fallback if geocoding fails
        * "Ver no mapa →" link (opens in Google Maps)
      - Modal displays full address + coordinates with "Abrir no Mapa" button
      - Proper handling of missing coordinates (shows "Não disponível")
    - **Bulk Download System (ZIP)** (ACTIVE):
      - Checkbox selection system (individual + "Selecionar Todos" button in header)
      - Download button appears when items are selected
      - Backend endpoint: `POST /api/comprov-rota/download-zip`
      - Automatic file naming: `{dd-MM-yyyy_HH-mm-ss}_{motorista_nome}.{extensao}`
      - Supports photos (.jpg) and videos (.mp4)
      - **Security Features (3-Layer SSRF Protection)**:
        * Layer 1: Zod payload validation
        * Layer 2: Host whitelist (WiseApp, Supabase only)
        * Layer 3: Allow controlled redirects (maxRedirects: 5) - Required for WiseApp Rails Active Storage URLs
      - **Smart Download Strategy**:
        * Handles data URIs (base64) and HTTP(S) URLs
        * Automatic fallback: If WiseApp URL returns 404, tries Supabase Storage
        * Tries multiple filename patterns: `{id}.jpg`, `{id}.mp4`, `comprovante_{id}.jpg`, etc.
      - **Error Tracking**: Detailed statistics (success/failure counts, failure reasons) logged for debugging
      - Continue-on-error: individual failures don't stop entire download
      - Frontend validation: Detects empty ZIPs and shows appropriate error messages
      - Automatic cleanup of selection after successful download
    - Excel export functionality (includes Address, Latitude, Longitude columns)
    - Pagination (25 items per page)
    - **Smart Media Loading System**: Comprehensive photo/video support with robust URL parsing
      - Handles multiple formats: base64 (images/videos), complete URLs, JSON arrays, comma-separated lists, single filenames
      - **Intelligent Type Detection**: Checks ORIGINAL `foto` field (not generated URL) for accurate video vs image detection
        * Detects `data:video/` MIME types in base64
        * Detects video file extensions (.mp4, .webm, .mov, etc.) in original data
        * Prevents false positives from URL-based detection (e.g., WiseApp Active Storage URLs don't show extensions)
      - Pre-computed URLs during data fetch for optimal performance
      - **No Thumbnails in Table**: Clean button-only interface for better performance and UX
      - **Icon-Only Media Buttons**:
        * Photos: Camera icon (📷) opens full-screen modal with location info
        * Videos: Video icon (🎬) opens video in new tab for browser-managed download/streaming
        * Tooltips on hover show action description
        * Icons sized at h-5 w-5 (20px) for clear visibility
      - **WiseApp Authentication Handling**: Graceful error handling for Rails Active Storage protected URLs
        - Clear error messages when media requires WiseApp authentication
        - "Abrir em nova aba" button (always visible) to open media in WiseApp directly
        - Error fallback UI with explanation and external link button
        - mediaLoadError state tracks loading failures for better UX
      - Error handling with detailed console logging
      - Supports WiseApp URLs and Supabase Storage URLs
    - Loading and error states with retry functionality
  - **Navigation**: Tab highlighting with `startsWith` logic for correct active state in nested routes
  - **Data Integrity**: Proper normalization of Supabase relation arrays to single objects before state updates
  - **Testing**: All interactive elements include data-testid attributes
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