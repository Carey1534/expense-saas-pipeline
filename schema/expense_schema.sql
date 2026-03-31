-- ============================================================
-- expense-saas-pipeline
-- Postgres schema for multi-tenant expense management platform
-- Built on Supabase (PostgreSQL + pgcrypto)
-- ============================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE tc_orgs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENTS (belong to orgs)
-- ============================================================
CREATE TABLE tc_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES tc_orgs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_clients_org_id ON tc_clients(org_id);

-- ============================================================
-- PROJECTS (belong to orgs + clients)
-- ============================================================
CREATE TABLE tc_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES tc_orgs(id) ON DELETE CASCADE,
    client_id UUID REFERENCES tc_clients(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_projects_org_id ON tc_projects(org_id);
CREATE INDEX idx_tc_projects_client_id ON tc_projects(client_id);

-- ============================================================
-- DOCUMENTS (raw uploaded files, org-scoped S3 paths)
-- ============================================================
CREATE TABLE tc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES tc_orgs(id) ON DELETE CASCADE,
    client_id UUID REFERENCES tc_clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES tc_projects(id) ON DELETE SET NULL,
    s3_key TEXT NOT NULL UNIQUE,             -- org-prefixed path: /{org_id}/documents/{uuid}.pdf
    original_filename TEXT,
    mime_type TEXT,
    file_size_bytes BIGINT,
    upload_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (upload_status IN ('pending', 'uploaded', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_documents_org_id ON tc_documents(org_id);
CREATE INDEX idx_tc_documents_s3_key ON tc_documents(s3_key);

-- ============================================================
-- OCR RUNS (per-document Textract results + confidence)
-- ============================================================
CREATE TABLE tc_doc_ocr_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES tc_documents(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES tc_orgs(id) ON DELETE CASCADE,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    confidence_score NUMERIC(5, 4),          -- 0.0000 to 1.0000
    confidence_gate TEXT NOT NULL DEFAULT 'pending'
        CHECK (confidence_gate IN ('auto_approve', 'human_review', 'pending')),
    raw_textract_output JSONB,               -- full Textract response
    normalized_fields JSONB,                 -- vendor, date, total, tax after normalization
    extraction_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (extraction_status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_doc_ocr_runs_document_id ON tc_doc_ocr_runs(document_id);
CREATE INDEX idx_tc_doc_ocr_runs_org_id ON tc_doc_ocr_runs(org_id);
CREATE INDEX idx_tc_doc_ocr_runs_confidence_gate ON tc_doc_ocr_runs(confidence_gate);

-- ============================================================
-- EXPENSE RECORDS (extracted + validated expense data)
-- ============================================================
CREATE TABLE tc_expense_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES tc_orgs(id) ON DELETE CASCADE,
    client_id UUID REFERENCES tc_clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES tc_projects(id) ON DELETE SET NULL,
    document_id UUID REFERENCES tc_documents(id) ON DELETE SET NULL,
    ocr_run_id UUID REFERENCES tc_doc_ocr_runs(id) ON DELETE SET NULL,

    -- Financial fields — NUMERIC to prevent float precision issues
    vendor_name TEXT,
    expense_date DATE,
    total_amount NUMERIC(12, 2),             -- never NULL if approved
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    category TEXT,
    description TEXT,

    -- Approval state machine
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED')),
    reviewed_by TEXT,                        -- user id or name
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Metadata
    source TEXT DEFAULT 'ocr'
        CHECK (source IN ('ocr', 'manual', 'import')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT approved_requires_amount
        CHECK (status != 'APPROVED' OR total_amount IS NOT NULL),
    CONSTRAINT rejected_requires_reason
        CHECK (status != 'REJECTED' OR rejection_reason IS NOT NULL)
);

CREATE INDEX idx_tc_expense_records_org_id ON tc_expense_records(org_id);
CREATE INDEX idx_tc_expense_records_project_id ON tc_expense_records(project_id);
CREATE INDEX idx_tc_expense_records_status ON tc_expense_records(status);
CREATE INDEX idx_tc_expense_records_expense_date ON tc_expense_records(expense_date);
CREATE INDEX idx_tc_expense_records_document_id ON tc_expense_records(document_id);

-- ============================================================
-- AUDIT LOG (append-only, never update or delete)
-- ============================================================
CREATE TABLE tc_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES tc_orgs(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,               -- 'expense_record', 'document', 'ocr_run'
    entity_id UUID NOT NULL,
    event_type TEXT NOT NULL,                -- 'status_change', 'extraction', 'upload', 'export'
    old_value JSONB,
    new_value JSONB,
    performed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_audit_log_org_id ON tc_audit_log(org_id);
CREATE INDEX idx_tc_audit_log_entity_id ON tc_audit_log(entity_id);
CREATE INDEX idx_tc_audit_log_event_type ON tc_audit_log(event_type);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER trg_tc_orgs_updated_at
    BEFORE UPDATE ON tc_orgs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tc_clients_updated_at
    BEFORE UPDATE ON tc_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tc_projects_updated_at
    BEFORE UPDATE ON tc_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tc_documents_updated_at
    BEFORE UPDATE ON tc_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tc_expense_records_updated_at
    BEFORE UPDATE ON tc_expense_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tenant tables
ALTER TABLE tc_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_doc_ocr_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_audit_log ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (org isolation via JWT claim)
-- Customize auth.jwt() claim key to match your Supabase setup
CREATE POLICY org_isolation_policy ON tc_expense_records
    USING (org_id = (auth.jwt() ->> 'org_id')::UUID);
