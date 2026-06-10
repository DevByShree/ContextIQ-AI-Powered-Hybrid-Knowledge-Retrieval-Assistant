#STEP 2

import os
import json
from tqdm import tqdm
from langchain_text_splitters import RecursiveCharacterTextSplitter

INPUT_FOLDER = "cleaned_data"
OUTPUT_FILE = "chunks.json"

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=100
)

all_chunks = []

files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith(".txt")]

for file in tqdm(files):

    path = os.path.join(INPUT_FOLDER, file)

    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    chunks = splitter.split_text(text)

    for idx, chunk in enumerate(chunks):

        all_chunks.append({
            "source": file,
            "chunk_id": idx,
            "text": chunk
        })

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(all_chunks, f, ensure_ascii=False, indent=2)

print(f"\nTotal Chunks: {len(all_chunks)}")
print(f"Saved to {OUTPUT_FILE}")

print("Total Chunks:", len(all_chunks))