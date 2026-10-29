import os
import tempfile
import unittest

from app import create_app
from app.models import Album, AlbumCancion, Cancion, db
from app.services.music_service import MusicDownloadError
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
        self.assertIn(b'apple-mobile-web-app-capable', response.data)
        self.assertIn(b'user-scalable=no', response.data)

    def test_service_worker_is_available_at_root_scope(self):
        response = self.client.get('/sw.js')

        self.assertEqual(response.status_code, 200)
        self.assertIn('javascript', response.mimetype)
        self.assertEqual(response.headers['Service-Worker-Allowed'], '/')
        self.assertIn(b'addEventListener("fetch"', response.data)
        response.close()

    def test_list_albums(self):
        response = self.client.get('/api/albumes')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json['albumes']), {'Home', 'Test Album'})

    def test_empty_or_missing_mp3_folder_returns_home_and_empty_song_list(self):
        os.remove(os.path.join(self.mp3_folder, 'Artist - Test Song.mp3'))
        os.rmdir(self.mp3_folder)

        albums_response = self.client.get('/api/albumes')
        songs_response = self.client.get(
            '/lista_canciones_album?album=Home'
        )

        self.assertEqual(albums_response.status_code, 200)
        self.assertIn('Home', albums_response.json['albumes'])
        self.assertTrue(os.path.isdir(self.mp3_folder))
        self.assertEqual(songs_response.status_code, 200)
        self.assertEqual(songs_response.json['canciones'][0]['filename'],
                         'Artist - Test Song.mp3')

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

    def test_download_errors_are_returned_as_clear_json(self):
        from unittest.mock import patch

        with patch(
            'app.routes.api.MusicService.download_song',
            side_effect=MusicDownloadError(
                'YouTube rechazó la petición o requiere una verificación anti-bot.'
            ),
        ):
            response = self.client.get('/descargar?entrada=Test%20Song')

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json['success'], False)
        self.assertIn('YouTube rechazó', response.json['error'])
