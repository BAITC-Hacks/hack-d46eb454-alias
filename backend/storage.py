"""Local persistence for previews, dataset metadata and calculated runs."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


DATA_DIR = Path(os.environ.get("HACKALEM_DATA_DIR", Path(__file__).resolve().parents[1] / "data"))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATA_DIR / "hackalem.sqlite3")
    connection.execute("CREATE TABLE IF NOT EXISTS datasets (dataset_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, label TEXT NOT NULL, payload_path TEXT NOT NULL)")
    connection.execute("CREATE TABLE IF NOT EXISTS preview_commits (preview_id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL)")
    connection.execute("CREATE TABLE IF NOT EXISTS runs (run_id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, created_at TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, approval_by TEXT, approval_at TEXT)")
    connection.execute("CREATE TABLE IF NOT EXISTS run_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, revision INTEGER NOT NULL, item_id TEXT, event TEXT NOT NULL, actor TEXT, reason TEXT, old_quantity REAL, new_quantity REAL, created_at TEXT NOT NULL)")
    connection.execute("CREATE TABLE IF NOT EXISTS run_exclusions (run_id TEXT NOT NULL, item_id TEXT NOT NULL, details TEXT NOT NULL, PRIMARY KEY(run_id, item_id))")
    return connection


def save_preview(payload: dict) -> str:
    preview_id = f"preview_{uuid4().hex}"
    folder = DATA_DIR / "previews"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{preview_id}.json").write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")
    return preview_id


def commit_preview(preview_id: str, label: str) -> dict:
    if not preview_id.startswith("preview_") or "/" in preview_id or "\\" in preview_id:
        raise KeyError(preview_id)
    source = DATA_DIR / "previews" / f"{preview_id}.json"
    if not source.is_file():
        raise KeyError(preview_id)
    with _connect() as connection:
        prior = connection.execute(
            "SELECT d.dataset_id, d.created_at, d.label FROM preview_commits p JOIN datasets d ON d.dataset_id = p.dataset_id WHERE p.preview_id = ?",
            (preview_id,),
        ).fetchone()
    if prior:
        return {"dataset_id": prior[0], "created_at": prior[1], "label": prior[2]}
    dataset_id = f"dataset_{uuid4().hex}"
    target_dir = DATA_DIR / "datasets"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{dataset_id}.json"
    target.write_bytes(source.read_bytes())
    created_at = now_iso()
    with _connect() as connection:
        connection.execute("INSERT INTO datasets VALUES (?, ?, ?, ?)", (dataset_id, created_at, label, str(target)))
        connection.execute("INSERT INTO preview_commits VALUES (?, ?)", (preview_id, dataset_id))
    return {"dataset_id": dataset_id, "created_at": created_at, "label": label}


def get_dataset(dataset_id: str) -> dict:
    with _connect() as connection:
        row = connection.execute("SELECT payload_path FROM datasets WHERE dataset_id = ?", (dataset_id,)).fetchone()
    if row is None:
        raise KeyError(dataset_id)
    return json.loads(Path(row[0]).read_text(encoding="utf-8"))


def save_run(run: dict, revision: int = 1, approval_by: str | None = None, approval_at: str | None = None) -> None:
    with _connect() as connection:
        connection.execute(
            "INSERT INTO runs (run_id, dataset_id, created_at, revision, body, approval_by, approval_at) VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(run_id) DO UPDATE SET revision=excluded.revision, body=excluded.body, approval_by=excluded.approval_by, approval_at=excluded.approval_at",
            (run["run_id"], run["dataset_id"], now_iso(), revision, json.dumps(run, ensure_ascii=False), approval_by, approval_at),
        )


def get_run(run_id: str) -> tuple[dict, int, str | None, str | None]:
    with _connect() as connection:
        row = connection.execute("SELECT body, revision, approval_by, approval_at FROM runs WHERE run_id = ?", (run_id,)).fetchone()
    if row is None:
        raise KeyError(run_id)
    return json.loads(row[0]), row[1], row[2], row[3]


def save_exclusions(run_id: str, item_id: str, details: list[dict]) -> None:
    if not details:
        return
    with _connect() as connection:
        connection.execute("INSERT OR REPLACE INTO run_exclusions VALUES (?, ?, ?)", (run_id, item_id, json.dumps(details, ensure_ascii=False)))


def append_audit(run_id: str, revision: int, event: str, actor: str | None, reason: str | None = None,
                 item_id: str | None = None, old_quantity: float | None = None, new_quantity: float | None = None) -> None:
    with _connect() as connection:
        connection.execute(
            "INSERT INTO run_audit (run_id, revision, item_id, event, actor, reason, old_quantity, new_quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (run_id, revision, item_id, event, actor, reason, old_quantity, new_quantity, now_iso()),
        )
