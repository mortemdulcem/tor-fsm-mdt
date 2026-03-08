# Tor FSM Invalid State Transition Detection Dashboard

## Overview
A fullstack web application for analyzing Tor network protocol security vulnerabilities through Finite State Machine (FSM) modeling and invalid state transition detection.

## Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend), Express (backend)

## Key Features
- FSM simulation of Tor circuit lifecycle (IDLE -> CONNECTING -> TLS_HANDSHAKE -> CREATE_SENT -> CIRCUIT_BUILDING -> CIRCUIT_READY -> TRANSMITTING -> CLOSING -> CLOSED)
- Automatic detection of invalid state transitions
- Security violation classification (CIRCUIT_BYPASS, REPLAY_ATTACK, GHOST_CIRCUIT, HANDSHAKE_SKIP, PREMATURE_DATA, CIRCUIT_HIJACK, CREATE_FLOOD)
- Test run management with transition history and violation logs
- Interactive dashboard with data visualization

## Database Schema
- `test_runs`: Stores simulation test runs (id, name, status, createdAt)
- `transitions`: Records each FSM state transition (fromState, event, toState, isValid)
- `violations`: Logs security violations with severity and attack type classification

## API Routes (defined in shared/routes.ts)
- `GET /api/test-runs` - List all test runs
- `POST /api/test-runs` - Create a new test run
- `GET /api/test-runs/:id` - Get specific test run
- `GET /api/test-runs/:testRunId/transitions` - Get transitions for a test run
- `GET /api/test-runs/:testRunId/violations` - Get violations for a test run
- `GET /api/violations` - Get all violations
- `POST /api/fsm/simulate` - Run FSM simulation

## Project Files
- `shared/schema.ts` - Database schema and types
- `shared/routes.ts` - API contract with Zod validation
- `server/db.ts` - Database connection
- `server/storage.ts` - Data access layer
- `server/routes.ts` - API route handlers + FSM simulator
- `client/src/pages/dashboard.tsx` - Main dashboard
- `client/src/pages/test-run-details.tsx` - Test run detail view

## Generated Documents
- `client/public/Proje_Onerisi_Plani.docx` - Academic project proposal (Turkish)
