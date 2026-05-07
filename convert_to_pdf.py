import os
import io
from pathlib import Path
from PIL import Image
import pytesseract

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

FOLDER = Path(r"C:\!PROJECTS\WEBDEV\MSLOG\Original 1974 Snowblaze Declaration Recreational Tracts")
OUTPUT = FOLDER.parent / "1974_Snowblaze_Declaration_Recreational_Tracts.pdf"

jpgs = sorted(FOLDER.glob("*.jpg"))
print(f"Found {len(jpgs)} images — generating searchable PDF...\n")

# Tesseract generates one PDF per image with embedded image + invisible OCR text layer
page_pdfs = []
for i, jpg in enumerate(jpgs, 1):
    print(f"  [{i:02d}/{len(jpgs)}] {jpg.name}")
    img = Image.open(jpg)
    if img.mode != "RGB":
        img = img.convert("RGB")

    # image_to_pdf_or_hocr returns bytes of a single-page PDF
    pdf_bytes = pytesseract.image_to_pdf_or_hocr(
        img,
        extension="pdf",
        config="--oem 1 --psm 1 -l eng"  # LSTM engine, auto page seg, English
    )
    page_pdfs.append(pdf_bytes)

# Merge all single-page PDFs into one
print("\nMerging pages...")
try:
    from pypdf import PdfWriter, PdfReader
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf", "-q"])
    from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_bytes in page_pdfs:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    for page in reader.pages:
        writer.add_page(page)

with open(OUTPUT, "wb") as f:
    writer.write(f)

size_mb = OUTPUT.stat().st_size / 1024 / 1024
print(f"\nDone!")
print(f"Output : {OUTPUT}")
print(f"Pages  : {len(jpgs)}")
print(f"Size   : {size_mb:.1f} MB")
if size_mb > 10:
    print(f"NOTE   : File is over 10MB — Firebase Storage limit. Consider splitting or compressing.")
