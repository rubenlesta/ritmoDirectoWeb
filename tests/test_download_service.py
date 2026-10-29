import os
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import yt_dlp
from mutagen.mp3 import MP3

from app import create_app
from app.models import Album, AlbumCancion, Cancion, db
from app.services.music_service import MusicDownloadError, MusicService


@unittest.skipUnless(
    shutil.which("ffmpeg") and shutil.which("ffprobe"),
    "FFmpeg and FFprobe are required for the download-flow test",
)
class TestDownloadService(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.mp3_folder = os.path.join(self.temp_dir.name, "mp3")
        os.makedirs(self.mp3_folder)
        database_path = os.path.join(self.temp_dir.name, "test.db")
        self.app = create_app(config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database_path}",
            "MP3_FOLDER": self.mp3_folder,
            "COOKIES_PATH": os.path.join(self.temp_dir.name, "cookies.txt"),
        })
        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()
        self.temp_dir.cleanup()

    def test_simulated_search_download_converts_and_registers_song(self):
        service = self

        class FakeYoutubeDL:
            instances = []

            def __init__(self, options):
                self.options = options
                self.instances.append(self)

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def extract_info(self, query, download):
                service.assertEqual(query, "ytsearch1:Test Artist - Test Song")
                service.assertFalse(download)
                return {
                    "title": "Test Artist - Test Song",
                    "webpage_url": "https://youtube.example/watch?v=test",
                }

            def download(self, urls):
                service.assertEqual(
                    urls, ["https://youtube.example/watch?v=test"]
                )
                output_path = self.options["outtmpl"].replace("%(ext)s", "mp3")
                subprocess.run([
                    "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                    "-f", "lavfi", "-i", "sine=frequency=1000:duration=1",
                    "-b:a", "192k", "-y", output_path,
                ], check=True, capture_output=True)

        with self.app.app_context(), patch(
            "app.services.music_service.yt_dlp.YoutubeDL", FakeYoutubeDL
        ):
            result = MusicService.download_song(
                "Test Artist - Test Song", self.mp3_folder
            )
            filename = "Test Artist - Test Song.mp3"
            filepath = os.path.join(self.mp3_folder, filename)

            self.assertTrue(result["success"])
            self.assertTrue(os.path.isfile(filepath))
            self.assertEqual(MusicService.get_duration(filepath), "00:01")
            self.assertGreaterEqual(MP3(filepath).info.bitrate, 180_000)
            self.assertLessEqual(MP3(filepath).info.bitrate, 210_000)
            self.assertEqual(
                FakeYoutubeDL.instances[1].options["postprocessors"][0][
                    "preferredquality"
                ],
                "192",
            )

            song = Cancion.query.filter_by(filename=filename).one()
            home = Album.query.filter_by(nombre="Home").one()
            self.assertEqual(song.duracion, "00:01")
            self.assertTrue(
                AlbumCancion.query.filter_by(
                    album_id=home.id, cancion_id=song.id
                ).first()
            )

    def test_youtube_error_is_clear_and_partial_files_are_removed(self):
        class FailingYoutubeDL:
            def __init__(self, options):
                self.options = options

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def extract_info(self, _query, download):
                return {
                    "title": "Test Artist - Blocked Song",
                    "webpage_url": "https://youtube.example/watch?v=blocked",
                }

            def download(self, _urls):
                partial = self.options["outtmpl"].replace(
                    "%(ext)s", "webm.part"
                )
                with open(partial, "wb") as file:
                    file.write(b"incomplete")
                raise yt_dlp.utils.DownloadError(
                    "HTTP Error 403: Forbidden"
                )

        with self.app.app_context(), patch(
            "app.services.music_service.yt_dlp.YoutubeDL", FailingYoutubeDL
        ):
            with self.assertRaises(MusicDownloadError) as raised:
                MusicService.download_song("Blocked Song", self.mp3_folder)

        self.assertIn("YouTube rechazó la petición", str(raised.exception))
        self.assertEqual(os.listdir(self.mp3_folder), [])

    def test_yt_dlp_options_bound_network_wait_and_retries(self):
        with self.app.app_context():
            options = MusicService._yt_dlp_options()

        self.assertEqual(options["socket_timeout"], 30)
        self.assertEqual(options["retries"], 1)
        self.assertEqual(options["fragment_retries"], 1)
        self.assertNotIn("cookiefile", options)

    def test_missing_ffmpeg_is_reported_before_contacting_youtube(self):
        with patch("app.services.music_service.shutil.which", return_value=None):
            with self.assertRaises(MusicDownloadError) as raised:
                MusicService.check_media_tools()

        self.assertIn("ffmpeg, ffprobe", str(raised.exception))

    def test_extractor_errors_are_translated_for_the_api_layer(self):
        class FailingExtractor:
            def __init__(self, _options):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def extract_info(self, _query, download):
                self_test.assertFalse(download)
                raise yt_dlp.utils.ExtractorError(
                    "Signature extraction failed"
                )

        self_test = self
        with self.app.app_context(), patch(
            "app.services.music_service.yt_dlp.YoutubeDL", FailingExtractor
        ):
            with self.assertRaises(MusicDownloadError) as raised:
                MusicService.download_song("Unavailable", self.mp3_folder)

        self.assertIn("YouTube cambió", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
