# HQ Document History Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Admin/HQ document browser + searchable audit logs per UX-revised spec.

**Architecture:** Admin-only APIs in `admin.service.ts`; pages under `/admin/documents`; reuse AuditLogPanel + VersionCompare* ; existing versions APIs already work for HQ via document access.

**Tech Stack:** Next.js App Router, Prisma, existing Admin UI patterns.

---

### Task 1: Admin document + audit search services/APIs
- [ ] Add list/detail helpers in admin.service
- [ ] Extend listAuditLogsForAdmin with q/documentDate
- [ ] Wire API routes

### Task 2: Admin documents UI
- [ ] List page with single search + date + status
- [ ] Detail page with recount banner + tabs (audit / versions)

### Task 3: Audit Log UX + nav
- [ ] Simplify audit-logs page search
- [ ] AdminNav link
- [ ] Verify tsc, commit, push
