#!/usr/bin/env python3
"""Split the project sprite sheet into clean, centered RGBA animation frames.

This intentionally uses only Python's standard library plus the ffmpeg binary
already used by the project, so it can be rerun without Pillow/ImageMagick.
"""

from __future__ import annotations

import binascii
import struct
import subprocess
import zlib
from collections import deque
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/pet-actions.png"
# Keep legacy contact-sheet output separate so rerunning this migration helper
# can never overwrite the current hand-authored 540x540 action library.
OUTPUT = ROOT / "public/assets/legacy-actions"

SOURCE_WIDTH = 1400
SOURCE_HEIGHT = 1120
CANVAS_SIZE = 180

# The generated contact sheet is not vertically uniform. These boundaries sit
# between the actual character rows and prevent feet from one row leaking into
# the next. The damaged final row is deliberately not used; walk-left is built
# by mirroring the complete walk-right frames.
ROW_BOUNDS = (
    (0, 155),
    (155, 295),
    (295, 435),
    (435, 585),
    (585, 735),
    (735, 880),
    (880, 1018),
)

ACTIONS = (
    ("idle", 0, 10),
    ("walk-right", 1, 9),
    ("thinking", 2, 9),
    ("sorry", 3, 9),
    ("sleep", 4, 10),
    ("love", 5, 10),
    ("handsome", 6, 10),
)


def read_rgba(path: Path) -> bytearray:
    result = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-",
        ],
        check=True,
        stdout=subprocess.PIPE,
    )
    expected = SOURCE_WIDTH * SOURCE_HEIGHT * 4
    if len(result.stdout) != expected:
        raise RuntimeError(f"Expected {expected} RGBA bytes, got {len(result.stdout)}")
    return bytearray(result.stdout)


def clean_green_edges(pixels: bytearray) -> None:
    """Remove transparent-key residue and despill green from soft edges."""
    for index in range(0, len(pixels), 4):
        red, green, blue, alpha = pixels[index : index + 4]
        if alpha <= 18:
            pixels[index : index + 4] = b"\x00\x00\x00\x00"
            continue

        green_excess = green - max(red, blue)
        if green_excess > 2:
            # Any excess green comes from the chroma background; the character
            # contains no intentional green. Fade contaminated edge pixels and
            # replace their RGB green with a neutral edge colour.
            if green_excess > 8:
                fade = max(0.0, min(1.0, 1.0 - (green_excess - 8) / 62.0))
                alpha = round(alpha * fade)
            green = min(green, max(red, blue) + 2)

        if alpha <= 18:
            pixels[index : index + 4] = b"\x00\x00\x00\x00"
        else:
            pixels[index : index + 4] = bytes((red, green, blue, alpha))


def crop_cell(source: bytearray, column: int, row: int) -> tuple[bytearray, int, int]:
    x0 = column * 140
    x1 = x0 + 140
    y0, y1 = ROW_BOUNDS[row]
    width = x1 - x0
    height = y1 - y0
    cell = bytearray(width * height * 4)
    for y in range(height):
        source_start = ((y0 + y) * SOURCE_WIDTH + x0) * 4
        target_start = y * width * 4
        cell[target_start : target_start + width * 4] = source[source_start : source_start + width * 4]
    return cell, width, height


def largest_component_bbox(pixels: bytearray, width: int, height: int) -> tuple[int, int, int, int]:
    visible = bytearray(1 if pixels[index + 3] >= 80 else 0 for index in range(0, len(pixels), 4))
    seen = bytearray(width * height)
    best: list[int] = []

    for start in range(width * height):
        if not visible[start] or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        component: list[int] = []
        while queue:
            current = queue.popleft()
            component.append(current)
            x = current % width
            y = current // width
            for neighbour in (
                current - 1 if x else -1,
                current + 1 if x + 1 < width else -1,
                current - width if y else -1,
                current + width if y + 1 < height else -1,
            ):
                if neighbour >= 0 and visible[neighbour] and not seen[neighbour]:
                    seen[neighbour] = 1
                    queue.append(neighbour)
        if len(component) > len(best):
            best = component

    if not best:
        raise RuntimeError("No visible character component found")
    xs = [point % width for point in best]
    ys = [point // width for point in best]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def remove_foreign_components(pixels: bytearray, width: int, height: int) -> None:
    """Drop large detached fragments from neighbouring contact-sheet cells.

    Small detached components are intentional effects (hearts, bubbles, tears,
    sparkles and Zs), so they are retained even when separated from the body.
    """
    visible = bytearray(1 if pixels[index + 3] >= 24 else 0 for index in range(0, len(pixels), 4))
    seen = bytearray(width * height)
    components: list[list[int]] = []

    for start in range(width * height):
        if not visible[start] or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        component: list[int] = []
        while queue:
            current = queue.popleft()
            component.append(current)
            x = current % width
            y = current // width
            for offset_y in (-1, 0, 1):
                for offset_x in (-1, 0, 1):
                    if offset_x == 0 and offset_y == 0:
                        continue
                    neighbour_x = x + offset_x
                    neighbour_y = y + offset_y
                    if not (0 <= neighbour_x < width and 0 <= neighbour_y < height):
                        continue
                    neighbour = neighbour_y * width + neighbour_x
                    if visible[neighbour] and not seen[neighbour]:
                        seen[neighbour] = 1
                        queue.append(neighbour)
        components.append(component)

    if not components:
        return
    main = max(components, key=len)
    main_xs = [point % width for point in main]
    main_ys = [point // width for point in main]
    main_box = (min(main_xs), min(main_ys), max(main_xs) + 1, max(main_ys) + 1)

    for component in components:
        if component is main or len(component) <= 110:
            continue
        xs = [point % width for point in component]
        ys = [point // width for point in component]
        box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        gap_x = max(main_box[0] - box[2], box[0] - main_box[2], 0)
        gap_y = max(main_box[1] - box[3], box[1] - main_box[3], 0)
        if max(gap_x, gap_y) <= 12:
            continue
        for point in component:
            index = point * 4
            pixels[index : index + 4] = b"\x00\x00\x00\x00"


def centered_frame(cell: bytearray, width: int, height: int) -> bytearray:
    remove_foreign_components(cell, width, height)
    left, top, right, bottom = largest_component_bbox(cell, width, height)
    main_center_x = (left + right) / 2
    main_center_y = (top + bottom) / 2
    offset_x = round(CANVAS_SIZE / 2 - main_center_x)
    offset_y = round(CANVAS_SIZE / 2 - main_center_y)
    output = bytearray(CANVAS_SIZE * CANVAS_SIZE * 4)

    for source_y in range(height):
        target_y = source_y + offset_y
        if not 0 <= target_y < CANVAS_SIZE:
            continue
        for source_x in range(width):
            target_x = source_x + offset_x
            if not 0 <= target_x < CANVAS_SIZE:
                continue
            source_index = (source_y * width + source_x) * 4
            if cell[source_index + 3] == 0:
                continue
            target_index = (target_y * CANVAS_SIZE + target_x) * 4
            output[target_index : target_index + 4] = cell[source_index : source_index + 4]
    return output


def flip_horizontal(pixels: bytearray) -> bytearray:
    output = bytearray(len(pixels))
    for y in range(CANVAS_SIZE):
        for x in range(CANVAS_SIZE):
            source_index = (y * CANVAS_SIZE + x) * 4
            target_index = (y * CANVAS_SIZE + CANVAS_SIZE - x - 1) * 4
            output[target_index : target_index + 4] = pixels[source_index : source_index + 4]
    return output


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", binascii.crc32(kind + data) & 0xFFFFFFFF)


def write_png(path: Path, pixels: bytearray) -> None:
    raw = bytearray()
    stride = CANVAS_SIZE * 4
    for y in range(CANVAS_SIZE):
        raw.append(0)  # PNG filter: None
        raw.extend(pixels[y * stride : (y + 1) * stride])
    header = struct.pack(">IIBBBBB", CANVAS_SIZE, CANVAS_SIZE, 8, 6, 0, 0, 0)
    payload = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header)
    payload += png_chunk(b"IDAT", zlib.compress(bytes(raw), level=9))
    payload += png_chunk(b"IEND", b"")
    path.write_bytes(payload)


def validate_frame(action: str, index: int, pixels: bytearray) -> None:
    left, top, right, bottom = largest_component_bbox(pixels, CANVAS_SIZE, CANVAS_SIZE)
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    if abs(center_x - CANVAS_SIZE / 2) > 1 or abs(center_y - CANVAS_SIZE / 2) > 1:
        raise RuntimeError(f"{action}/{index:03d} is not centered: ({center_x}, {center_y})")

    for offset in range(0, len(pixels), 4):
        red, green, blue, alpha = pixels[offset : offset + 4]
        if alpha > 18 and green - max(red, blue) > 2:
            raise RuntimeError(f"{action}/{index:03d} still contains green spill")


def main() -> None:
    source = read_rgba(SOURCE)
    clean_green_edges(source)
    finished: dict[str, list[bytearray]] = {}

    for action, row, frame_count in ACTIONS:
        action_dir = OUTPUT / action
        action_dir.mkdir(parents=True, exist_ok=True)
        frames: list[bytearray] = []
        for column in range(frame_count):
            cell, width, height = crop_cell(source, column, row)
            frame = centered_frame(cell, width, height)
            validate_frame(action, column, frame)
            write_png(action_dir / f"{column:03d}.png", frame)
            frames.append(frame)
        finished[action] = frames

    left_dir = OUTPUT / "walk-left"
    left_dir.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(finished["walk-right"]):
        left_frame = flip_horizontal(frame)
        validate_frame("walk-left", index, left_frame)
        write_png(left_dir / f"{index:03d}.png", left_frame)

    print(f"Wrote {sum(len(frames) for frames in finished.values()) + len(finished['walk-right'])} frames to {OUTPUT}")


if __name__ == "__main__":
    main()
