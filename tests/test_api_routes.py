import os
import tempfile
import unittest

from app import create_app
from app.models import Album, AlbumCancion, Cancion, db
from scripts.stats_app import create_stats_app


class TestApiRoutes(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.mp3_folder = os.path.join(self.temp_dir.name, 'mp3')
        os.makedirs(self.mp3_folder)
        database_path = os.path.join(self.temp_dir.name, 'test.db')
        database_uri = f"sqlite:///{database_path}"

        self.app = create_app(config_overrides={
            'TESTING': True,
            'SQLALCHEMY_DATABASE_URI': database_uri,
            'MP3_FOLDER': self.mp3_folder,
        })
        self.client = self.app.test_client()

        self.stats_app = create_stats_app({
            'TESTING': True,
            'SQLALCHEMY_DATABASE_URI': database_uri,
        })
        self.stats_client = self.stats_app.test_client()

        with open(os.path.join(self.mp3_folder, 'Artist - Test Song.mp3'), 'wb') as audio_file:
            audio_file.write(b'test mp3 data')

        with self.app.app_context():
            db.create_all()
            home = Album(nombre='Home')
            album = Album(nombre='Test Album')
            song = Cancion(
                titulo='Test Song',
                artista='Artist',
                duracion='3:00',
                filename='Artist - Test Song.mp3',
                plays=2,
            )
            db.session.add_all([home, album, song])
            db.session.flush()
            db.session.add_all([
                AlbumCancion(album_id=home.id, cancion_id=song.id),
                AlbumCancion(album_id=album.id, cancion_id=song.id),
            ])
            db.session.commit()

    def tearDown(self):
        with self.stats_app.app_context():
            db.session.remove()
            db.engine.dispose()
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()
        self.temp_dir.cleanup()

    def test_homepage_renders(self):
        response = self.client.get('/')

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Ritmo Directo', response.data)

    def test_list_albums(self):
        response = self.client.get('/api/albumes')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json['albumes']), {'Home', 'Test Album'})

    def test_list_songs_by_album(self):
        response = self.client.get('/lista_canciones_album?album=Test%20Album')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['canciones'], [{
            'id': 1,
            'titulo': 'Test Song',
            'artista': 'Artist',
            'duracion': '3:00',
            'filename': 'Artist - Test Song.mp3',
        }])

    def test_playback_serves_mp3_file(self):
        response = self.client.get('/reproducir?cancion=Artist%20-%20Test%20Song.mp3')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, b'test mp3 data')
        self.assertEqual(response.mimetype, 'audio/mpeg')
        response.close()

    def test_stats_endpoint_returns_song_artist_and_listen_time(self):
        page_response = self.stats_client.get('/')
        self.assertEqual(page_response.status_code, 200)
        self.assertIn(b'Mis Estad', page_response.data)

        response = self.stats_client.get('/api/stats')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['top_songs'][0], {
            'title': 'Test Song',
            'artist': 'Artist',
            'plays': 2,
        })
        self.assertEqual(response.json['top_artists'], [{
            'artist': 'Artist',
            'plays': 2,
        }])
        self.assertEqual(response.json['total_minutes'], 6)
