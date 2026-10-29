import os
import tempfile
import time
import unittest
from unittest.mock import patch

from app import create_app
from app.services.download_manager import (
    get_download_status,
    start_download,
)


class TestDownloadManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.app = create_app(config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": (
                f"sqlite:///{os.path.join(self.temp_dir.name, 'test.db')}"
            ),
            "MP3_FOLDER": os.path.join(self.temp_dir.name, "mp3"),
        })

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_worker_updates_progress_and_final_result(self):
        def fake_download(_entry, _folder, progress_callback):
            progress_callback({
                "phase": "downloading",
                "message": "Descargando audio...",
                "percent": 55,
                "speed": 2048,
            })
            progress_callback({
                "phase": "converting",
                "message": "Convirtiendo a MP3...",
                "percent": 100,
            })
            return {"success": True, "message": "Descarga completada"}

        with patch(
            "app.services.download_manager.MusicService.download_song",
            side_effect=fake_download,
        ):
            task_id = start_download(
                self.app, "test audio", self.app.config["MP3_FOLDER"]
            )
            deadline = time.monotonic() + 3
            status = get_download_status(task_id)
            while status["state"] not in {"completed", "failed"}:
                if time.monotonic() >= deadline:
                    self.fail("Download task did not finish in time")
                time.sleep(0.01)
                status = get_download_status(task_id)

        self.assertEqual(status["state"], "completed")
        self.assertEqual(status["phase"], "completed")
        self.assertEqual(status["percent"], 100)
        self.assertTrue(status["result"]["success"])

    def test_missing_task_returns_none(self):
        self.assertIsNone(get_download_status("not-a-task"))


if __name__ == "__main__":
    unittest.main()
