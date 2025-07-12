from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Cancion(db.Model):
    __tablename__ = 'canciones'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String, nullable=False)
    artista = db.Column(db.String)
    duracion = db.Column(db.String)
    ruta = db.Column(db.String, nullable=False)

class Album(db.Model):
    __tablename__ = 'albumes'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String, unique=True, nullable=False)

class AlbumCancion(db.Model):
    __tablename__ = 'album_canciones'
    id = db.Column(db.Integer, primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('albumes.id'), nullable=False)
    cancion_id = db.Column(db.Integer, db.ForeignKey('canciones.id'), nullable=False)
