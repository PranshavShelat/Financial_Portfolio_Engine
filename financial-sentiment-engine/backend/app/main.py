from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import psycopg2
import redis

app = FastAPI(title="Financial Sentiment Engine API")

# Allow the Next.js frontend running locally to fetch data
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")

@app.get("/health")
def health_check():
    health_status = {"status": "ok", "db": "disconnected", "redis": "disconnected"}
    
    # Check Postgres Connection
    try:
        if DATABASE_URL:
            conn = psycopg2.connect(DATABASE_URL)
            conn.close()
            health_status["db"] = "connected"
    except Exception as e:
        print(f"DB Error: {e}")
        
    # Check Redis Connection
    try:
        if REDIS_URL:
            r = redis.from_url(REDIS_URL)
            r.ping()
            health_status["redis"] = "connected"
    except Exception as e:
        print(f"Redis Error: {e}")
        
    return health_status

@app.get("/api/sentiments")
def get_latest_sentiments():
    """Fetch the latest sentiment analysis for each asset."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # DISTINCT ON fetches only the newest row for each asset_symbol
        cur.execute("""
            SELECT DISTINCT ON (asset_symbol) 
                asset_symbol, sentiment_score, sentiment_label, news_source, created_at
            FROM sentiment_logs
            ORDER BY asset_symbol, created_at DESC;
        """)
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        result = []
        for row in rows:
            result.append({
                "asset_symbol": row[0],
                "sentiment_score": row[1],
                "sentiment_label": row[2],
                "news_source": row[3],
                "created_at": row[4]
            })
            
        # In a real app, we'd cache this result in Redis to speed up the UI
        # r = redis.from_url(REDIS_URL)
        # r.setex("latest_sentiments", 60, json.dumps(result))
            
        return result
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []
