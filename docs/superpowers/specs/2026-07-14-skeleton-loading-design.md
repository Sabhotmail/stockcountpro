# Skeleton Loading Design

**Date:** 2026-07-14  
**Scope:** All data-loading pages (Admin, Supervisor, Tablet, Print, Sync panel)

## Goal

Replace plain `กำลังโหลด...` text with shared skeleton placeholders so loading feels consistent.

## Approach

Shared primitives + a few layout helpers (Approach 1):

| Component | Use |
|-----------|-----|
| `ui/skeleton` | Base pulse block |
| `TableRowsSkeleton` | Document lists / tables |
| `DetailSkeleton` | Document detail / review / versions |
| `FormCardsSkeleton` | Users, branches, hubs, settings |
| `CountDocumentSkeleton` | Tablet count + summary + print |

## Out of scope

- Login submit button text (keep `กำลังเข้าสู่ระบบ...`)
- Per-page pixel-perfect layout cloning

## Success

Every page that currently shows `กำลังโหลด...` while fetching shows a skeleton instead.
