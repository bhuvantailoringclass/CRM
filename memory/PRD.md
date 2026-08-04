# BIFD Institute Management ERP — PRD

## Original Problem
Full-stack internal ERP for Bhuvan Institute of Fashion Design (BIFD) replacing 19 physical registers with one connected system. Two roles (Admin, Teacher) with strict RBAC.

## Architecture
- Stack: React (CRA) + FastAPI + MongoDB (motor).
- Auth: Emergent-managed Google login (session_token httpOnly cookie + Bearer fallback). Roles: admin (ADMIN_EMAILS), teacher (in `teachers` collection, active), denied (everyone else).
- Registers stored in `reg_<name>` collections; generic CRUD + CSV export via `/api/registers/{name}`. Audit trail in `audit_log`.
- Daily DB backup via `.emergent/crons.yml` → `/api/cron/backup` (mongodump to /app/backups, secured by WEBHOOK_CRON_SECRET).

## Personas
- Admin (office/owner): manages all 19 registers, dashboard, teacher accounts.
- Teacher: marks attendance for assigned courses only; read-only history; no other data.

## Implemented (2026-06)
- Google auth + role-based redirect + role-gated grouped sidebar.
- Admin dashboard: active students, today's attendance %, fees collected vs due, overdue fees, faculty, assets, fire-safety due, recent certs/visitors, global search.
- All 19 registers (Admission master + Attendance, Fee, Course, Certificate, Placement, Faculty, Faculty Attendance, Scholarship, Cash Book, Bank Book, Purchase, Income, Expense, Salary, Asset, Correspondence, Visitor, Fire Safety) with searchable/sortable/date-filterable tables, slide-in add/edit forms, delete, CSV export.
- Admission auto-generates student_id (BIFD-XXXX); student/course reference pickers link records.
- Teacher flow: course/date selection, roster, Present/Absent/Late + remark, submit (locked after submit), read-only history. Mobile-responsive.
- Admin teacher-account management (add/edit/deactivate, assign courses).
- Audit trail on all writes; automatic daily backup cron.
- Verified: 23/23 backend tests + full admin & teacher Playwright walkthrough passed.

## Admin accounts
- bhuvantailoringclass@gmail.com, admin@bifd.com (see /app/memory/test_credentials.md)

## Backlog / Not yet built
- P1: Photo/document uploads (student photos, faculty docs) — deferred per user.
- P1: PDF export / printable certificate template (CSV done; PDF pending).
- P2: Audit-log viewer UI; running-balance auto-calc for Cash/Bank books; enrolled-count auto on courses; faculty-absentee & fire-safety notification surfacing beyond dashboard.
