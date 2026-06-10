import json
import pickle
import chromadb
import os

from dotenv import load_dotenv
from groq import Groq
def ask_question(query):

    from sentence_transformers import (
        SentenceTransformer,
        CrossEncoder
    )

    # =========================
    # Load Environment Variables
    # =========================

    load_dotenv()

    # =========================
    # Groq Client
    # =========================

    groq_client = Groq(
        api_key=os.getenv("GROQ_API_KEY")
    )

    # =========================
    # Load Models
    # =========================

    embedding_model = SentenceTransformer(
        "BAAI/bge-small-en-v1.5"
    )

    reranker = CrossEncoder(
        "cross-encoder/ms-marco-MiniLM-L-6-v2"
    )

    # =========================
    # Load Chunks
    # =========================

    with open(
        "chunks.json",
        "r",
        encoding="utf-8"
    ) as f:

        chunks = json.load(f)

    # =========================
    # Load BM25
    # =========================

    with open(
        "bm25.pkl",
        "rb"
    ) as f:

        bm25 = pickle.load(f)

    # =========================
    # Load ChromaDB
    # =========================

    client = chromadb.PersistentClient(
        path="chroma_db"
    )

    collection = client.get_collection(
        "research_papers"
    )

    # =========================
    # User Query
    # =========================

    query = input("\nQuery: ")

    # =========================
    # BM25 Search
    # =========================

    bm25_scores = bm25.get_scores(
        query.lower().split()
    )

    top_bm25 = sorted(
        range(len(bm25_scores)),
        key=lambda i: bm25_scores[i],
        reverse=True
    )[:10]

    # =========================
    # Vector Search
    # =========================

    query_embedding = embedding_model.encode(
        query
    ).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=10,
        include=["documents"]
    )

    vector_docs = results["documents"][0]

    # =========================
    # Hybrid Merge
    # =========================

    hybrid_chunks = []
    seen = set()

    # BM25 Results

    for idx in top_bm25:

        text = chunks[idx]["text"]

        if text not in seen:

            hybrid_chunks.append(text)

            seen.add(text)

    # Vector Results

    for doc in vector_docs:

        if doc not in seen:

            hybrid_chunks.append(doc)

            seen.add(doc)

    print(
        f"\nHybrid Results Found: {len(hybrid_chunks)}"
    )

    # =========================
    # Reranking
    # =========================

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

    # =========================
    # Top 5 Chunks
    # =========================

    top_chunks = [
        chunk
        for score, chunk in reranked[:5]
    ]

    # =========================
    # Build Context
    # =========================

    context = "\n\n".join(top_chunks)

    # =========================
    # Prompt
    # =========================

    prompt = f"""
    You are a helpful research assistant.

    Answer ONLY from the provided context.

    If the answer is not present in the context,
    say:
    "I could not find that information in the documents."

    Context:
    {context}

    Question:
    {query}

    Answer:
    """

    # =========================
    # Groq Response
    # =========================

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

    # =========================
    # Final Output
    # =========================

    print("\n" + "=" * 80)
    print("FINAL ANSWER")
    print("=" * 80)

