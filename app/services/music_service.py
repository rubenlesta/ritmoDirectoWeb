import os
import re
import yt_dlp
from mutagen.mp3 import MP3
from flask import current_app
from app.config import Config
from app.models import db, Cancion, Album, AlbumCancion

class MusicService:
    @staticmethod
    def clean_filename(text):
        # Remove content in parentheses
        text = re.sub(r'\([^)]*\)', '', text)
        # Remove content in brackets
        text = re.sub(r'\[[^]]*\]', '', text)
        
        # Remove 'ft.' or 'feat.' and everything after (case insensitive)
        # Matches " ft " or " feat " or " ft." or " feat." followed by anything
        text = re.sub(r'\s+(ft\.?|feat\.?|featuring).*$', '', text, flags=re.IGNORECASE)
        
        # Remove extra spaces
        text = " ".join(text.split())
        return text

    @staticmethod
    def get_duration(path):
        try:
            audio = MP3(path)
            duracion_seg = int(audio.info.length)
            minutos = duracion_seg // 60
            segundos = duracion_seg % 60
            return f"{minutos:02}:{segundos:02}"
        except Exception:
            return "??:??"

    @staticmethod
    def ensure_home_album():
        home = Album.query.filter_by(nombre="Home").first()
        if not home:
            try:
                home = Album(nombre="Home")
                db.session.add(home)
                db.session.commit()
            except Exception:
                db.session.rollback()
                home = Album.query.filter_by(nombre="Home").first()
        return home

    @staticmethod
    def add_song_to_db(filename, artist, title, duration):
        # Ensure Home album exists
        home = MusicService.ensure_home_album()
        
        cancion = Cancion.query.filter_by(filename=filename).first()
        if not cancion:
            cancion = Cancion(titulo=title, artista=artist, duracion=duration, filename=filename)
            db.session.add(cancion)
            db.session.commit()
        
        # Link to Home if not already linked
        link = AlbumCancion.query.filter_by(album_id=home.id, cancion_id=cancion.id).first()
        if not link:
            link = AlbumCancion(album_id=home.id, cancion_id=cancion.id)
            db.session.add(link)
            db.session.commit()
            
        return cancion

    @staticmethod
    def download_song(entry, output_folder):
        os.makedirs(output_folder, exist_ok=True)
        
        # 1. Get Info first to clean name
        ydl_opts_info = {
            'quiet': True,
            'cookiefile': current_app.config['COOKIES_PATH'],
            'noplaylist': True,
        }
        
        search_query = entry if entry.startswith("http") else f"ytsearch1:{entry}"
        
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            try:
                info = ydl.extract_info(search_query, download=False)
                if 'entries' in info:
                    info = info['entries'][0]
            except Exception as e:
                raise Exception(f"Error fetching info: {e}")

        original_title = info.get('title', 'Unknown')
        clean_title = MusicService.clean_filename(original_title)
        
        # Split artist - title if present
        if " - " in clean_title:
            artist, title = clean_title.split(" - ", 1)
        else:
            artist, title = "Desconocido", clean_title
            
        filename = f"{artist} - {title}.mp3"
        filepath = os.path.join(output_folder, filename)
        
        # 2. Check if exists (MP3)
        if os.path.exists(filepath):
            # Ensure it's in DB
            duration = MusicService.get_duration(filepath)
            MusicService.add_song_to_db(filename, artist, title, duration)
            return {"success": True, "message": "La canción ya existe", "exists": True}

        # 3. Download
        ydl_opts = {
            'format': 'bestaudio/best',
            'cookiefile': current_app.config['COOKIES_PATH'],
            'noplaylist': True,
            'quiet': False,
            # Force filename to be exactly what we want
            'outtmpl': os.path.join(output_folder, f"{artist} - {title}.%(ext)s"),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            # Ensure we don't keep the video file
            'keepvideo': False,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([info['webpage_url']])
            
        # 4. Verify MP3 exists (conversion might have failed or named differently)
        if not os.path.exists(filepath):
             # Try to find if it saved as something else and rename/convert?
             # For now, just warn or try to find partial match?
             # But with outtmpl it should be close.
             pass

        # 5. Add to DB
        if os.path.exists(filepath):
            duration = MusicService.get_duration(filepath)
            MusicService.add_song_to_db(filename, artist, title, duration)
            return {"success": True, "message": "Descarga completada", "exists": False}
        else:
             return {"success": False, "error": "Error en la conversión a MP3"}

    @staticmethod
    def get_songs_by_album(album_name):
        album = Album.query.filter_by(nombre=album_name).first()
        if not album:
            return []
        
        songs = []
        for ac in album.canciones:
            c = ac.cancion
            songs.append({
                "id": c.id,
                "titulo": c.titulo,
                "artista": c.artista,
                "duracion": c.duracion,
                "filename": c.filename
            })
        return songs

    @staticmethod
    def sync_files():
        """Scans mp3 folder and adds missing files to DB/Home"""
        try:
            home = MusicService.ensure_home_album()
            mp3_folder = current_app.config['MP3_FOLDER']
            
            if not os.path.exists(mp3_folder):
                print(f"MP3 folder not found: {mp3_folder}")
                return

            for filename in os.listdir(mp3_folder):
                if filename.endswith(".mp3"):
                    # Try to parse Artist - Title from filename
                    name_without_ext = filename[:-4]
                    if " - " in name_without_ext:
                        artist, title = name_without_ext.split(" - ", 1)
                    else:
                        artist, title = "Desconocido", name_without_ext
                    
                    path = os.path.join(mp3_folder, filename)
                    duration = MusicService.get_duration(path)
                    MusicService.add_song_to_db(filename, artist, title, duration)
        except Exception as e:
            print(f"Error syncing files: {e}")
