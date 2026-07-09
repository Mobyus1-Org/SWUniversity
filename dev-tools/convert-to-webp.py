#!/usr/bin/env python3
"""Convert an image to a WebP of a fixed size, saved next to the source.

Usage:
    python3 dev-tools/convert-to-webp.py public/assets/puzzles/clan-challengers.png
    python3 dev-tools/convert-to-webp.py <image> --size 400x400 --quality 90

The output .webp is written to the same directory as the source image,
with the same base name (e.g. clan-challengers.png -> clan-challengers.webp).

Requires Pillow:  pip install Pillow
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is not installed. Run: pip install Pillow")


def parse_size(value: str) -> tuple[int, int]:
    try:
        w, h = value.lower().split("x")
        return int(w), int(h)
    except ValueError:
        raise argparse.ArgumentTypeError(f"invalid size '{value}', expected WIDTHxHEIGHT (e.g. 400x400)")


def convert(source: Path, size: tuple[int, int], quality: int) -> Path:
    if not source.is_file():
        sys.exit(f"Source image not found: {source}")

    dest = source.with_suffix(".webp")
    with Image.open(source) as img:
        img = img.convert("RGBA") if img.mode in ("RGBA", "LA", "P") else img.convert("RGB")
        if img.size != size:
            img = img.resize(size, Image.LANCZOS)
        img.save(dest, "WEBP", quality=quality, method=6)

    return dest


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert an image to a fixed-size WebP next to the source.")
    parser.add_argument("source", type=Path, help="path to the source image")
    parser.add_argument("--size", type=parse_size, default=(400, 400), help="output size WIDTHxHEIGHT (default 400x400)")
    parser.add_argument("--quality", type=int, default=90, help="WebP quality 0-100 (default 90)")
    args = parser.parse_args()

    dest = convert(args.source, args.size, args.quality)
    print(f"Wrote {dest} ({args.size[0]}x{args.size[1]})")


if __name__ == "__main__":
    main()
