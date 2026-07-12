# Financial Sentiment Engine

A full-stack web application designed to track user watchlists and aggregate stock portfolio metrics, while providing live price updates and NLP-powered AI sentiment analysis using Llama 3.

## Features
- **Live Market Pulse**: Automatically queries real-time financial news and processes sentiment using a locally hosted Llama 3 model.
- **Portfolio Tracker**: Add and remove distinct stock purchases, automatically track weighted average costs, and calculate live P&L.
- **Smart Watchlists**: Deep dive into individual stocks with instant chart rendering and interactive AI sentiment breakdowns.
- **Microservice Architecture**: Decoupled backend worker for heavy background tasks, separate API layer, and an independent Next.js frontend, all orchestrated by Docker Compose.

## Tech Stack
- **Frontend**: Next.js, React, Tailwind CSS, Recharts, Framer Motion
- **Backend**: FastAPI (Python), SQLAlchemy, yfinance
- **Database**: PostgreSQL 15, Redis 7 (Caching & Message Queues)
- **AI/NLP**: Llama 3 (via Ollama running locally)
- **Deployment**: Docker & Docker Compose

## Prerequisites
- Docker & Docker Compose
- Ollama installed locally and serving the `llama3` model (`ollama run llama3`).

## Getting Started
1. Start Ollama and ensure the model is ready (`ollama run llama3`).
2. Run `docker-compose up -d --build` from the root directory to spin up the entire stack (Next.js Frontend, FastAPI Backend, Background Worker, PostgreSQL, and Redis).
3. Access the application immediately at `http://localhost:3000`.
