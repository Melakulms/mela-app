from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
expected = {str(p.relative_to(root)): p.read_bytes() for p in (root / "learning-projects").rglob("*") if p.is_file() and p.suffix in (".py", ".md")}
with zipfile.ZipFile(root / "public/ai-practice-projects-v1.zip") as archive:
    assert set(archive.namelist()) == set(expected), "Archive file list differs"
    for name, data in expected.items():
        assert archive.read(name) == data, name
print("Practice archive matches all source files.")
