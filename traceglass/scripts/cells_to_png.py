#!/usr/bin/env python3
"""Convert TestBackend cell-grid JSON dumps to PNG screenshots."""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image, ImageDraw, ImageFont

CELL_W = 9
CELL_H = 18
DEFAULT_FG = (215, 218, 224)
DEFAULT_BG = (15, 17, 23)


def rgb(cell_color):
    if cell_color is None:
        return None
    if isinstance(cell_color, dict) and "rgb" in cell_color:
        r, g, b = cell_color["rgb"]
        return (int(r), int(g), int(b))
    return None


def render(path: Path, out: Path) -> None:
    data = json.loads(path.read_text())
    w, h = int(data["width"]), int(data["height"])
    img = Image.new("RGB", (w * CELL_W, h * CELL_H), DEFAULT_BG)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 14
        )
    except OSError:
        font = ImageFont.load_default()

    for y, row in enumerate(data["cells"]):
        for x, cell in enumerate(row):
            bg = rgb(cell.get("bg")) or DEFAULT_BG
            fg = rgb(cell.get("fg")) or DEFAULT_FG
            x0, y0 = x * CELL_W, y * CELL_H
            draw.rectangle([x0, y0, x0 + CELL_W - 1, y0 + CELL_H - 1], fill=bg)
            ch = cell.get("ch") or " "
            if ch.strip() == "" and ch != " ":
                continue
            draw.text((x0 + 1, y0 + 1), ch[:2], fill=fg, font=font)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    print(out)


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/cursor/artifacts/signal-shots")
    dst = Path(sys.argv[2] if len(sys.argv) > 2 else "/opt/cursor/artifacts")
    for json_path in sorted(src.glob("*.json")):
        # Map ansi16 → conhost16 naming requested by the brief.
        name = json_path.stem.replace("-ansi16", "-conhost16")
        render(json_path, dst / f"signal-{name}.png")


if __name__ == "__main__":
    main()
