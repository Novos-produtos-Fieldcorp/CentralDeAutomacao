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
- **Database**: PostgreSQL, accessed via Drizzle ORM and Neon Database's serverless driver.
- **Development**: Features hot reload integration with Vite middleware.
- **Session Management**: Currently in-memory, with plans for database persistence.

### Build and Development
- **Development**: Uses `tsx` for TypeScript execution and Vite's dev server.
- **Production**: `esbuild` for backend bundling and Vite for frontend bundling.
- **Module System**: ES modules are used consistently across the stack.

### Key Architectural Decisions
- **Authentication**: Dynamic context-based system using account IDs from URL parameters, enabling multi-company support with company-specific data isolation.
- **Database Layer**: Drizzle ORM for type-safe PostgreSQL interactions, Zod for schema validation, and connection pooling for performance. Database migrations are managed through Drizzle Kit.
- **UI/UX**: Emphasis on a comprehensive, responsive component library with dark/light theme support, consistent design via custom CSS variables, and streamlined user interactions.
- **Data Flow**: Custom React hooks and TanStack Query manage frontend-to-backend communication, ensuring company-filtered queries and data isolation.
- **External Integrations**: Designed for modular integration with third-party services like Supabase and WiseApp through a proxy system for secure communication.
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

## External Dependencies

### Core Framework & Development
- **React Ecosystem**: `@radix-ui/react-components`, `@tanstack/react-query`, `react-router-dom`, `react-hook-form`.
- **Styling**: `tailwindcss`, `shadcn/ui`, `class-variance-authority`.
- **Build Tools**: `vite`, `typescript`, `tsx`, `esbuild`.
- **Database**: `drizzle-orm`, `@neondatabase/serverless`, `pg` (for Drizzle Kit).
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