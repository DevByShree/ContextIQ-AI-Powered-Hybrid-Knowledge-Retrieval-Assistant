#STEP 3
import json
import chromadb

from tqdm import tqdm
from sentence_transformers import SentenceTransformer

# Load embedding model
model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5"
)

# Load chunks
with open(
    "chunks.json",
    "r",
    encoding="utf-8"
) as f:
    chunks = json.load(f)

# Create Chroma Client
client = chromadb.PersistentClient(
    path="chroma_db"
)

collection = client.get_or_create_collection(
    name="research_papers"
)

batch_size = 100

for i in tqdm(
    range(0, len(chunks), batch_size)
):

    batch = chunks[i:i+batch_size]

    texts = [
        item["text"]
        for item in batch
    ]

    embeddings = model.encode(
        texts,
        show_progress_bar=False
    ).tolist()

    ids = [
        f"{item['source']}_{item['chunk_id']}"
        for item in batch
    ]

    metadatas = [
        {
            "source": item["source"]
        }
        for item in batch
    ]

    collection.add(
        ids=ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas
    )

print("Ingestion Complete!")
print(
    f"Stored {len(chunks)} chunks"
)