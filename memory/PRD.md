# BIFD Institute Management ERP — PRD

## Original Problem
Full-stack internal ERP for Bhuvan Institute of Fashion Design (BIFD) replacing physical registers with one connected system. Two roles (Admin, Teacher) with strict RBAC.

## Architecture
- Stack: React (CRA) + FastAPI + MongoDB (motor).
- Auth: Emergent-managed Google login (session_token httpOnly cookie + Bearer fallback). Roles: admin (ADMIN_EMAILS), teacher (in `teachers` collection, active), denied.
- Registers stored in `reg_<name>` collections; generic schema-driven CRUD + CSV/Excel export via `/api/registers/{name}`. Audit trail in `audit_log`.
- Dynamic field schemas in `register_schemas` (absent = use frontend defaults). Daily DB backup via `.emergent/crons.yml` → `/api/cron/backup`.

## Personas
- Admin/Super Admin (owner/office): manages all registers, their field structures, dashboard, teacher accounts.
- Teacher: marks attendance for assigned courses only; read-only history.

## Implemented
- Google auth + role-based redirect + role-gated grouped sidebar.
- Admin dashboard (active students, attendance %, fees collected vs due, overdue, faculty, assets, fire-safety, recent certs/visitors) + global search.
- 27 registers across Student / Staff / Accounts / Administrative groups, each with searchable/sortable/date-filterable table, Sl.No auto serial, add/edit/delete, Excel + CSV + PDF + Print, Audit Log viewer.
- Auto IDs: student BIFD-, staff STF-, asset AST-, certificate CERT-, receipt RCP-, complaint CMP-.
- Cash & Bank registers auto-compute running Balance (backend, order-independent).
- Teacher attendance flow (locked after submit) + read-only history; mobile responsive.
- **Dynamic Field Management (Register Settings)**: per-register ⚙ page to rename (label only; stable key = data-safe), add unlimited custom fields (14 types: text/longtext/number/currency/date/time/email/phone/dropdown/checkbox/yesno/image/file/signature + student/course links), drag-reorder, hide/show, required toggle, lock (prevents delete; auto-IDs locked), archive (soft-delete with restore) + permanent remove, restore defaults. Changes reflect across forms/table/search/filters/exports/PDF/print. Only admin can edit structure. Verified 31/31 backend + full frontend E2E.

## Admin accounts
- bhuvantailoringclass@gmail.com, admin@bifd.com

## Backlog / Not yet built
- P1: Real object-storage uploads (image/file/signature currently stored as base64 data URLs, 2MB cap).
- P1: PDF true-file export / branded certificate template (currently print-window based).
- P2: Auto-fill for renamed link keys; per-field permission granularity; audit-log for schema at field level; running-balance also for Stock.

## Update (2026-06) — Register Management (admin-only)
- New admin page /settings/registers + backend /api/register-mgmt (GET/POST/PUT) with new `register_defs` collection.
- Admin can view all registers, add new custom registers (auto-slug unique key; starter fields Date/Particulars/Amount/Remarks seeded into register_schemas), rename (label), activate/deactivate (deactivated hidden from sidebar, data preserved). Duplicate name/key rejected (400).
- check_register() is now async and also accepts custom register keys; all generic CRUD/export/schema endpoints work for customs unchanged. Builtins and their data untouched.
