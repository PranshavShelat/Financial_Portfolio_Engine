from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
import os
import psycopg2
import redis
import yfinance as yf
import ollama
import json
import re
import math
from curl_cffi import requests
from pydantic import BaseModel
from langchain_community.document_loaders import WebBaseLoader
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from . import models, database, auth
from .database import engine, get_db

# Create the database tables
models.Base.metadata.create_all(bind=engine)

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
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")

try:
    llama_client = ollama.Client(host=OLLAMA_HOST)
except Exception as e:
    print(f"Could not init Ollama client: {e}")

@app.get("/health")
def health_check():
    health_status = {"status": "ok", "db": "disconnected", "redis": "disconnected"}
    
    try:
        if DATABASE_URL:
            conn = psycopg2.connect(DATABASE_URL)
            conn.close()
            health_status["db"] = "connected"
    except Exception as e:
        print(f"DB Error: {e}")
        
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
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
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
            
        return result
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

@app.get("/api/suggestions")
def get_suggestions(q: str):
    """Hits Yahoo's search API to get autocomplete ticker suggestions."""
    if not q:
        return []
        
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q}"
        # Use curl_cffi to impersonate Chrome and bypass Yahoo's TLS blocks
        resp = requests.get(url, impersonate="chrome")
        data = resp.json()
        quotes = data.get("quotes", [])
        
        results = []
        for quote in quotes:
            # We only care about equities/stocks/ETFs
            if "symbol" in quote and ("shortname" in quote or "longname" in quote):
                name = quote.get("shortname", quote.get("longname", quote["symbol"]))
                results.append({
                    "symbol": quote["symbol"],
                    "name": name,
                    "exchange": quote.get("exchange", "")
                })
        return results[:5]
    except Exception as e:
        print(f"Suggestion Error: {e}")
        return []

class SummarizeRequest(BaseModel):
    url: str

@app.post("/api/summarize")
def summarize_article(req: SummarizeRequest):
    try:
        loader = WebBaseLoader(req.url)
        docs = loader.load()
        if not docs:
            raise ValueError("Could not extract text from URL.")
        
        # Grab first 4000 characters to prevent context window overload
        article_text = docs[0].page_content[:4000]
        
        prompt = f"""
        You are a financial analyst. Read the following article text and provide a comprehensive, 3-4 sentence summary of the key takeaways. Focus on what this means for the stock market and investors.

        Article Text:
        {article_text}
        
        Summary:
        """
        
        response = llama_client.chat(model='llama3', messages=[{'role': 'user', 'content': prompt}])
        summary = response['message']['content'].strip()
        
        return {"summary": summary}
    except Exception as e:
        print(f"Summarize Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to summarize article.")

# --- Auth Endpoints ---

class UserCreate(BaseModel):
    username: str
    password: str

@app.post("/api/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}

@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = auth.timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}

# --- Watchlist Endpoints ---

class WatchlistAdd(BaseModel):
    ticker: str
    name: str

@app.get("/api/watchlist")
def get_watchlist(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    items = []
    for wl in current_user.watchlists:
        price = None
        change_percent = None
        currency = "USD"
        try:
            stock = yf.Ticker(wl.ticker)
            info = stock.info or {}
            currency = info.get("currency", "USD")
            price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("navPrice")
            prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
            
            # fallback to history if info is missing prices
            if not price or not prev_close:
                hist = stock.history(period="5d")
                if len(hist) >= 2:
                    prev_close = hist['Close'].iloc[-2]
                    price = hist['Close'].iloc[-1]
                elif len(hist) == 1:
                    price = hist['Close'].iloc[0]
                    
            if price and prev_close:
                change_percent = ((price - prev_close) / prev_close) * 100
        except Exception as e:
            print(f"Error fetching price for {wl.ticker}: {e}")
            
        items.append({
            "id": wl.id,
            "ticker": wl.ticker,
            "name": wl.name,
            "price": price,
            "change_percent": change_percent,
            "currency": currency
        })
    return items

@app.post("/api/watchlist")
def toggle_watchlist(item: WatchlistAdd, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    existing = db.query(models.Watchlist).filter(
        models.Watchlist.user_id == current_user.id,
        models.Watchlist.ticker == item.ticker
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return {"message": "Removed from watchlist", "status": "removed"}
    else:
        new_item = models.Watchlist(user_id=current_user.id, ticker=item.ticker, name=item.name)
        db.add(new_item)
        db.commit()
        return {"message": "Added to watchlist", "status": "added"}

@app.get("/api/chart/{ticker}")
def get_chart(ticker: str, period: str = "1mo"):
    try:
        stock = yf.Ticker(ticker)
        
        # Configure interval based on period
        interval = "1d"
        if period == "1d":
            interval = "5m"
        elif period == "5d":
            interval = "15m"
        elif period == "1mo" or period == "1y":
            interval = "1d"
        elif period == "5y":
            interval = "1wk"
            
        hist = stock.history(period=period, interval=interval)
        
        # Forward fill to handle holidays, then drop remaining NaNs
        hist = hist.ffill().dropna(subset=['Close'])
        chart_data = hist.reset_index().to_dict('records')
        
        formatted_chart = []
        for row in chart_data:
            # Depending on interval, Date could be Datetime or Date
            date_obj = row.get('Datetime', row.get('Date'))
            if period in ["1d", "5d"]:
                date_str = date_obj.strftime("%Y-%m-%d %H:%M") if hasattr(date_obj, 'strftime') else str(date_obj)
            else:
                date_str = date_obj.strftime("%Y-%m-%d") if hasattr(date_obj, 'strftime') else str(date_obj)
                
            formatted_chart.append({
                "Date": date_str,
                "Close": float(row['Close'])
            })
            
        return formatted_chart
    except Exception as e:
        print(f"Chart Error for {ticker}: {e}")
        return []

@app.get("/api/search/{ticker}")
def search_ticker(ticker: str):
    """Fetch real-time yfinance data and live sentiment for a searched ticker."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info or {}
        currency = info.get("currency", "USD")
        
        # Fetch the top 6 news headlines
        news = stock.news
        headlines_data = []
        if news:
            for item in news[:6]:
                content = item.get('content') or {}
                title = content.get('title') or item.get('title')
                click_url = content.get('clickThroughUrl') or {}
                url = click_url.get('url') or item.get('link')
                if title:
                    headlines_data.append({"title": title, "url": url or ""})
                    
        if not headlines_data:
            headlines_data.append({"title": f"No recent news for {ticker}.", "url": ""})
            
        headlines = [h['title'] for h in headlines_data]
            
        # Create a prompt for individual grading
        news_json = json.dumps(headlines)
        prompt = f"""
        You are a financial analyst. Analyze the following list of news headlines for the ticker: {ticker}.
        Grade EACH headline individually. Determine if each headline is bullish, bearish, or neutral, and provide a confidence score (1-100).
        
        Headlines: {news_json}
        
        You must respond ONLY with a valid JSON array of objects, one for each headline, in this exact format:
        [
            {{"headline": "Headline 1 text", "sentiment_label": "bullish", "sentiment_score": 85}},
            {{"headline": "Headline 2 text", "sentiment_label": "neutral", "sentiment_score": 50}}
        ]
        """
        
        try:
            response = llama_client.chat(model='llama3', messages=[{'role': 'user', 'content': prompt}])
            result_text = response['message']['content'].strip()
            
            # Robust JSON extraction (look for an array block)
            match = re.search(r'\[.*\]', result_text, re.DOTALL)
            if match:
                sentiments = json.loads(match.group(0))
                for i, sentiment in enumerate(sentiments):
                    if i < len(headlines_data):
                        sentiment['url'] = headlines_data[i]['url']
            else:
                raise ValueError("No JSON array found")
                
        except Exception as e:
            print(f"Llama 3 Error: {e}")
            # Fallback
            sentiments = [{"headline": h['title'], "sentiment_label": "neutral", "sentiment_score": 50, "url": h['url']} for h in headlines_data]
            
        hist = stock.history(period="1d", interval="5m")
        hist = hist.ffill().dropna(subset=['Close'])
        chart_data = hist.reset_index().to_dict('records')
        
        formatted_chart = []
        for row in chart_data:
            date_obj = row.get('Datetime', row.get('Date'))
            date_str = date_obj.strftime("%Y-%m-%d %H:%M") if hasattr(date_obj, 'strftime') else str(date_obj)
            formatted_chart.append({
                "Date": date_str,
                "Close": float(row['Close'])
            })
            
        current_price = info.get("currentPrice", info.get("regularMarketPrice", 0))
        if current_price is None or math.isnan(current_price):
            current_price = formatted_chart[-1]["Close"] if formatted_chart else 0

        return {
            "symbol": ticker.upper(),
            "name": info.get("shortName", ticker.upper()),
            "currency": currency,
            "current_price": current_price,
            "sentiments": sentiments,
            "chart_data": formatted_chart
        }
    except Exception as e:
        print(f"Error fetching data for {ticker}: {e}")
        raise HTTPException(status_code=404, detail="Ticker not found or failed to fetch.")
