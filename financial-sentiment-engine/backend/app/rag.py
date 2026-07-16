import os
import tempfile
from typing import List, Optional
import shutil

from fastapi import UploadFile
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Document, StorageContext, Settings, PromptTemplate
from llama_index.core.node_parser import SentenceSplitter
from llama_index.llms.google_genai import GoogleGenAI
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.readers.file import PyMuPDFReader
import chromadb
import yfinance as yf

# Setup Gemini
gemini_api_key = os.getenv("GEMINI_API")
if gemini_api_key:
    Settings.llm = GoogleGenAI(model="gemini-2.5-flash", api_key=gemini_api_key)
Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")

# Setup ChromaDB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
chroma_collection = chroma_client.get_or_create_collection("financial_documents")
vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

def get_index():
    # If the collection has documents, load the index from it
    if chroma_collection.count() > 0:
        return VectorStoreIndex.from_vector_store(
            vector_store,
            storage_context=storage_context,
        )
    return None

async def ingest_pdf(file: UploadFile, ticker: Optional[str] = None):
    # Save the uploaded file to a temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_file_path = os.path.join(temp_dir, file.filename)
        with open(temp_file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # Parse document with PyMuPDF for robust extraction
        documents = SimpleDirectoryReader(
            input_files=[temp_file_path],
            file_extractor={".pdf": PyMuPDFReader()}
        ).load_data()
        
        # DEBUG: Print exactly what text was extracted
        print(f"DEBUG: Extracted {len(documents)} pages")
        for i, d in enumerate(documents):
            print(f"DEBUG Page {i} Text Preview: {d.text[:500]}")
        
        # Add metadata
        for doc in documents:
            doc.metadata["source"] = file.filename
            if ticker:
                doc.metadata["ticker"] = ticker.upper()

        # Create or update index
        index = get_index()
        if index is None:
            index = VectorStoreIndex.from_documents(
                documents, 
                storage_context=storage_context, 
                show_progress=True
            )
        else:
            for doc in documents:
                index.insert(doc)
                
    return {"status": "success", "message": f"Successfully ingested {file.filename}", "chunks": len(documents)}

async def auto_ingest_us_stream(ticker: str):
    async def event_generator():
        try:
            import json
            import asyncio
            yield dict(data=json.dumps({"step": 1, "message": f"Requesting metadata for {ticker} from SEC EDGAR..."}))
            await asyncio.sleep(0.1)
            
            os.environ["EDGAR_IDENTITY"] = "FinancialSentimentEngine bot@financialsentiment.com"
            from edgar import Company
            
            # Use run_in_executor for synchronous EDGAR calls
            loop = asyncio.get_event_loop()
            
            def fetch_filing():
                c = Company(ticker)
                filings = c.get_filings(form="10-K")
                if not filings:
                    filings = c.get_filings(form="10-Q")
                if not filings:
                    return None
                return filings.latest()
                
            latest_filing = await loop.run_in_executor(None, fetch_filing)
            
            if not latest_filing:
                yield dict(data=json.dumps({"step": -1, "message": f"No recent 10-K or 10-Q found for {ticker}."}))
                return
                
            yield dict(data=json.dumps({"step": 2, "message": f"Downloading {latest_filing.form} filing for {ticker}..."}))
            await asyncio.sleep(0.1)
            
            def fetch_text():
                return latest_filing.text()
                
            text_content = await loop.run_in_executor(None, fetch_text)
            text_content = text_content[:150000] # Limit to avoid massive processing time for huge 10-Ks
            
            yield dict(data=json.dumps({"step": 3, "message": "Parsing document and chunking text..."}))
            await asyncio.sleep(0.1)
            
            doc = Document(
                text=text_content,
                metadata={"source": f"SEC EDGAR {latest_filing.form}", "ticker": ticker.upper()}
            )
            
            yield dict(data=json.dumps({"step": 4, "message": "Generating Vector Embeddings locally..."}))
            await asyncio.sleep(0.1)
            
            def embed_doc():
                index = get_index()
                if index is None:
                    VectorStoreIndex.from_documents([doc], storage_context=storage_context)
                else:
                    index.insert(doc)
            
            await loop.run_in_executor(None, embed_doc)
            
            yield dict(data=json.dumps({"step": 5, "message": f"Successfully vectorized {latest_filing.form} for {ticker}!"}))
            
        except Exception as e:
            yield dict(data=json.dumps({"step": -1, "message": f"Error: {str(e)}"}))
            
    return event_generator

async def auto_ingest_india_stream(ticker: str):
    async def event_generator():
        try:
            import json
            import asyncio
            from bs4 import BeautifulSoup
            from curl_cffi import requests as curl_requests
            
            yield dict(data=json.dumps({"step": 1, "message": f"Fetching latest financial news/reports for {ticker} from Yahoo Finance..."}))
            await asyncio.sleep(0.1)
            
            loop = asyncio.get_event_loop()
            
            def fetch_india_data():
                # For Indian stocks, we fetch the latest news articles from yfinance and parse their text.
                # NSE PDFs are blocked, so news analysis is the most robust free alternative for RAG.
                stock = yf.Ticker(ticker)
                news = stock.news
                if not news:
                    return None
                
                # Fetch text of the top 3 news articles
                combined_text = f"Latest Financial Updates for {ticker}:\n\n"
                for item in news[:3]:
                    url = ""
                    content = item.get('content') or {}
                    click_url = content.get('clickThroughUrl') or {}
                    url = click_url.get('url') or item.get('link')
                    
                    if url:
                        try:
                            # Use curl_cffi to bypass basic anti-bot protections
                            resp = curl_requests.get(url, impersonate="chrome", timeout=10)
                            soup = BeautifulSoup(resp.text, 'html.parser')
                            paragraphs = soup.find_all('p')
                            article_text = " ".join([p.text for p in paragraphs])
                            if article_text:
                                combined_text += f"Headline: {item.get('title')}\n{article_text[:3000]}\n\n"
                        except:
                            pass
                return combined_text
                
            text_content = await loop.run_in_executor(None, fetch_india_data)
            
            if not text_content or len(text_content) < 50:
                yield dict(data=json.dumps({"step": -1, "message": f"Could not fetch latest reports for {ticker}."}))
                return
                
            yield dict(data=json.dumps({"step": 2, "message": f"Processing financial reports for {ticker}..."}))
            await asyncio.sleep(0.1)
            
            doc = Document(
                text=text_content,
                metadata={"source": "Yahoo Finance News & Reports", "ticker": ticker.upper()}
            )
            
            yield dict(data=json.dumps({"step": 4, "message": "Generating Vector Embeddings locally..."}))
            await asyncio.sleep(0.1)
            
            def embed_doc():
                index = get_index()
                if index is None:
                    VectorStoreIndex.from_documents([doc], storage_context=storage_context)
                else:
                    index.insert(doc)
            
            await loop.run_in_executor(None, embed_doc)
            
            yield dict(data=json.dumps({"step": 5, "message": f"Successfully vectorized latest reports for {ticker}!"}))
            
        except Exception as e:
            yield dict(data=json.dumps({"step": -1, "message": f"Error: {str(e)}"}))
            
    return event_generator

def query_documents(query_str: str, ticker: Optional[str] = None):
    index = get_index()
    if index is None:
        return {"answer": "No documents have been ingested yet.", "citations": []}
        
    # Setup custom prompt to allow prior knowledge and constrain length
    qa_prompt_tmpl_str = (
        "Context information is below.\n"
        "---------------------\n"
        "{context_str}\n"
        "---------------------\n"
        "Given the context information and your own prior knowledge as an expert financial analyst, answer the query.\n"
        "FORMATTING RULES:\n"
        "You MUST structure your response EXACTLY in this format, and nothing else:\n\n"
        "From the provided context:\n"
        "1. [Full sentence explaining a point from the text]\n"
        "2. [Full sentence explaining another point from the text]\n"
        "3. [Full sentence explaining a third point from the text]\n\n"
        "From my own understanding and research:\n"
        "1. [Full sentence providing your own expert insight/prediction/price target]\n"
        "2. [Full sentence providing another expert insight]\n"
        "3. [Full sentence providing a final expert insight]\n\n"
        "Do NOT use markdown bolding (**), italics, or any asterisks. Keep the text easily readable and informative.\n"
        "Query: {query_str}\n"
        "Answer: "
    )
    qa_prompt_tmpl = PromptTemplate(qa_prompt_tmpl_str)

    # Setup query engine with citations
    query_engine = index.as_query_engine(
        similarity_top_k=3,
        response_mode="compact",
        text_qa_template=qa_prompt_tmpl
    )
    
    response = query_engine.query(query_str)
    
    # Extract citations
    citations = []
    for node in response.source_nodes:
        citations.append({
            "text": node.node.text[:250] + "...", # Snippet
            "source": node.node.metadata.get("source", "Unknown"),
            "score": float(node.score) if node.score else 0.0
        })
        
    return {
        "answer": str(response),
        "citations": citations
    }
