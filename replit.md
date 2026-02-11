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
- **WiseApp Token Management**: Unified session cache, cross-context company synchronization, and token validation via Supabase Edge Functions. **Critical**: `WiseAppAccessContext` is the authoritative source for WiseApp `accountId` (derived from email's `id_conta_wiseapp` in database), not URL parameters.
- **Company Data Isolation**: Centralized `useCurrentAccount()` hook (in `client/src/hooks/useCurrentAccount.ts`) provides tenant-scoped `accountId` and `companyId` from WiseAppAccessContext. ALL tenant-aware components MUST use this hook instead of reading from AuthContext directly. The `switchAccount` function uses `queueMicrotask` to delay cache invalidation until after state commits, preventing stale data leakage.
- **Form Validation**: Enhanced CNH validation and real-time input sanitization.
- **Pagination**: Comprehensive system across lists with configurable page sizes.
- **License Plate API**: Real-time vehicle data consultation via FIPE API.
- **Vehicle Duplicate Prevention**: Validation in AddVeiculoModal prevents adding vehicles with existing plates. VeiculosEmpresa page includes a duplicate detection system that identifies and allows bulk removal of duplicate vehicle records (keeping the most recent entry per plate).
- **Performance Optimization**: Optimized database queries and pagination for large datasets.
- **Fuel Pump Integration**: `bomba_gasolina` table for odometer readings, including price, liters, and photo management with access control.
- **Minuta Management**: Full minuta management in the Hodômetros module with search, filtering, and editing, supporting multiple `romaneio` numbers.
- **Hodômetro km_rodado Calculation**: Advanced reset detection utility (`hodometroResetUtils.ts`) for accurate `km_rodado` calculation in charts and lists, handling both automobiles and ciclomotors. Includes a Fuel Consumption Dashboard with `km_rodado` and total liters calculations, grouped by normalized plate.
- **Vagas Module**: Supports inline entity creation, real-time dashboard statistics, and configurable table/card grid views.
- **Comprovante de Rota Module**: Tabbed interface with Dashboard and List views. Features include statistics cards, driver rankings, media analytics (photos/videos), GPS location display from database relations, and a bulk ZIP download system (frontend-only using JSZip). Smart media loading system handles various formats and WiseApp authentication.
- **Operações Module**: Comprehensive module for trip and operations management featuring:
  - **Dashboard Tab**: Statistics cards, 30-day histogram with daily trip counts (weekday/weekend differentiation), and custom operations cards with gradients. Uses `km_rodado` directly from database (generated column).
  - **Viagens Tab**: Filterable list with operation type, driver, and date range filters. Auto-refresh every 30 seconds.
  - **Financeiro Tab**: Lists billing records (faturamento) by operation with vehicle model prices and driver commissions. Global date filter (15 days, 30 days, custom range with calendar). Multi-tenant isolation via company_id filtering.
  - **Preços Tab**: Edit operation-specific pricing (vehicle models and driver commissions). Features: inline editing, save/cancel actions, error handling.
  - **SADA Operation**: Complex pricing model with 10 vehicle models (familia_basica, compass, toro, commander, jlr, rampage, titano, scudo, ducato, caminhoes) + 2 commission types (Cegonha per vehicle, Prancha fixed). Intelligent modelo field parsing for multi-vehicle trips (e.g., "2 compass e 1 toro"). Table: `faturamento_sada`.
  - **SUPERTERMINAIS Operation**: Simple flat pricing model. R$135/trip fixed rate + R$10 driver commission per trip. Table: `faturamento_superterminais`.
  - **Enhanced Detail Modal**: Operation-specific layouts for each of the 6 operation types (Autoservice, Cesari, Mitsubishi, Sada, Superterminais, Tegma). Features include:
    - Automatic translation of numeric codes (tipo_carreta: 0=Prancha/1=Cegonha, capacidade: 0=Vazio/1=Cheio, embarque_desembarque: 0=Embarque/1=Desembarque)
    - Photo thumbnails with lightbox preview for ft_cautela, ft_manifesto, ft_tablet, foto_viagem fields
    - Boolean badges with icons for pernoite, fim_de_semana, retorno, janta fields
    - Organized sections (Rota, Veículos, Cliente, 1ª/2ª Puxada for Tegma, 1ª/2ª Viagem for Cesari)
    - Gradient header matching operation color theme
  - Access controlled via `operacoes_access` column in company table.
  - **Faturamento Tables**: 
    - `faturamento_sada`: Stores pricing per vehicle model (familia_basica, compass, toro, commander, jlr, rampage, titano, scudo, ducato, caminhoes) and driver commissions (comissao_motorista_prancha, comissao_motorista_cegonha).
    - `faturamento_superterminais`: Stores flat pricing (ganho_por_viagem, comissao_motorista) as integers with default values 135 and 10. No updated_at column.
    - `faturamento_mitsubishi`: Stores pricing per vehicle (preco_por_veiculo), driver commission (comissao_motorista), and helper commission (comissao_ajudante) as text strings.
    - `faturamento_autoservice`: Stores pricing as bigint integers (valor_por_veiculo, comissao_motorista, comissao_ajudante) plus text fields (forma_pagamento_motorista, forma_pagamento_ajudante). Has updated_at column.
  - **MITSUBISHI Operation**: Per-vehicle pricing model. Revenue = preco_por_veiculo * qtd_carro per trip. Separate commissions for driver and helper. Table: `operacao_mitsubishi` (id_operacao, id_viagem FK, origem, destino, frota, tipo_carreta, qtd_carro, modelo_carro, km_chegada_porto, data_hora_chegada_porto, nr_viagem). Financeiro tab has dashboard with 4 summary cards + trip list table.
  - **AUTOSERVICE Operation**: Per-vehicle pricing model (same as Mitsubishi). Revenue = valor_por_veiculo * qtd_carro per trip. Separate commissions for driver and helper + payment method fields. Table: `operacao_autoservice`. Financeiro tab has dashboard with 4 summary cards + trip list table. Preços tab has 5-field form (3 monetary + 2 payment method).
  - **TEGMA Operation**: Fixed per-trecho pricing model. Revenue = valor_por_trecho (R$500) per trip regardless of route. Driver commission varies by carreta type: carreta vazia = R$15, carreta cheia = R$20. Type determined by `tipo_viagem` field. Table: `operacao_tegma` (id_viagem FK, tipo_viagem, placa_carreta, nr_cautela, ft_cautela, origem, destino, foto_viagem, nr_viagem, retorno, empresa, qtd_carros, placa_veiculo_transportado, plus p2_* fields for 2nd leg). Financeiro tab has 3 summary cards + trip list table. Preços tab has 3-field form (valor_por_trecho, comissao_motorista_carreta_vazia, comissao_motorista_carreta_cheia). Table: `faturamento_tegma` (bigint values).
  - **Backend API Proxy**: Mitsubishi, Autoservice, and Tegma pricing/financeiro queries route through Express backend endpoints using service_role key to bypass Supabase RLS. Endpoints: GET/POST `/api/operacoes/faturamento/:operacao`, GET `/api/operacoes/financeiro/:operacao/:companyId`.
- **Database Schema Notes**: The `cliente` table uses `st_cliente` (not `ativo`) for active status. City data (`nome_cidade`) should be fetched from views like `vw_agregados_completo` or `vw_motoristas_completo`, not directly from `end_motorista` table.
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
- **Groq AI (via CrewAI)**: AI-powered group summary generation service.

### AI Summary Service (ai_service/)
- **Technology**: Python 3.11 with CrewAI framework and FastAPI
- **LLM Provider**: Groq (llama-3.1-70b-versatile model)
- **Port**: 8000 (internal, proxied through Express on port 5000)
- **Endpoints**:
  - `POST /api/group-summary`: Generate AI summary for a group/inbox
  - `POST /webhook/resumo-grupo`: Webhook compatibility endpoint
  - `GET /health`: Health check endpoint
- **Agents**:
  - Group Summary Analyst: Analyzes conversations and generates executive summaries
  - Insights Analyst: Extracts insights and metrics from analyzed conversations
- **Configuration**: Requires `GROQ_API_KEY` environment variable
- **Integration**: Replaces previous n8n webhook integration for group summaries
- **Features**:
  - Optional inbox_id: Generates basic summary if inbox not configured
  - Automatic summary delivery: Sends generated summary back to WiseApp group
  - Group name matching: Uses group name to target correct conversation
  - Response includes message_sent and send_error for delivery status monitoring
- **Future Improvement**: Implement deterministic conversation targeting using group_id mapping

### Utilities & UI Enhancements
- **Date Handling**: `date-fns`.
- **Icons**: `lucide-react`.
- **Notifications**: `react-hot-toast`.
- **Excel Processing**: `xlsx`.
- **HTTP Client**: `axios`.