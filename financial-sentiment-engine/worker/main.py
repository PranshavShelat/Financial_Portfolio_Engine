import time
import schedule
import requests
from bs4 import BeautifulSoup
import psycopg2
import os
import json
import logging
import ollama

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATABASE_URL = os.getenv("DATABASE_URL")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")

# Initialize Ollama client
client = ollama.Client(host=OLLAMA_HOST)

ASSETS = ["Reliance Industries", "ITC Limited", "State Bank of India", "Nasdaq 100"]

def scrape_news(asset):
    """Mock scraper for demonstration purposes."""
    logging.info(f"Scraping news for {asset}...")
    # In a real scenario, you'd use BeautifulSoup to parse Yahoo Finance, etc.
    # For now, we mock a headline so it works consistently.
    headlines = {
        "Reliance Industries": "Reliance announces record profits for Q3, expanding green energy initiatives.",
        "ITC Limited": "ITC faces slight margin pressure due to increased taxation, but FMCG sector shows strong growth.",
        "State Bank of India": "SBI reports massive surge in retail lending, non-performing assets at all-time low.",
        "Nasdaq 100": "Tech stocks rally as inflation cools, leading Nasdaq 100 to new record highs."
    }
    return headlines.get(asset, "No news found.")

def analyze_sentiment(asset, news_text):
    """Ask Llama 3 to analyze the sentiment of the news text."""
    logging.info(f"Analyzing sentiment for {asset} using Llama 3...")
    
    prompt = f"""
    You are a financial analyst. Analyze the following news headline for the asset: {asset}.
    Determine if the sentiment is bullish, bearish, or neutral. Also provide a confidence score from 1 to 100.
    
    News Headline: "{news_text}"
    
    You must respond ONLY with a valid JSON object in this exact format, with no extra text or markdown:
    {{"sentiment_label": "bullish", "sentiment_score": 85}}
    """
    
    try:
        response = client.chat(model='llama3', messages=[
            {
                'role': 'user',
                'content': prompt,
            }
        ])
        
        result_text = response['message']['content'].strip()
        # Clean up any potential markdown if Llama 3 disobeys
        if result_text.startswith("```json"):
            result_text = result_text[7:-3]
        if result_text.startswith("```"):
            result_text = result_text[3:-3]
            
        return json.loads(result_text)
    except Exception as e:
        logging.error(f"Error parsing Llama 3 response: {e}")
        return {"sentiment_label": "neutral", "sentiment_score": 50}

def save_to_db(asset, sentiment_data, news_source):
    """Save the result to PostgreSQL."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO sentiment_logs (asset_symbol, sentiment_score, sentiment_label, news_source)
            VALUES (%s, %s, %s, %s)
        """, (
            asset, 
            sentiment_data.get('sentiment_score', 50), 
            sentiment_data.get('sentiment_label', 'neutral'), 
            news_source
        ))
        
        conn.commit()
        cur.close()
        conn.close()
        logging.info(f"Saved {asset} sentiment to database.")
    except Exception as e:
        logging.error(f"Database error: {e}")

def job():
    logging.info("Starting scheduled scraping job...")
    for asset in ASSETS:
        news_text = scrape_news(asset)
        sentiment = analyze_sentiment(asset, news_text)
        save_to_db(asset, sentiment, news_text)
        time.sleep(2) # Be polite between scrapes
    logging.info("Job complete. Waiting for next cycle.")

# Run once immediately, then schedule
if __name__ == "__main__":
    logging.info(f"Worker started. Connecting to Llama 3 at {OLLAMA_HOST}...")
    job()
    
    # Schedule every 5 minutes
    schedule.every(5).minutes.do(job)
    
    while True:
        schedule.run_pending()
        time.sleep(1)
