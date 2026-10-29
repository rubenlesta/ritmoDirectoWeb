import os
import tempfile
import unittest

from app import create_app
from app.models import Album, AlbumCancion, Cancion, db
from scripts.init_db import migrate_legacy_schema


class TestDatabaseInitialization(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.app = create_app(config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": (
                f"sqlite:///{os.path.join(self.temp_dir.name, 'legacy.db')}"
            ),
            "MP3_FOLDER": os.path.join(self.temp_dir.name, "mp3"),
        })

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()
        self.temp_dir.cleanup()

    def test_legacy_sqlite_schema_is_migrated_without_losing_song_data(self):
        with self.app.app_context():
            with db.engine.begin() as connection:
                connection.exec_driver_sql(
                    "CREATE TABLE canciones ("
                    "id INTEGER PRIMARY KEY, nombre VARCHAR(255) NOT NULL, "
                    "artista VARCHAR(255), duracion VARCHAR(10))"
                )
                connection.exec_driver_sql(
                    "INSERT INTO canciones (id, nombre, artista, duracion) "
                    "VALUES "
                    "(1, 'Canción antigua', 'Artista', '3:12'), "
                    "(2, 'Canción antigua', 'Artista', '3:12')"
                )

            db.create_all()
            migrate_legacy_schema()
            migrate_legacy_schema()

            songs = Cancion.query.order_by(Cancion.id).all()
            song = songs[0]
            self.assertEqual(song.titulo, "Canción antigua")
            self.assertEqual(song.artista, "Artista")
            self.assertEqual(song.duracion, "3:12")
            self.assertEqual(song.filename, "Artista_-_Cancion_antigua.mp3")
            self.assertEqual(
                songs[1].filename, "Artista_-_Cancion_antigua-2.mp3"
            )
            self.assertEqual(song.plays, 0)
            self.assertIsNone(song.last_played)
            self.assertEqual(Album.query.count(), 0)
            self.assertEqual(AlbumCancion.query.count(), 0)


if __name__ == "__main__":
    unittest.main()
