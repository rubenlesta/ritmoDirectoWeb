from flask import Blueprint, jsonify, request, send_from_directory
from app.services.music_service import MusicService
from app.config import Config
from app.models import db, Album
import os
import random

api_bp = Blueprint('api', __name__)

@api_bp.route("/api/albumes")
def list_albums():
    # Sync first to ensure Home is up to date
    MusicService.sync_files()
    albums = [a.nombre for a in Album.query.all()]
    return jsonify({"albumes": albums})

@api_bp.route("/lista_canciones_album")
def list_songs_album():
    album = request.args.get("album", "Home")
    if album == "Sin clasificar": album = "Home"
    
    songs = MusicService.get_songs_by_album(album)
    return jsonify({"canciones": songs})

@api_bp.route("/lista_canciones_sin_album")
def list_songs_no_album():
    # Redirect to Home for now as "Sin clasificar" is deprecated by "Home"
    return list_songs_album()

@api_bp.route("/descargar")
def download():
    entry = request.args.get("entrada", "")
    if not entry:
        return jsonify({"success": False, "error": "Entrada vacía"})
    
    try:
        result = MusicService.download_song(entry, Config.MP3_FOLDER)
        return jsonify(result)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"success": False, "error": str(e)})

@api_bp.route("/reproducir")
def play():
    filename = request.args.get("cancion", "")
    # If passed as "Artist - Title", we need to ensure it matches filename
    # But frontend now sends filename or we can look it up
    
    if not filename.endswith(".mp3"):
        filename += ".mp3"
        
    path = os.path.join(Config.MP3_FOLDER, filename)
    
    if os.path.exists(path):
        return send_from_directory(Config.MP3_FOLDER, filename)
    
    return jsonify({"success": False, "error": "Archivo no encontrado"})

@api_bp.route("/crear_album", methods=["POST"])
def create_album():
    data = request.get_json()
    nombre = data.get("nombre")
    if not nombre:
        return jsonify({"success": False, "error": "Nombre vacío"})
        
    if Album.query.filter_by(nombre=nombre).first():
        return jsonify({"success": False, "error": "El álbum ya existe"})
        
    album = Album(nombre=nombre)
    db.session.add(album)
    db.session.commit()
    return jsonify({"success": True})

@api_bp.route("/eliminar")
def delete_song():
    filename = request.args.get("cancion", "")
    # Implement delete logic if needed (remove from DB and FS)
    # For now, just FS
    if not filename.endswith(".mp3"):
        filename += ".mp3"
        
    path = os.path.join(Config.MP3_FOLDER, filename)
    if os.path.exists(path):
        os.remove(path)
        # Also remove from DB (Sync will handle it or we do it explicitly)
        # Explicit is better
        from app.models import Cancion
        c = Cancion.query.filter_by(filename=filename).first()
        if c:
            db.session.delete(c)
            db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "No encontrado"})

@api_bp.route("/api/agregar_a_album", methods=["POST"])
def add_to_album():
    data = request.get_json()
    filename = data.get("cancion")
    album_nombre = data.get("album")
    
    if not filename or not album_nombre:
        return jsonify({"success": False, "error": "Datos incompletos"})
        
    from app.models import Cancion, Album, AlbumCancion
    
    cancion = Cancion.query.filter_by(filename=filename).first()
    album = Album.query.filter_by(nombre=album_nombre).first()
    
    if not cancion:
        return jsonify({"success": False, "error": "Canción no encontrada"})
    if not album:
        return jsonify({"success": False, "error": "Álbum no encontrado"})
        
    # Check if already exists
    exists = AlbumCancion.query.filter_by(album_id=album.id, cancion_id=cancion.id).first()
    if exists:
        return jsonify({"success": False, "error": "La canción ya está en el álbum"})
        
    link = AlbumCancion(album_id=album.id, cancion_id=cancion.id)
    db.session.add(link)
    db.session.commit()
    
    return jsonify({"success": True})
