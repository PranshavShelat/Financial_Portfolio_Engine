import os
import tempfile
from typing import List, Optional
import shutil

from fastapi import UploadFile
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Document, StorageContext, Settings
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

async def ingest_sec_filing(ticker: str):
    # Simulate downloading the text of a 10-K or fetching recent long-form news
    stock = yf.Ticker(ticker)
    info = stock.info
    
    # We will embed the company's long-form business summary as a substitute if SEC PDF fetching is complex without a paid API.
    # In a real scenario, sec-api would pull the 10-K HTML, strip tags, and embed.
    summary = info.get("longBusinessSummary", "")
    if not summary:
        return {"status": "error", "message": f"Could not find business summary for {ticker}"}
        
    doc = Document(
        text=summary, 
        metadata={"source": f"{ticker} Business Summary & SEC Overview", "ticker": ticker.upper(), "type": "10-k-summary"}
    )
        
    index = get_index()
    if index is None:
        index = VectorStoreIndex.from_documents(
            [doc], 
            storage_context=storage_context
        )
    else:
        index.insert(doc)
            
    return {"status": "success", "message": f"Successfully ingested latest financial data for {ticker}"}

def query_documents(query_str: str, ticker: Optional[str] = None):
    index = get_index()
    if index is None:
        return {"answer": "No documents have been ingested yet.", "citations": []}
        
    # Setup query engine with citations
    query_engine = index.as_query_engine(
        similarity_top_k=3,
        response_mode="compact"
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
