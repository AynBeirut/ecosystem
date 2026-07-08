#!/usr/bin/env python3
"""Generate Invoice Manager icons for Android TWA + web PWA from a master logo."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
DEFAULT_SRC = (
    Path.home()
    / ".cursor/projects/home-anwar-Documents-grabio-space/assets"
    / "WhatsApp_Image_2026-07-07_at_1.34.14_PM-e9163707-6a67-45c5-a39d-b95b21f4a71d.png"
)

MIPMAP_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

SPLASH_SIZES = {
    "drawable-mdpi": 300,
    "drawable-hdpi": 450,
    "drawable-xhdpi": 600,
    "drawable-xxhdpi": 900,
    "drawable-xxxhdpi": 1200,
}


def clean_logo(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    cleaned = Image.new("RGBA", im.size, (255, 255, 255, 255))
    pixels = im.load()
    out = cleaned.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = pixels[x, y]
            # Flatten light gray / checkerboard export background to white.
            if r > 165 and g > 165 and b > 165:
                out[x, y] = (255, 255, 255, 255)
            else:
                out[x, y] = (r, g, b, 255)
    return cleaned.convert("RGB")


def save_square(im: Image.Image, size: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    resized = im.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(dest, format="PNG", optimize=True)


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.exists():
        print(f"Source image not found: {src}", file=sys.stderr)
        return 1

    master = clean_logo(src)
    master_1024 = master.resize((1024, 1024), Image.Resampling.LANCZOS)

    android_res = ROOT / "android" / "app" / "src" / "main" / "res"
    for folder, size in MIPMAP_SIZES.items():
        save_square(master_1024, size, android_res / folder / "ic_launcher.png")
        save_square(master_1024, size, android_res / folder / "ic_maskable.png")
        save_square(master_1024, size, android_res / f"drawable-{folder.split('-', 1)[1]}" / "shortcut_0.png")
        save_square(master_1024, size, android_res / f"drawable-{folder.split('-', 1)[1]}" / "shortcut_1.png")

    for folder, size in SPLASH_SIZES.items():
        save_square(master_1024, size, android_res / folder / "splash.png")

    store_assets = ROOT / "store-assets"
    save_square(master_1024, 512, store_assets / "icon-512.png")
    save_square(master_1024, 192, store_assets / "icon-192.png")
    save_square(master_1024, 512, store_assets / "icon-512-hires.png")

    web_public = REPO / "the eco sys" / "finance" / "beirut-finance-flow-main" / "public"
    save_square(master_1024, 512, web_public / "icon-512.png")
    save_square(master_1024, 192, web_public / "icon-192.png")

    master_1024.save(ROOT / "store-assets" / "source-icon-1024.png", format="PNG", optimize=True)
    print(f"Generated icons from {src}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
