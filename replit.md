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
- **WiseApp Tag Operations**: All tag operations (create, delete, sync, assign individual/bulk) now correctly use:
  - `wiseapp-account-id` header: Always converted to String from `id_conta_wiseapp` for proper WiseApp account routing
  - API URLs: MUST include `companyId` in path: `/api/wiseapp/${companyId}/contacts/${contactId}/labels`
  - Account isolation: Backend uses `wiseapp-account-id` header to route requests to correct WiseApp account
  - Bidirectional sync: Syncs FROM WiseApp TO local DB (adds what's in WiseApp but not in DB, removes what's in DB but not in WiseApp)
  - Label structure: WiseApp API uses `name` field for tag names when reading, accepts `labels` array when writing
  - Contact labels: Uses `/contacts/` endpoint (NOT `/conversations/`) with payload `{labels: ["tag1", "tag2"]}`
  - Fixed in: TagAdministration, TagManager, BulkActionsModal (GET/POST), MotoristaTagsManager (GET/POST/DELETE)
  - Backend routes: `/api/wiseapp/:companyId/contacts/:contactId/labels` (GET/POST/DELETE) fully implemented

## Recent Changes

### October 27, 2025 - Fixed WiseApp Authentication Not Saving to Database
- **Issue**: WiseApp authentication was not creating new records in `wiseapp_acesso` table
- **Root Causes**:
  1. `handleEmailSubmit` was trying to INSERT record before user provided name and token (attendantName was empty)
  2. INSERT statement included non-existent column `company_id` (table only has `id_conta_wiseapp`)
  3. Wrong flow: INSERT happened in email step instead of token step
- **Fixes Applied**:
  1. Removed premature INSERT from `handleEmailSubmit` - now only checks if email exists
  2. Moved INSERT logic to `handleTokenSubmit` when `requiresAttendantName=true` (new user)
  3. Fixed INSERT to use correct columns: `email`, `nome`, `id_conta_wiseapp`, `access_token_wiseapp`
  4. Kept UPDATE logic in `handleTokenSubmit` for existing users (`requiresAttendantName=false`)
- **Table Structure**: `wiseapp_acesso` has: `wiseapp_acesso_id`, `email`, `id_conta_wiseapp`, `access_token_wiseapp`, `created_at`, `nome`
- **Files Modified**: `client/src/components/WiseAppTokenModal.tsx`
- **Impact**: New users can now authenticate and have records properly saved to database

### October 17, 2025 - Fixed Tag Limit Update UI Refresh
- **Issue**: After updating the maximum limit of associates for a tag, the card didn't update without page reload
- **Root Causes**:
  1. `EditTagModal` wasn't updating `formData` when `tag` prop changed
  2. `updateTagMutation` was invalidating queries with wrong key (`accountId` instead of `companyId`)
  3. `deleteTagMutation` had the same key mismatch issue
- **Fixes Applied**:
  1. Added `useEffect` to `EditTagModal` to sync `formData` with `tag` prop changes
  2. Changed query invalidation from `["local-tags", accountId]` to `["local-tags", companyId]` in both update and delete mutations
  3. Added `refetchQueries` to force immediate UI update after mutations
- **Files Modified**: `client/src/components/TagAdministration.tsx`
- **Impact**: Tag cards now update immediately when limit is changed, no reload needed

### October 17, 2025 - Fixed Tag Assignment (Individual & Bulk)
- **Issue**: Tag assignment to contacts was failing in both individual and bulk operations
- **Root Causes**: 
  1. Edge Function was incorrectly mapping `companyId` (from URL) to `id_conta_wiseapp` when searching for WiseApp tokens
  2. Missing GET route for `/wiseapp/:companyId/contacts/:contactId/labels` preventing label retrieval
- **Fixes Applied**:
  1. **GET `/wiseapp/:companyId/contacts/:contactId/labels`**: Added new route to retrieve contact labels from WiseApp
  2. **POST `/wiseapp/:companyId/contacts/:contactId/labels`**: Fixed to first query `company` table for `id_conta_wiseapp`, then use that to find WiseApp token
  3. Both routes now properly handle company-to-account ID mapping and include comprehensive error logging
- **Files Modified**: `supabase/functions/api/index.ts`
- **Impact**: Individual tag assignment, bulk tag assignment, and tag synchronization now work correctly
- **Deployment**: Requires Supabase Edge Function redeployment with `supabase functions deploy api`

### October 17, 2025 - Fixed Tag Creation in Netlify Deployment  
- **Issue**: Tag creation was failing with 422 error on Netlify deployment when using Supabase Edge Functions
- **Root Cause**: Supabase Edge Function was not transforming request body format from `{name, color}` to WiseApp API format `{title, color, description}`
- **Fix**: Updated `supabase/functions/api/index.ts` POST `/wiseapp/:companyId/labels` handler to:
  - Parse request body as JSON and transform field names
  - Handle duplicate tags (422 error) by fetching existing tag
  - Return properly formatted responses
- **Files Modified**: `supabase/functions/api/index.ts`
- **Deployment**: Requires Supabase Edge Function redeployment with `supabase functions deploy api`

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