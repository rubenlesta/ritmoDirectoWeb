from flask import Blueprint, jsonify, request, send_from_directory, current_app
from flask_login import login_required, current_user
from app.services.music_service import MusicService
from app.config import Config
from app.models import db, Album
import os

api_bp = Blueprint('api', __name__)

@api_bp.route("/api/albumes")
@login_required
def list_albums():
    # Sync first to ensure Home is up to date (sync might need to be smarter or scheduled)
    # MusicService.sync_files() # Sync might add to random user or need current_user. Disabling auto-sync on list for perf.
    
    albums = [a.nombre for a in Album.query.filter_by(user_id=current_user.id).all()]
    return jsonify({"albumes": albums})

@api_bp.route("/lista_canciones_album")
@login_required
def list_songs_album():
    album = request.args.get("album", "Home")
    if album == "Sin clasificar": album = "Home"
    
    songs = MusicService.get_songs_by_album(album, current_user)
    return jsonify({"canciones": songs})

@api_bp.route("/lista_canciones_sin_album")
@login_required
def list_songs_no_album():
    # Redirect to Home for now as "Sin clasificar" is deprecated by "Home"
    return list_songs_album()

@api_bp.route("/descargar")
@login_required
def download():
    entry = request.args.get("entrada", "")
    if not entry:
        return jsonify({"success": False, "error": "Entrada vacía"})
    
    try:
        # TODO: This should be async for loading bar!
        # For now, we do sync but returns error if > 4 mins
        result = MusicService.download_song(entry, current_app.config['MP3_FOLDER'], current_user)
        return jsonify(result)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"success": False, "error": str(e)})

@api_bp.route("/reproducir")
# No login required for playing? Or yes? Let's say yes for private access.
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
@login_required
def create_album():
    data = request.get_json()
    nombre = data.get("nombre")
    if not nombre:
        return jsonify({"success": False, "error": "Nombre vacío"})
        
    if Album.query.filter_by(nombre=nombre, user_id=current_user.id).first():
        return jsonify({"success": False, "error": "El álbum ya existe"})
        
    album = Album(nombre=nombre, user_id=current_user.id)
    db.session.add(album)
    db.session.commit()
    return jsonify({"success": True})

@api_bp.route("/eliminar")
@login_required
def delete_song():
    filename = request.args.get("cancion", "")
    album_nombre = request.args.get("album", "Home")
    
    if not filename.endswith(".mp3"):
        filename += ".mp3"
        
    from app.models import Cancion, Album, AlbumCancion
    cancion = Cancion.query.filter_by(filename=filename).first()
    
    if not cancion:
        return jsonify({"success": False, "error": "Canción no encontrada"})

    # Check if album belongs to user
    album = Album.query.filter_by(nombre=album_nombre, user_id=current_user.id).first()
    if not album:
         return jsonify({"success": False, "error": "Álbum no encontrado"})

    if album_nombre == "Home" or album_nombre == "Sin clasificar":
        # Unlink from Home. 
        # Only delete FILE if NO OTHER USER has it? 
        # Requirements say: "If User A downloads... User B links...".
        # So "Deletion" from Home should just be "Unlink from my Home".
        # Real file deletion only if NO links exist at all? Or admin only?
        # User requested "not having to download again".
        # Let's unlink from User's Home. 
        
        link = AlbumCancion.query.filter_by(album_id=album.id, cancion_id=cancion.id).first()
        if link:
            db.session.delete(link)
            db.session.commit()
        
        # Optional: Garbage collection (if no links, delete file). 
        # But maybe we keep it for cache? Let's keep it simple for now.    
        return jsonify({"success": True, "message": "Eliminada de tu colección"})
    else:
        # Remove only from specific album
        link = AlbumCancion.query.filter_by(album_id=album.id, cancion_id=cancion.id).first()
        if link:
            db.session.delete(link)
            db.session.commit()
            return jsonify({"success": True, "message": f"Eliminada del álbum {album_nombre}"})
        else:
            return jsonify({"success": False, "error": "No está en este álbum"})

@api_bp.route("/api/record_play", methods=["POST"])
# Info: this might not need auth if we track global plays, but let's encourage auth.
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
@login_required
def add_to_album():
    data = request.get_json()
    filename = data.get("cancion")
    album_nombre = data.get("album")
    
    if not filename or not album_nombre:
        return jsonify({"success": False, "error": "Datos incompletos"})
        
    from app.models import Cancion, Album, AlbumCancion
    
    cancion = Cancion.query.filter_by(filename=filename).first()
    album = Album.query.filter_by(nombre=album_nombre, user_id=current_user.id).first()
    
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

@api_bp.route("/api/upload", methods=["POST"])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file part"})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No selected file"})
        
    if file and file.filename.endswith('.mp3'):
        from werkzeug.utils import secure_filename
        filename = secure_filename(file.filename)
        path = os.path.join(current_app.config['MP3_FOLDER'], filename)
        file.save(path)
        
        # Sync to ensure it's in DB
        # Optimization: Just add this specific file
        duration = MusicService.get_duration(path)
        # Parse artist - title if possible
        clean_name = filename[:-4]
        if " - " in clean_name:
            artist, title = clean_name.split(" - ", 1)
        else:
            artist, title = "Desconocido", clean_name
            
        MusicService.add_song_to_db(filename, artist, title, duration, current_user)
        
        return jsonify({"success": True, "message": "File uploaded successfully"})
        
    return jsonify({"success": False, "error": "Invalid file type (MP3 only)"})

@api_bp.route("/api/batch/delete", methods=["POST"])
@login_required
def batch_delete():
    data = request.get_json()
    filenames = data.get("filenames", [])
    album_nombre = data.get("album", "Home")
    
    if not filenames:
        return jsonify({"success": False, "error": "No songs selected"})
        
    from app.models import Cancion, Album, AlbumCancion
    
    deleted_count = 0
    
    # Always scope to user
    album = Album.query.filter_by(nombre=album_nombre, user_id=current_user.id).first()
    if not album:
         return jsonify({"success": False, "error": "Album not found"})

    for filename in filenames:
         cancion = Cancion.query.filter_by(filename=filename).first()
         if cancion:
             link = AlbumCancion.query.filter_by(album_id=album.id, cancion_id=cancion.id).first()
             if link:
                 db.session.delete(link)
                 deleted_count += 1
                 
    db.session.commit()
    return jsonify({"success": True, "message": f"Eliminadas {deleted_count} canciones de {album_nombre}"})

@api_bp.route("/api/batch/add_to_album", methods=["POST"])
@login_required
def batch_add_to_album():
    data = request.get_json()
    filenames = data.get("filenames", [])
    album_nombre = data.get("album")
    
    if not filenames or not album_nombre:
        return jsonify({"success": False, "error": "Missing data"})
        
    from app.models import Cancion, Album, AlbumCancion
    
    album = Album.query.filter_by(nombre=album_nombre, user_id=current_user.id).first()
    if not album:
        return jsonify({"success": False, "error": "Album not found"})
        
    added_count = 0
    for filename in filenames:
        cancion = Cancion.query.filter_by(filename=filename).first()
        if cancion:
            exists = AlbumCancion.query.filter_by(album_id=album.id, cancion_id=cancion.id).first()
            if not exists:
                link = AlbumCancion(album_id=album.id, cancion_id=cancion.id)
                db.session.add(link)
                added_count += 1
                
    db.session.commit()
    return jsonify({"success": True, "message": f"Añadidas {added_count} canciones a {album_nombre}"})
