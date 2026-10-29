from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Lock
from uuid import uuid4

from app.services.music_service import MusicService


_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="music-download")
_tasks = {}
_tasks_lock = Lock()
_task_lifetime = timedelta(hours=1)


def _update_task(task_id, updates):
    with _tasks_lock:
        task = _tasks.get(task_id)
        if task:
            task.update(updates)
            task["updated_at"] = datetime.now(timezone.utc).isoformat()


def _run_download(app, task_id, entry, output_folder):
    _update_task(task_id, {
        "state": "running",
        "phase": "fetching",
        "message": "Obteniendo información...",
    })
    try:
        with app.app_context():
            result = MusicService.download_song(
                entry,
                output_folder,
                progress_callback=lambda progress: _update_task(
                    task_id, progress
                ),
            )
        _update_task(task_id, {
            "state": "completed",
            "phase": "completed",
            "message": result.get("message", "Finalizado"),
            "percent": 100,
            "result": result,
        })
    except Exception as error:
        app.logger.exception("Download task %s failed", task_id)
        _update_task(task_id, {
            "state": "failed",
            "phase": "failed",
            "message": str(error),
            "error": str(error),
        })


def start_download(app, entry, output_folder):
    now = datetime.now(timezone.utc)
    with _tasks_lock:
        expired = [
            task_id for task_id, task in _tasks.items()
            if task["state"] in {"completed", "failed"}
            and now - datetime.fromisoformat(task["updated_at"]) > _task_lifetime
        ]
        for task_id in expired:
            del _tasks[task_id]

        task_id = str(uuid4())
        _tasks[task_id] = {
            "task_id": task_id,
            "state": "queued",
            "phase": "fetching",
            "message": "En cola...",
            "percent": 0,
            "speed": None,
            "result": None,
            "error": None,
            "updated_at": now.isoformat(),
        }

    _executor.submit(_run_download, app, task_id, entry, output_folder)
    return task_id


def get_download_status(task_id):
    with _tasks_lock:
        task = _tasks.get(task_id)
        return dict(task) if task else None
