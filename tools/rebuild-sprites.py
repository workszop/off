#!/usr/bin/env python3
"""Build crisp production sprites from the generated high-resolution strips.

Run without arguments to rebuild ``assets/sprites/zine`` and the lossless
source archive/manifest under ``docs/concepts/zine-sprites/hd``.  ``--check``
validates the archive hashes and every output's fixed frame geometry.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import shutil
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCES_JSON = ROOT / 'scratch/sprite-sharpness/generated-sources.json'
BEFORE_ROOT = ROOT / 'scratch/sprite-sharpness/before'
HD_ROOT = ROOT / 'docs/concepts/zine-sprites/hd'
PRODUCTION_ROOT = ROOT / 'assets/sprites/zine'
FRAME_W, FRAME_H, DENSITY, BASE_PX = 640, 960, 2, 52
OUTPUT_SIZE = (FRAME_W * DENSITY, FRAME_H * DENSITY)
ALPHA_THRESHOLD = 128
HUMANS = {'andy', 'jazz', 'olex', 'margo-v3'}
HUMAN_FRAMES = ('idle', 'walk_01', 'walk_02', 'walk_03', 'walk_04')
GHOST_FRAMES = HUMAN_FRAMES
SCRIPT_VERSION = 1


def load_extractor():
    path = ROOT / 'tools/extract-atlas.py'
    spec = importlib.util.spec_from_file_location('extract_atlas', path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Cannot load {path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


EXTRACT = load_extractor()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def alpha_bbox(image: Image.Image):
    return image.getchannel('A').point(
        lambda value: 255 if value > ALPHA_THRESHOLD else 0
    ).getbbox()


def trim_cleaned(cell: Image.Image) -> Image.Image:
    """Trim a regular cell after ``grid_cells`` removed detached debris."""
    bbox = alpha_bbox(cell)
    if not bbox:
        raise ValueError('source cell contains no opaque figure')
    return cell.crop(bbox)


def old_geometry(name: str, view: str, frame: str) -> dict:
    path = BEFORE_ROOT / name / f'{view}_{frame}.webp'
    if not path.exists():
        raise FileNotFoundError(path)
    bbox = alpha_bbox(Image.open(path).convert('RGBA'))
    if not bbox:
        raise ValueError(f'old sprite has no opaque figure: {path}')
    height = bbox[3] - bbox[1]
    return {
        'width': bbox[2] - bbox[0],
        'height': height,
        'targetHeight': height / DENSITY,
    }


def source_cells(entry: dict):
    image = EXTRACT.prepare_atlas(Image.open(entry['path']))
    return [
        (col, trim_cleaned(cell))
        for _, col, cell in EXTRACT.grid_cells(image, rows=['source'], cols=entry['cols'])
    ]


def save_lossless(image: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'WEBP', lossless=True, method=6)


def save_runtime(image: Image.Image, path: Path):
    """Keep high-quality ink and exact alpha without shipping lossless grain."""
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'WEBP', quality=97, method=6)


def frame_output(name: str, view: str, frame: str, figure: Image.Image) -> Image.Image:
    geometry = old_geometry(name, view, frame)
    # Use each old pose's bbox height. This preserves proportions across
    # separate generated strips and keeps the old paper baseline unchanged.
    return EXTRACT.compose_frame(
        figure,
        tallest=figure.height,
        height=geometry['targetHeight'],
        scale=DENSITY,
    )


def source_relpath(name: str, view: str, index: int) -> Path:
    return Path('sources') / name / f'{view}_strip_{index:02d}.webp'


def load_sources(path: Path = SOURCES_JSON) -> list[dict]:
    entries = json.loads(Path(path).read_text())
    if not isinstance(entries, list) or len(entries) != 18:
        raise ValueError('generated-sources.json must contain exactly 18 source strips')
    allowed = HUMANS | {'ghost'}
    for entry in entries:
        if entry.get('name') not in allowed:
            raise ValueError(f'unknown character: {entry.get("name")}')
        if entry.get('view') not in {'front', 'threequarter', 'back'}:
            raise ValueError(f'unknown view: {entry.get("view")}')
        if not Path(entry['path']).exists():
            raise FileNotFoundError(entry['path'])
    return entries


def build_from_import(output_root: Path, hd_root: Path, sources_json: Path) -> dict:
    entries = load_sources(sources_json)
    output_root, hd_root = Path(output_root), Path(hd_root)
    output_root.mkdir(parents=True, exist_ok=True)
    hd_root.mkdir(parents=True, exist_ok=True)
    manifest = {
        'version': SCRIPT_VERSION,
        'alphaThreshold': ALPHA_THRESHOLD,
        'density': DENSITY,
        'logicalFrame': [FRAME_W, FRAME_H],
        'outputFrame': list(OUTPUT_SIZE),
        'baselinePx': FRAME_H * DENSITY - BASE_PX * DENSITY,
        'sourceStrips': [],
        'frames': {},
    }
    seen: dict[tuple[str, str], int] = {}
    source_frames: dict[tuple[str, str, str], Image.Image] = {}

    for entry in entries:
        name, view = entry['name'], entry['view']
        key = (name, view)
        index = seen.get(key, 0) + 1
        seen[key] = index
        source_path = Path(entry['path'])
        strip_rel = source_relpath(name, view, index)
        strip_path = hd_root / strip_rel
        save_lossless(Image.open(source_path).convert('RGBA'), strip_path)
        cells = source_cells(entry)
        native = {}
        for col, figure in cells:
            native[col] = {'width': figure.width, 'height': figure.height}
            source_frames[(name, view, col)] = figure
        manifest['sourceStrips'].append({
            'name': name,
            'view': view,
            'file': str(strip_rel),
            'cols': entry['cols'],
            'native': native,
            'inputSha256': sha256(source_path),
            'sha256': sha256(strip_path),
        })

    for name in sorted(HUMANS | {'ghost'}):
        manifest['frames'][name] = {}
        for view in ('front', 'threequarter', 'back'):
            frame_names = GHOST_FRAMES if name == 'ghost' else HUMAN_FRAMES
            details = {'targetHeight': max(
                old_geometry(name, view, frame)['height'] for frame in (
                    frame_names if name == 'ghost' else ('idle', 'walk_01', 'walk_03')
                )
            ) / DENSITY, 'frames': {}}
            manifest['frames'][name][view] = details
            for frame in frame_names:
                alias = None
                actual = frame
                if name in HUMANS and frame == 'walk_02':
                    alias, actual = 'walk_01', 'walk_01'
                elif name in HUMANS and frame == 'walk_04':
                    alias, actual = 'walk_03', 'walk_03'
                figure = source_frames.get((name, view, actual))
                if figure is None:
                    raise ValueError(f'missing generated frame: {name}/{view}/{actual}')
                rel = Path(name) / f'{view}_{frame}.webp'
                dest = output_root / rel
                if alias:
                    shutil.copyfile(output_root / name / f'{view}_{alias}.webp', dest)
                    metadata = {
                        'file': str(rel),
                        'aliasOf': alias,
                        'native': {'width': figure.width, 'height': figure.height},
                        'targetHeight': details['frames'][alias]['targetHeight'],
                    }
                else:
                    save_runtime(frame_output(name, view, frame, figure), dest)
                    old = old_geometry(name, view, frame)
                    metadata = {
                        'file': str(rel),
                        'native': {'width': figure.width, 'height': figure.height},
                        'targetHeight': old['targetHeight'],
                    }
                details['frames'][frame] = metadata

    (hd_root / 'manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
    return manifest


def load_archive(hd_root: Path) -> tuple[dict, dict[tuple[str, str, str], Image.Image]]:
    """Load only committed archive data; no scratch inputs are needed."""
    manifest_path = Path(hd_root) / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    source_frames = {}
    for strip in manifest['sourceStrips']:
        path = Path(hd_root) / strip['file']
        if not path.exists():
            raise FileNotFoundError(path)
        image = EXTRACT.prepare_atlas(Image.open(path))
        cells = EXTRACT.grid_cells(image, rows=['source'], cols=strip['cols'])
        for _, col, cell in cells:
            source_frames[(strip['name'], strip['view'], col)] = trim_cleaned(cell)
    return manifest, source_frames


def build_from_archive(output_root: Path, hd_root: Path) -> dict:
    """Rebuild production textures from the archived lossless strips."""
    output_root, hd_root = Path(output_root), Path(hd_root)
    manifest, source_frames = load_archive(hd_root)
    for strip in manifest['sourceStrips']:
        strip.pop('input', None)
    for name, views in manifest['frames'].items():
        for view, details in views.items():
            for frame, metadata in details['frames'].items():
                dest = output_root / metadata['file']
                alias = metadata.get('aliasOf')
                if alias:
                    shutil.copyfile(output_root / name / f'{view}_{alias}.webp', dest)
                    continue
                figure = source_frames[(name, view, frame)]
                canvas = EXTRACT.compose_frame(
                    figure,
                    tallest=figure.height,
                    height=metadata['targetHeight'],
                    scale=manifest['density'],
                )
                save_runtime(canvas, dest)
    manifest['runtimeEncoding'] = {'format': 'webp', 'quality': 97, 'alpha': 'lossless'}
    for views in manifest['frames'].values():
        for details in views.values():
            for metadata in details['frames'].values():
                metadata['sha256'] = sha256(output_root / metadata['file'])
    (hd_root / 'manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
    return manifest


def build(output_root: Path = PRODUCTION_ROOT, hd_root: Path = HD_ROOT,
          sources_json: Path | None = None) -> dict:
    """Use archive-only rebuilds by default; import scratch sources explicitly."""
    if sources_json is None:
        return build_from_archive(output_root, hd_root)
    return build_from_import(output_root, hd_root, sources_json)


def check(output_root: Path = PRODUCTION_ROOT, hd_root: Path = HD_ROOT) -> list[str]:
    manifest_path = Path(hd_root) / 'manifest.json'
    if not manifest_path.exists():
        return [f'missing manifest: {manifest_path}']
    manifest = json.loads(manifest_path.read_text())
    errors = []
    if manifest.get('outputFrame') != list(OUTPUT_SIZE):
        errors.append('manifest outputFrame is not 1280x1920')
    if manifest.get('baselinePx') != FRAME_H * DENSITY - BASE_PX * DENSITY:
        errors.append('manifest baselinePx is not 1816')
    expected_names = HUMANS | {'ghost'}
    if set(manifest.get('frames', {})) != expected_names:
        errors.append('manifest must contain exactly five character sets')
    for strip in manifest.get('sourceStrips', []):
        path = Path(hd_root) / strip['file']
        if not path.exists():
            errors.append(f'missing source strip: {path}')
            continue
        if sha256(path) != strip.get('sha256'):
            errors.append(f'source hash changed: {path}')
        for frame, native in strip.get('native', {}).items():
            if native['height'] < 580:
                errors.append(f'native source too short: {path} {frame} ({native["height"]})')
    for name, views in manifest.get('frames', {}).items():
        if set(views) != {'front', 'threequarter', 'back'}:
            errors.append(f'{name} must contain exactly three views')
        for view, details in views.items():
            expected_frames = set(GHOST_FRAMES if name == 'ghost' else HUMAN_FRAMES)
            if set(details.get('frames', {})) != expected_frames:
                errors.append(f'{name}/{view} must contain five frames')
            for frame, metadata in details.get('frames', {}).items():
                path = Path(output_root) / metadata['file']
                if not path.exists():
                    errors.append(f'missing production frame: {path}')
                    continue
                expected_hash = metadata.get('sha256')
                if expected_hash and sha256(path) != expected_hash:
                    errors.append(f'output hash changed: {path}')
                alias = metadata.get('aliasOf')
                if alias:
                    alias_path = Path(output_root) / name / f'{view}_{alias}.webp'
                    if not alias_path.exists() or path.read_bytes() != alias_path.read_bytes():
                        errors.append(f'alias changed: {path}')
                with Image.open(path) as image:
                    rgba = image.convert('RGBA')
                    if rgba.size != OUTPUT_SIZE:
                        errors.append(f'wrong output size: {path} {rgba.size}')
                    bbox = alpha_bbox(rgba)
                    if not bbox:
                        errors.append(f'empty production frame: {path}')
                    else:
                        expected_height = round(metadata['targetHeight'] * DENSITY)
                        # The visible alpha is re-anchored after resampling.
                        if bbox[3] != FRAME_H * DENSITY - BASE_PX * DENSITY:
                            errors.append(f'baseline changed: {path}')
                        if abs((bbox[3] - bbox[1]) - expected_height) > 1:
                            errors.append(f'height changed: {path}')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output-dir', type=Path, default=PRODUCTION_ROOT)
    parser.add_argument('--hd-dir', type=Path, default=HD_ROOT)
    parser.add_argument('--import-sources', type=Path, metavar='JSON',
                        help='initial-generation source list; default rebuilds from the HD archive')
    args = parser.parse_args()
    if args.check:
        errors = check(args.output_dir, args.hd_dir)
        if errors:
            for error in errors:
                print(f'ERROR: {error}', file=sys.stderr)
            raise SystemExit(1)
        print('Sprite sharpness check passed')
        return
    manifest = build(args.output_dir, args.hd_dir, args.import_sources)
    count = sum(len(view['frames']) for views in manifest['frames'].values() for view in views.values())
    total = sum(
        (args.output_dir / item['file']).stat().st_size
        for views in manifest['frames'].values()
        for view in views.values()
        for item in view['frames'].values()
    )
    minimum = min(native['height'] for strip in manifest['sourceStrips'] for native in strip['native'].values())
    print(f'Built {count} frames; production size {total / 1024 / 1024:.2f} MiB; native minimum {minimum}px')


if __name__ == '__main__':
    main()
