-- Create persona analytics tables if they don't exist

-- Persona analytics table for long-term tracking
CREATE TABLE IF NOT EXISTS persona_analytics (
    id serial PRIMARY KEY NOT NULL,
    persona_id integer NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
    selection_count integer DEFAULT 1,
    last_selected_at timestamp DEFAULT now(),
    period_start timestamp NOT NULL,
    period_end timestamp NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- Persona selection cache table for 10-hour caching
CREATE TABLE IF NOT EXISTS persona_selection_cache (
    id serial PRIMARY KEY NOT NULL,
    persona_id integer NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
    selection_count integer DEFAULT 1,
    cache_period_start timestamp NOT NULL,
    cache_period_end timestamp NOT NULL,
    created_at timestamp DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_persona_analytics_persona_id ON persona_analytics(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_analytics_period_start ON persona_analytics(period_start);
CREATE INDEX IF NOT EXISTS idx_persona_selection_cache_persona_id ON persona_selection_cache(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_selection_cache_period_start ON persona_selection_cache(cache_period_start);