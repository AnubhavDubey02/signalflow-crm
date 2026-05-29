-- Migration: 20260529_signalflow_v1

-- 1. signalflow_intelligence
CREATE TABLE public.signalflow_intelligence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
    whatsapp_phone VARCHAR(20) UNIQUE,
    push_name VARCHAR(100),
    transaction_type VARCHAR(10) DEFAULT 'RENT',
    requirement_summary TEXT,
    last_chat_snapshot JSONB,
    property_types TEXT[] DEFAULT '{}',
    budget_min NUMERIC,
    budget_max NUMERIC,
    preferred_sectors TEXT[] DEFAULT '{}',
    landmarks TEXT[] DEFAULT '{}',
    furnishing VARCHAR(20) CHECK (furnishing IN ('FULLY', 'SEMI', 'UNFURNISHED')),
    occupant_type VARCHAR(20) CHECK (occupant_type IN ('BACHELOR', 'FAMILY', 'COUPLE')),
    move_in_timeline VARCHAR(50),
    lead_temperature VARCHAR(20) CHECK (lead_temperature IN ('HOT', 'WARM', 'COLD')),
    confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    needs_review BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sf_intel_phone ON public.signalflow_intelligence(whatsapp_phone);
CREATE INDEX idx_sf_intel_budget ON public.signalflow_intelligence(budget_max);
CREATE INDEX idx_sf_intel_type ON public.signalflow_intelligence USING GIN (property_types);

-- 2. signalflow_tasks
CREATE TABLE public.signalflow_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES auth.users(id),
    action_type VARCHAR(50) NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sf_tasks_due_date ON public.signalflow_tasks(due_date);
CREATE INDEX idx_sf_tasks_agent ON public.signalflow_tasks(agent_id);

-- 3. signalflow_analysis_logs (Audit)
CREATE TABLE public.signalflow_analysis_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES auth.users(id),
    whatsapp_phone VARCHAR(20) NOT NULL,
    tokens_used INTEGER NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.signalflow_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalflow_tasks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_sf_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_update_sf_intel_modtime 
BEFORE UPDATE ON public.signalflow_intelligence 
FOR EACH ROW EXECUTE PROCEDURE update_sf_modified_column();

-- Inventory Matching RPC
CREATE OR REPLACE FUNCTION get_signalflow_recommendations(p_lead_id UUID)
RETURNS TABLE (
    id UUID, title VARCHAR, price NUMERIC, sector VARCHAR, type VARCHAR,
    furnishing VARCHAR, featured_image TEXT, match_score INTEGER
) AS $$
DECLARE
    v_intel RECORD;
BEGIN
    SELECT * INTO v_intel FROM signalflow_intelligence WHERE lead_id = p_lead_id;

    RETURN QUERY
    SELECT 
        p.id, p.title, p.price, p.sector, p.type, p.furnishing, p.featured_image,
        (
            CASE WHEN p.type = ANY(v_intel.property_types) THEN 40 ELSE 0 END +
            CASE WHEN p.sector = ANY(v_intel.preferred_sectors) THEN 40 ELSE 0 END +
            CASE WHEN p.furnishing = v_intel.furnishing THEN 20 ELSE 0 END
        ) AS match_score
    FROM properties p
    WHERE p.status = 'AVAILABLE'
      AND (v_intel.budget_max IS NULL OR p.price <= (v_intel.budget_max * 1.15))
    ORDER BY match_score DESC, p.created_at DESC
    LIMIT 3;
END;
$$ LANGUAGE plpgsql;
