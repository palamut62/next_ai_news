-- Settings tablosu oluşturma
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(255) PRIMARY KEY DEFAULT 'default',
    automation JSONB NOT NULL DEFAULT '{}',
    github JSONB NOT NULL DEFAULT '{}',
    notifications JSONB NOT NULL DEFAULT '{}',
    twitter JSONB NOT NULL DEFAULT '{}',
    ai JSONB NOT NULL DEFAULT '{}',
    api_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basit RLS politikaları
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON settings
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated update access" ON settings
    FOR UPDATE USING (auth.role() = 'authenticated');

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_settings_id ON settings(id);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);