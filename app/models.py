from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    theme_color = db.Column(db.String(50), default="default")
    
    albums = db.relationship("Album", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Cancion(db.Model):
    __tablename__ = 'canciones'
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(255), nullable=False) 
    artista = db.Column(db.String(255))
    duracion = db.Column(db.String(10))
    filename = db.Column(db.String(255), unique=True, nullable=False) 
    plays = db.Column(db.Integer, default=0)
    last_played = db.Column(db.DateTime, nullable=True)

    albumes = db.relationship("AlbumCancion", back_populates="cancion", cascade="all, delete-orphan")

class Album(db.Model):
    __tablename__ = 'albumes'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False) # Removed unique=True because multiple users can have "Favorites"
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False) # Albums belong to a user

    user = db.relationship("User", back_populates="albums")
    canciones = db.relationship("AlbumCancion", back_populates="album", cascade="all, delete-orphan")
    
    __table_args__ = (
        db.UniqueConstraint("user_id", "nombre", name="uix_user_album_name"), # Unique per user
    )

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
