import json
import pickle
import chromadb
import os
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

from sentence_transformers import (
    SentenceTransformer,
    CrossEncoder
)
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

# =========================
# Load Environment
# =========================

load_dotenv()

# =========================
# Groq
# =========================

groq_client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

# =========================
# Models
# =========================

embedding_model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5"
)

reranker = CrossEncoder(
    "cross-encoder/ms-marco-MiniLM-L-6-v2"
)

# =========================
# Data
# =========================

with open(
    BASE_DIR / "chunks.json",
    "r",
    encoding="utf-8"
) as f:
    chunks = json.load(f)

with open(
    BASE_DIR / "bm25.pkl",
    "rb"
)as f:
    bm25 = pickle.load(f)

client = chromadb.PersistentClient(
    path=str(BASE_DIR / "chroma_db")
)

collection = client.get_collection(
    "research_papers"
)

# =========================
# Main Function
# =========================

def ask_question(query):
    def ask_question(query):
        if not query:
            return "Please provide a valid query."

        bm25_scores = bm25.get_scores(
            query.lower().split()
        )

    # BM25 Search

    bm25_scores = bm25.get_scores(
        query.lower().split()
    )

    top_bm25 = sorted(
        range(len(bm25_scores)),
        key=lambda i: bm25_scores[i],
        reverse=True
    )[:20]

    # Vector Search

    query_embedding = embedding_model.encode(
        query
    ).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=20,
        include=["documents"]
    )

    vector_docs = results["documents"][0]

    # Hybrid Merge

    hybrid_chunks = []
    seen = set()

    for idx in top_bm25:

        text = chunks[idx]["text"]

        if text not in seen:

            hybrid_chunks.append(text)

            seen.add(text)

    for doc in vector_docs:

        if doc not in seen:

            hybrid_chunks.append(doc)

            seen.add(doc)

    # Reranking

    pairs = [
        [query, chunk]
        for chunk in hybrid_chunks
    ]

    scores = reranker.predict(
        pairs
    )

    reranked = sorted(
        zip(scores, hybrid_chunks),
        key=lambda x: x[0],
        reverse=True
    )

    # Top 5

    top_chunks = [
        chunk
        for score, chunk in reranked[:10]
    ]

    context = "\n\n".join(top_chunks)

    # Prompt
    prompt = f"""
    You are an expert AI research assistant.

    Using the provided context, generate a detailed and well-structured answer.

    Rules:
    - Explain concepts clearly.
    - Use multiple paragraphs.
    - Give detailed explanations.
    - Include examples when possible.
    - Do not give one-line answers.
    - Use only information present in the context.

    Context:
    {context}

    Question:
    {query}

    Detailed Answer:
    """

    # Groq

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    answer = response.choices[0].message.content

    return answer