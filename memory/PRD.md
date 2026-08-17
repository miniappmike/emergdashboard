# WORKBENCH — Team Dashboard & Notes Platform

## Problem Statement
Lightweight, browser-based team collaboration platform centered on a per-user free-form draggable canvas of "window" cards (notes, files, widgets). Content (files/notes) has an owner + Private/Shared visibility. Users belong to multiple orgs and switch context via a header dropdown. Real-time chat + activity + notifications over WebSocket; canvas layout is per-user and refresh-based. Granular per-member permission toggles (no roles). Trust-critical visibility/permission model.

## Stack (adapted to environment)
React + FastAPI + MongoDB. JWT auth (login with email OR username). Emergent S3 object storage. WebSocket at `/api/ws?token=`. Lightweight built-in HTML-canvas whiteboard. Theme: grey/navy/red/white, light default + dark toggle.

## User Personas
- Org owner/admin (full permissions, composes each member's trust individually)
- Delegated member (can be granted invite/permission/delete rights)
- Regular member (view+upload shared ON by default; rest OFF)

## Core Requirements (static)
- Per-user canvas; content owner + Private/Shared; org-level default visibility
- Granular permissions: view/upload (default ON), manage-requests/delete-shared/invite/manage-perms (default OFF); owner untouchable
- API-layer enforcement: nobody (incl. admin) can delete/view another member's PRIVATE content
- Multi-org membership + switcher; last_active_org_id persistence
- Real-time only for chat, activity feed, notifications

## Implemented (as of 2026-06)
### Phase 1-6.5 delivered + extras
- Auth: JWT register/login (email or username), profile, password change, avatar (circular)
- Orgs: create, list, switch, default-visibility, **team logo upload** (admin)
- Invites: public join link + join requests (approve/deny); invite by email
- Members list w/ avatars, contact visibility toggles; per-member permissions grid
- Notes: CRUD, autosave (debounced), Private/Shared, folders, sort, title search, rich text, built-in whiteboard, **image paste/upload inside notes**, pin to canvas
- Files: drag-drop upload w/ visibility+caption, tiered preview (text/csv/image/pdf/audio/sheet + download fallback), **folders**, **rename**, visibility toggle, delete, pin to canvas
- Canvas: react-rnd draggable/resizable/minimizable windows; widgets (chat, activity, recent files/notes); layout persistence; personal appearance (bg color/image, outline color/width, text size/color, auto-adapt luminance)
- Shared Library w/ type + owner filters
- Chat: team-wide + **named channels** + DMs; @mentions + @team; **real-time live append** (WebSocket)
- Activity bell dropdown + Notifications inbox (cross-org, filters, mark/clear read) w/ unread badge (live)
- Full-text-ish search across notes/files/chat (permission-scoped)
- Light/dark theme toggle

### Bugs fixed & verified
- WebSocket path moved `/ws` -> `/api/ws` (ingress routing) → live chat/notifications work
- Canvas readability: window cards use own card-foreground (no white-on-white); dot grid persists over solid bg
- Toast moved to bottom-right (was overlapping header controls)

## Seed Data
Marcus Chen (admin@example.com/admin123, owner Northwind Studio, member Blue Harbor). Olivia Brooks, Daniel Reeves (upload-shared OFF), Priya Nair (manage-requests). Two orgs with overlapping membership; sample notes/files/chat (@team + @mention). Credentials in /app/memory/test_credentials.md.

## Backlog (not yet built)
- P1: Phase 7 Postgres-grade FTS (currently regex), Phase 8 offline IndexedDB + service worker, Phase 13 Team Calendar (events seeded, UI pending)
- P2: Phase 9 email/password confirmation flows, Phase 10 richer per-org isolation polish, Phase 11 image-bg luminance sampling, Phase 14 virtualization/optimistic polish
- Post-MVP: note version history, dashboard templates, read receipts/typing, bulk permission presets

## Next Tasks
- Team Calendar UI (month/week + pinnable widget)
- Offline-first caching (IndexedDB + service worker)
