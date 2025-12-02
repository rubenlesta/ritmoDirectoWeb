from flask import Blueprint, jsonify, request, send_from_directory, current_app
from app.services.music_service import MusicService
from app.config import Config
from app.models import db, Album
import os

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
        result = MusicService.download_song(entry, current_app.config['MP3_FOLDER'])
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
        
    path = os.path.join(current_app.config['MP3_FOLDER'], filename)
    
    if os.path.exists(path):
        return send_from_directory(current_app.config['MP3_FOLDER'], filename)
    
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
    album_nombre = request.args.get("album", "Home")
    
    if not filename.endswith(".mp3"):
        filename += ".mp3"
        
    from app.models import Cancion, Album, AlbumCancion
    cancion = Cancion.query.filter_by(filename=filename).first()
    
    if not cancion:
        return jsonify({"success": False, "error": "Canción no encontrada"})

    if album_nombre == "Home" or album_nombre == "Sin clasificar":
        # Delete from FS and DB (Cascades should handle links)
        path = os.path.join(current_app.config['MP3_FOLDER'], filename)
        if os.path.exists(path):
            os.remove(path)
        
        db.session.delete(cancion)
        db.session.commit()
        return jsonify({"success": True, "message": "Canción eliminada definitivamente"})
    else:
        # Remove only from specific album
        album = Album.query.filter_by(nombre=album_nombre).first()
        if album:
            link = AlbumCancion.query.filter_by(album_id=album.id, cancion_id=cancion.id).first()
            if link:
                db.session.delete(link)
                db.session.commit()
                return jsonify({"success": True, "message": f"Eliminada del álbum {album_nombre}"})
            else:
                return jsonify({"success": False, "error": "No está en este álbum"})
        else:
            return jsonify({"success": False, "error": "Álbum no encontrado"})

@api_bp.route("/api/record_play", methods=["POST"])
def record_play():
    data = request.get_json()
    filename = data.get("filename")
    
    if not filename:
        return jsonify({"success": False, "error": "Filename required"})
        
    from app.models import Cancion
    from datetime import datetime
    
    cancion = Cancion.query.filter_by(filename=filename).first()
    if cancion:
        cancion.plays += 1
        cancion.last_played = datetime.now()
        db.session.commit()
        return jsonify({"success": True, "plays": cancion.plays})
    
    return jsonify({"success": False, "error": "Song not found"})

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
