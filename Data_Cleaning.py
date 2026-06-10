#STEP 1
import fitz
import os
import re
from tqdm import tqdm

# Input Folder
PDF_FOLDER = "data"

# Output Folder
OUTPUT_FOLDER = "cleaned_data"

os.makedirs(OUTPUT_FOLDER, exist_ok=True)


def clean_text(text):
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text)

    # Remove multiple new lines
    text = re.sub(r'\n+', '\n', text)

    # Remove weird unicode spaces
    text = text.replace('\xa0', ' ')

    return text.strip()


pdf_files = [f for f in os.listdir(PDF_FOLDER) if f.endswith(".pdf")]

print(f"\nFound {len(pdf_files)} PDFs\n")

for pdf_file in tqdm(pdf_files):

    pdf_path = os.path.join(PDF_FOLDER, pdf_file)

    try:
        doc = fitz.open(pdf_path)

        full_text = ""

        for page in doc:
            full_text += page.get_text()

        doc.close()

        cleaned_text = clean_text(full_text)

        output_file = os.path.join(
            OUTPUT_FOLDER,
            pdf_file.replace(".pdf", ".txt")
        )

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(cleaned_text)

    except Exception as e:
        print(f"\nError in {pdf_file}: {e}")

print("\nAll PDFs processed successfully!")