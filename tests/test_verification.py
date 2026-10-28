import unittest
import os
import tempfile
from app import create_app
from app.models import db, Cancion, Album, AlbumCancion

class TestVerification(unittest.TestCase):
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
            
        # Create dummy mp3
        with open(os.path.join(self.mp3_folder, 'test.mp3'), 'wb') as f:
            f.write(b'dummy content')
            
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Create song
            c = Cancion(titulo="Test Song", artista="Test Artist", duracion="3:00", filename="test.mp3")
            db.session.add(c)
            
            # Create album
            a = Album(nombre="Test Album")
            db.session.add(a)
            db.session.commit()
            
            # Link
            link = AlbumCancion(album_id=a.id, cancion_id=c.id)
            db.session.add(link)
            db.session.commit()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()
        self.temp_dir.cleanup()

    def test_deletion_from_album(self):
        # Delete from "Test Album"
        # Should NOT delete file
        res = self.client.get('/eliminar?cancion=test.mp3&album=Test Album')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json['success'])
        
        # Check file exists
        self.assertTrue(os.path.exists(os.path.join(self.app.config['MP3_FOLDER'], 'test.mp3')))
        
        # Check link gone
        with self.app.app_context():
            c = Cancion.query.filter_by(filename="test.mp3").first()
            a = Album.query.filter_by(nombre="Test Album").first()
            link = AlbumCancion.query.filter_by(album_id=a.id, cancion_id=c.id).first()
            self.assertIsNone(link)
            self.assertIsNotNone(c)

    def test_deletion_from_home(self):
        # Delete from "Home"
        # Should delete file
        res = self.client.get('/eliminar?cancion=test.mp3&album=Home')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json['success'])
        
        # Check file gone
        self.assertFalse(os.path.exists(os.path.join(self.app.config['MP3_FOLDER'], 'test.mp3')))
        
        # Check song gone from DB
        with self.app.app_context():
            c = Cancion.query.filter_by(filename="test.mp3").first()
            self.assertIsNone(c)

    def test_stats_tracking(self):
        # Record play
        res = self.client.post('/api/record_play', json={'filename': 'test.mp3'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json['plays'], 1)
        
        # Check DB
        with self.app.app_context():
            c = Cancion.query.filter_by(filename="test.mp3").first()
            self.assertEqual(c.plays, 1)
            self.assertIsNotNone(c.last_played)

if __name__ == '__main__':
    unittest.main()
