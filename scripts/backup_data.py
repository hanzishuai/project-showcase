#!/usr/bin/env python
"""备份 backend/data：SQLite 用 backup API 生成一致快照，Chroma/知识库按目录复制，再打 zip。

默认不包含 settings.json（可能含明文密钥），需要时加 --include-secrets。
建议先停止服务再备份（Chroma 目录在写入过程中复制可能不是一致快照）。
"""
from __future__ import annotations

import argparse
import datetime as dt
import shutil
import sqlite3
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "backend" / "data"
DEFAULT_DEST = ROOT / "backups"

SKIP_NAMES = {"settings.json"}


def backup_sqlite(src: Path, dst: Path) -> None:
    with sqlite3.connect(str(src)) as source, sqlite3.connect(str(dst)) as target:
        source.backup(target)


def main() -> int:
    parser = argparse.ArgumentParser(description="备份 project-showcase 的 backend/data")
    parser.add_argument("--destination", default=str(DEFAULT_DEST))
    parser.add_argument("--include-secrets", action="store_true", help="把 settings.json（可能含密钥）也打进去")
    args = parser.parse_args()

    if not DATA.is_dir():
        print(f"数据目录不存在：{DATA}", file=sys.stderr)
        return 1

    dest_dir = Path(args.destination)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    archive = dest_dir / f"project-showcase-data-{stamp}.zip"

    with tempfile.TemporaryDirectory(prefix="showcase-backup-") as tmp:
        snapshot = Path(tmp) / "data"
        snapshot.mkdir(parents=True, exist_ok=True)

        for name in ("app.db", "qa_log.sqlite3"):
            src = DATA / name
            if src.exists():
                backup_sqlite(src, snapshot / name)

        for name in ("chroma_storage", "docs"):
            src = DATA / name
            if src.exists():
                shutil.copytree(src, snapshot / name, dirs_exist_ok=True)

        if args.include_secrets and (DATA / "settings.json").exists():
            shutil.copy2(DATA / "settings.json", snapshot / "settings.json")

        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for path in sorted(snapshot.rglob("*")):
                if path.is_file():
                    zf.write(path, path.relative_to(snapshot))

    print(f"备份完成：{archive}")
    if not args.include_secrets:
        print("说明：默认未包含 settings.json（可能含明文密钥）；需要时加 --include-secrets。")
    print("提示：Chroma 索引与问答日志请妥善保管；建议停服后再做一次备份以取得完全一致快照。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
