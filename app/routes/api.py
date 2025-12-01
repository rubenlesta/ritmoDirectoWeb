from flask import Blueprint, jsonify, request, send_from_directory
from app.services.music_service import MusicService
from app.config import Config
import os

api_bp = Blueprint('api', __name__)

@api_bp.route("/lista_canciones")
def list_songs():
    songs = MusicService.get_all_songs()
    return jsonify({"canciones": songs})

@api_bp.route("/descargar")
def download():
    entry = request.args.get("entrada", "")
    if not entry:
        return jsonify({"success": False, "error": "Entrada vacía"})
    
    try:
        MusicService.download_song(entry, Config.MP3_FOLDER)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@api_bp.route("/reproducir")
def play():
    song = request.args.get("cancion", "")
    album = request.args.get("album", "")
    
    if song.lower().endswith(".mp3"):
        song = song[:-4]
        
    path = os.path.join(Config.MP3_FOLDER, f"{song}.mp3")
    if album and album != "Sin clasificar":
        path = os.path.join(Config.MP3_FOLDER, album, f"{song}.mp3")
        
    if os.path.exists(path):
        return send_from_directory(os.path.dirname(path), os.path.basename(path))
    
    return jsonify({"success": False, "error": "Archivo no encontrado"})
