#STEP 4
import json
import pickle

from rank_bm25 import BM25Okapi

# Load chunks

with open(
    "chunks.json",
    "r",
    encoding="utf-8"
) as f:

    chunks = json.load(f)

# Tokenize

tokenized_docs = [
    chunk["text"].lower().split()
    for chunk in chunks
]

# Create BM25

bm25 = BM25Okapi(tokenized_docs)

# Save

with open(
    "bm25.pkl",
    "wb"
) as f:

    pickle.dump(bm25, f)

print("BM25 Index Saved!")