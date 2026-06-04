#!/usr/bin/env python3
"""Deprecated: use import_public_data.py with real public CSV data."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

if __name__ == "__main__":
    print("Note: import_rmp_subset.py is deprecated. Using import_public_data.py instead.")
    subprocess.check_call(
        [
            sys.executable,
            str(ROOT / "scripts" / "import_public_data.py"),
            "--file",
            str(ROOT / "data" / "rmp_public.csv"),
            *sys.argv[1:],
        ]
    )
