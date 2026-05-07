import io
import tempfile
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
TARGET_LONG_EDGE = 1800
JPEG_QUALITY = 80

REDO = [
    "1972 - INLAND POWER UNDERGROUND EASEMENT",
    "1974 - DECLARATION OF RESTRICTIONS, COVENANTS AND EASEMENTS",
]

for folder_name in REDO:
    folder = ROOT / folder_name
    images = sorted([f for f in folder.iterdir() if f.suffix.lower() in EXTS])
    output_pdf = folder / f"{folder_name}.pdf"

    print(f"\n{'='*60}")
    print(f"Folder : {folder_name}")
    print(f"Images : {len(images)}")
    print(f"{'='*60}")

    writer = PdfWriter()
    with tempfile.TemporaryDirectory() as tmpdir:
        for i, img_path in enumerate(images, 1):
            print(f"  [{i:02d}/{len(images)}] {img_path.name}")
            img = Image.open(img_path)
            if img.mode != "RGB":
                img = img.convert("RGB")

            # Resize so longest edge = TARGET_LONG_EDGE
            w, h = img.size
            scale = TARGET_LONG_EDGE / max(w, h)
            if scale < 1.0:
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

            # Save as JPEG to temp file so Tesseract embeds JPEG-compressed image
            tmp_jpg = Path(tmpdir) / f"page_{i:03d}.jpg"
            img.save(tmp_jpg, format="JPEG", quality=JPEG_QUALITY)

            pdf_bytes = pytesseract.image_to_pdf_or_hocr(
                str(tmp_jpg),
                extension="pdf",
                config="--oem 1 --psm 1 -l eng"
            )
            reader = PdfReader(io.BytesIO(pdf_bytes))
            for page in reader.pages:
                writer.add_page(page)

    with open(output_pdf, "wb") as f:
        writer.write(f)

    size_mb = output_pdf.stat().st_size / 1024 / 1024
    flag = " *** STILL OVER 10MB ***" if size_mb > 10 else " OK"
    print(f"  Done: {size_mb:.1f} MB{flag}")

print("\nDone.")
