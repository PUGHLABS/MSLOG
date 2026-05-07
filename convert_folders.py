import io
from pathlib import Path
import pytesseract
from PIL import Image

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

try:
    from pypdf import PdfWriter, PdfReader
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf", "-q"])
    from pypdf import PdfWriter, PdfReader

ROOT = Path(r"C:\!PROJECTS\WEBDEV\MSLOG\Original 1974 Snowblaze Declaration Recreational Tracts")
EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}

subfolders = sorted([d for d in ROOT.iterdir() if d.is_dir()])

for folder in subfolders:
    images = sorted([f for f in folder.iterdir() if f.suffix.lower() in EXTS])
    if not images:
        print(f"SKIP (no images): {folder.name}\n")
        continue

    output_pdf = folder / f"{folder.name}.pdf"
    print(f"\n{'='*60}")
    print(f"Folder : {folder.name}")
    print(f"Images : {len(images)}")
    print(f"Output : {output_pdf.name}")
    print(f"{'='*60}")

    writer = PdfWriter()
    for i, img_path in enumerate(images, 1):
        print(f"  [{i:02d}/{len(images)}] {img_path.name}")
        img = Image.open(img_path)
        if img.mode != "RGB":
            img = img.convert("RGB")
        pdf_bytes = pytesseract.image_to_pdf_or_hocr(
            img,
            extension="pdf",
            config="--oem 1 --psm 1 -l eng"
        )
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            writer.add_page(page)

    with open(output_pdf, "wb") as f:
        writer.write(f)

    size_mb = output_pdf.stat().st_size / 1024 / 1024
    flag = " *** OVER 10MB LIMIT ***" if size_mb > 10 else ""
    print(f"  Done: {size_mb:.1f} MB{flag}")

print("\n\nAll folders complete.")
