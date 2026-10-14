from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent
failed = []
for test in sorted(root.glob("*/test_project.py")):
    command = [sys.executable, test.name]
    if "--reference" in sys.argv:
        command.append("--reference")
    print("\n" + test.parent.name, flush=True)
    if subprocess.run(command, cwd=test.parent).returncode:
        failed.append(test.parent.name)
if failed:
    print("Failed projects:", ", ".join(failed))
    sys.exit(1)
print("All 10 project suites passed.")
