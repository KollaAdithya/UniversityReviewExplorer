#!/usr/bin/env python3
"""Download freely available real review datasets (no synthetic generation)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

# Real RMP research sample — same schema family as Mendeley He (2020) corpus
RMP_SAMPLE_URL = (
    "https://raw.githubusercontent.com/liumingchun/RateMyProfessor/master/RMP_sample_data.csv"
)
DEFAULT_OUTPUT = DATA_DIR / "rmp_public.csv"


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url}")
    print(f"  -> {dest}")
    urllib.request.urlretrieve(url, dest)
    lines = dest.read_text(encoding="utf-8", errors="replace").count("\n")
    print(f"Done ({lines} lines).")


def main() -> int:
    parser = argparse.ArgumentParser(description="Download public course/professor review CSVs")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output path for RMP public sample",
    )
    args = parser.parse_args()

    try:
        download(RMP_SAMPLE_URL, args.output)
    except Exception as exc:
        print(f"Download failed: {exc}", file=sys.stderr)
        print(
            "\nManual fallback: save a CSV from\n"
            "  https://github.com/liumingchun/RateMyProfessor/blob/master/RMP_sample_data.csv\n"
            f"  to {args.output}",
            file=sys.stderr,
        )
        return 1

    print(
        "\nFor millions of real reviews (CC BY 4.0), download from Mendeley:\n"
        "  https://data.mendeley.com/datasets/fvtfjyvw7d/2\n"
        "Then: python scripts/import_public_data.py --file data/<your_file>.csv --force"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
