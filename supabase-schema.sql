-- Create tables

-- Create tweets table
CREATE TABLE IF NOT EXISTS tweets (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    source_url TEXT,
    source_title TEXT,
    ai_score DECIMAL(3,1),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'posted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    posted_at TIMESTAMP WITH TIME ZONE,
    twitter_id TEXT,
    engagement JSONB DEFAULT '{"likes": 0, "retweets": 0, "replies": 0}',
    post_error TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE,
    hash TEXT NOT NULL UNIQUE
);

-- Create rejected_articles table
CREATE TABLE IF NOT EXISTS rejected_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    hash TEXT NOT NULL UNIQUE
);

-- Create rejected_github_repos table
CREATE TABLE IF NOT EXISTS rejected_github_repos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    full_name TEXT NOT NULL,
    description TEXT,
    language TEXT,
    stars INTEGER DEFAULT 0,
    rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    hash TEXT NOT NULL UNIQUE
);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service TEXT NOT NULL UNIQUE,
    key_name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    description TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tweets_status ON tweets(status);
CREATE INDEX IF NOT EXISTS idx_tweets_source ON tweets(source);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_hash ON tweets(hash);

CREATE INDEX IF NOT EXISTS idx_rejected_articles_hash ON rejected_articles(hash);
CREATE INDEX IF NOT EXISTS idx_rejected_articles_source ON rejected_articles(source);

CREATE INDEX IF NOT EXISTS idx_rejected_github_repos_hash ON rejected_github_repos(hash);
CREATE INDEX IF NOT EXISTS idx_rejected_github_repos_language ON rejected_github_repos(language);

CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- Enable Row Level Security
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejected_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejected_github_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON tweets
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON tweets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON tweets
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON tweets
    FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON rejected_articles
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON rejected_articles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON rejected_articles
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON rejected_articles
    FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON rejected_github_repos
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON rejected_github_repos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON rejected_github_repos
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON rejected_github_repos
    FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON api_keys
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON api_keys
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON api_keys
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON api_keys
    FOR DELETE USING (true);

-- Insert default API providers if they don't exist
INSERT INTO api_keys (service, key_name, api_key, is_active, description) VALUES
('openai', 'OpenAI API Key', '', false, 'For AI text generation and analysis'),
('anthropic', 'Anthropic API Key', '', false, 'For AI text generation with Claude'),
('gemini', 'Google Gemini API Key', '', false, 'For AI text generation with Gemini'),
('twitter', 'Twitter API Key', '', false, 'For posting tweets to Twitter'),
('github', 'GitHub Token', '', false, 'For fetching GitHub repositories'),
('techcrunch', 'TechCrunch API Key', '', false, 'For fetching TechCrunch articles')
ON CONFLICT (service) DO NOTHING;