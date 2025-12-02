import unittest
import os
import shutil
from app import create_app
from app.models import db, Cancion, Album, AlbumCancion
from app.config import Config
from stats_app import app as stats_app

class TestVerification(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app.config['MP3_FOLDER'] = 'tests/mp3_test'
        
        self.stats_client = stats_app.test_client()
        
        # Setup test MP3 folder
        if not os.path.exists(self.app.config['MP3_FOLDER']):
            os.makedirs(self.app.config['MP3_FOLDER'])
            
        # Create dummy mp3
        with open(os.path.join(self.app.config['MP3_FOLDER'], 'test.mp3'), 'w') as f:
            f.write('dummy content')
            
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
        if os.path.exists(self.app.config['MP3_FOLDER']):
            shutil.rmtree(self.app.config['MP3_FOLDER'])
        with self.app.app_context():
            db.drop_all()

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
