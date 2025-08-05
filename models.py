from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Cancion(db.Model):
    __tablename__ = 'canciones'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False, unique=True)  # nombre de archivo sin .mp3
    artista = db.Column(db.String(255))
    duracion = db.Column(db.String(10))

    albumes = db.relationship("AlbumCancion", back_populates="cancion")

class Album(db.Model):
    __tablename__ = 'albumes'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False, unique=True)

    canciones = db.relationship("AlbumCancion", back_populates="album")

class AlbumCancion(db.Model):
    __tablename__ = 'album_cancion'
    id = db.Column(db.Integer, primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey("albumes.id"))
    cancion_id = db.Column(db.Integer, db.ForeignKey("canciones.id"))

    album = db.relationship("Album", back_populates="canciones")
    cancion = db.relationship("Cancion", back_populates="albumes")

    __table_args__ = (
        db.UniqueConstraint("album_id", "cancion_id", name="uix_album_cancion"),
    )
