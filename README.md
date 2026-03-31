# expense-saas-pipeline

> Production-grade OCR receipt ingestion and expense management platform for multi-tenant financial SaaS.

Built and hardened over 6 weeks of active development — from raw document ingestion through AI extraction, confidence gating, approval workflows, and audit logging.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT UPLOAD                            │
│                    (org-scoped S3 path)                         │
└─────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   S3 INGESTION WORKFLOW                         │
│  • Binary transform → org-prefixed S3 path                      │
│  • UUID-based idempotent document record upsert (Supabase)      │
│  • Validates integrity before OCR handoff                       │
└─────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AWS TEXTRACT OCR                              │
│  • Structured receipt field extraction                          │
│  • Normalization: vendor, date, total, tax                      │
│  • tc_doc_ocr_runs logging per document                         │
└─────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              CONFIDENCE SCORING + GATING                        │
│  • Deterministic confidence gate                                │
│  • ≥ threshold → auto-approve pipeline                          │
│  • < threshold → flagged for human review                       │
└──────────┬──────────────────────────────┬───────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐      ┌───────────────────────────────────┐
│  EXPENSE EXTRACT     │      │         HUMAN REVIEW QUEUE        │
│  AGENT (v1_W3)       │      │  • Flagged records surfaced in UI  │
│  • Schema validation │      │  • Reviewer approves / corrects    │
│  • AI normalization  │      │  • Feeds back into approved path   │
│  • Audit insert      │      └───────────────────────────────────┘
└──────────┬───────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  APPROVAL WEBHOOK SYSTEM                        │
│  • DRAFT → APPROVED / REJECTED state machine                    │
│  • Update safeguards (no invalid transitions)                   │
│  • Full audit event log per status change                       │
└─────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NEXT.JS DASHBOARD                             │
│  • Financial Summary · Vendor Breakdown                         │
│  • OCR Confidence Heatmap · Approval Pipeline                   │
│  • Project-level analytics · CSV export                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Workflow Orchestration | n8n v2.3.5 |
| OCR | AWS Textract |
| Storage | AWS S3 (org-scoped, Block Public Access enforced) |
| Database | Supabase (PostgreSQL + pgcrypto) |
| AI Extraction | OpenAI (GPT-4o) |
| Frontend | Next.js (App Router) · TypeScript · Tailwind CSS |
| Infrastructure | Docker · Coolify |

---

## Key System Properties

**Multi-tenant isolation**
Every document, expense record, and S3 path is scoped to an `org_id`. No cross-tenant data leakage by design. RLS enforced at the Postgres layer.

**Idempotent ingestion**
Documents use UUID-based paths in S3 and upsert logic in Postgres — re-processing the same receipt never creates duplicate records.

**Deterministic state machine**
Expenses follow a strict `DRAFT → APPROVED / REJECTED` lifecycle. Invalid transitions are blocked at the webhook layer, not just the UI.

**Confidence-gated OCR**
Every OCR run produces a confidence score logged to `tc_doc_ocr_runs`. Low-confidence extractions are automatically routed to human review rather than silently failing.

**Full audit trail**
Every status change, extraction event, and approval decision is written to an append-only audit log. Nothing is deleted, nothing is overwritten.

---

## Workflow Files

| File | Description |
|---|---|
| `workflows/01_s3_ingestion.json` | Document upload → S3 → Supabase upsert |
| `workflows/02_textract_ocr.json` | Textract extraction + normalization layer |
| `workflows/03_expense_extract_v1.json` | AI extraction agent with schema validation |
| `workflows/04_approval_webhook.json` | State machine + audit logging |
| `workflows/05_csv_export.json` | Approved expense export → S3 → audit event |

> Import any workflow: n8n → **Import Workflow** → upload `.json` → add credentials → test.

---

## Database Schema

See [`schema/expense_schema.sql`](./schema/expense_schema.sql) for the full Postgres schema including:
- `tc_expense_records` — core expense table with constraints, indexes, foreign keys
- `tc_doc_ocr_runs` — per-document OCR confidence logging
- Org/client/project relational structure
- `updated_at` trigger
- `pgcrypto` UUID generation

---

## S3 Security Posture

- Block Public Access enabled on all buckets
- Public read bucket policy removed
- Object ownership enforced (bucket owner enforced)
- All paths org-prefixed: `/{org_id}/documents/`, `/{org_id}/exports/`
- Signed URLs used for all frontend asset delivery — no public URLs

---

## Frontend Dashboards

Built in Next.js App Router with dynamic `[org]` and `[client]` segments:

- **Financial Summary** — totals, trends, period comparison
- **Vendor Breakdown** — spend by vendor with drill-down
- **OCR Confidence Heatmap** — visual confidence distribution across documents
- **Approval Pipeline** — pending / approved / rejected queue
- **Project Analytics** — expense breakdown per project
- **CSV Export** — approved expenses → download or S3 archive

---

## Security & Production Readiness

- [x] RLS enforced at Postgres layer
- [x] Tenant isolation validated across all query paths
- [x] S3 Block Public Access + IAM scoping
- [x] Signed URL delivery for private assets
- [x] Append-only audit logging
- [x] Database indexing strategy reviewed
- [x] No raw financial values stored as text (NUMERIC types enforced)
- [x] BIGINT timestamps throughout (no integer overflow)

---

## Development Timeline

| Date | Milestone |
|---|---|
| Feb 4–5 | S3 upload workflow, document ingestion, binary handling |
| Feb 6 | Textract integration + normalization layer |
| Feb 7 | OCR confidence scoring system + `tc_doc_ocr_runs` |
| Feb 8 | Expense extraction agent (schema validation, audit insert) |
| Feb 9 | `tc_expense_records` schema — constraints, indexes, FK, triggers |
| Feb 10 | Approval webhook — state machine + audit logging |
| Feb 11 | CSV export pipeline → S3 + audit event |
| Feb 12–13 | Next.js dashboards + multi-tenant routing |
| Feb 14 | S3 security hardening — Block Public Access, ownership |
| Feb 15 | Production readiness audit — RLS, indexing, SaaS security posture |
| Mar 4 | Full pipeline debug — idempotent upsert, multi-stage validation |

---

## Author

**Connor Carey** — AI Systems Engineer · Founder @ [Simplifi AI LLC](https://gosimplifi.io)
[LinkedIn](https://linkedin.com/in/connor-carey15) · [GitHub](https://github.com/Carey1534)
