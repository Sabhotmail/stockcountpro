# BKK3 Hub Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hub entity under BKK3, classify Express locations into hub vs HQ central documents, and enforce hub-scoped access/sync.

**Architecture:** Prisma `Hub` + `UserHub`; `CountDocument.hubId`/`isCentral`; `classifyLocation()` in `express-location.ts`; sync groups lines per hub/central doc; session carries `hubIds`.

**Tech Stack:** Next.js 16, Prisma/PostgreSQL, TypeScript

**Spec:** `docs/superpowers/specs/2026-07-10-bkk3-hub-model-design.md`

---

### Task 1: Schema + migration
- Hub, UserHub, CountDocument.hubId/isCentral, partial unique indexes

### Task 2: classifyLocation + permissions
- Constants, parse rules, unit tests

### Task 3: Services
- express-sync grouping, document-access, count-document filter

### Task 4: Admin + auth
- Hub CRUD APIs, user hub assignment, session hubIds

### Task 5: UI + seed
- /admin/hubs, ExpressSyncPanel badges, BKK3 seed data
