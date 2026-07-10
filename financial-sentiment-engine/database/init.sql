-- database/init.sql
CREATE TABLE IF NOT EXISTS sentiment_logs (
    id SERIAL PRIMARY KEY,
    asset_symbol VARCHAR(50) NOT NULL,
    sentiment_score INTEGER NOT NULL,
    sentiment_label VARCHAR(20) NOT NULL,
    news_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portfolio_metrics (
    id SERIAL PRIMARY KEY,
    total_value DECIMAL(15, 2) NOT NULL,
    cash_balance DECIMAL(15, 2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
