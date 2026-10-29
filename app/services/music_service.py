import os
import re
import shutil
import yt_dlp
from mutagen.mp3 import MP3
from flask import current_app
from app.models import db, Cancion, Album, AlbumCancion


class MusicDownloadError(Exception):
    status_code = 502


class MediaToolsUnavailable(MusicDownloadError):
    status_code = 503


class MusicService:
    DOWNLOAD_RETRIES = 1
    DOWNLOAD_ARTIFACT_EXTENSIONS = (
        ".part", ".webm", ".m4a", ".opus", ".wav", ".mp4", ".mp3",
    )

    @staticmethod
    def check_media_tools():
        missing = [
            tool for tool in ("ffmpeg", "ffprobe")
            if shutil.which(tool) is None
        ]
        if missing:
            raise MediaToolsUnavailable(
                f"No se encontraron {', '.join(missing)} en PATH. "
                "Instala FFmpeg y FFprobe antes de descargar canciones."
            )

    @staticmethod
    def _yt_dlp_options():
        options = {
            "quiet": True,
            "noplaylist": True,
            "socket_timeout": current_app.config["DOWNLOAD_SOCKET_TIMEOUT"],
            "js_runtimes": {"node": {}},
            "retries": MusicService.DOWNLOAD_RETRIES,
            "fragment_retries": MusicService.DOWNLOAD_RETRIES,
            "extractor_retries": MusicService.DOWNLOAD_RETRIES,
        }
        cookies_path = current_app.config["COOKIES_PATH"]
        if os.path.isfile(cookies_path):
            options["cookiefile"] = cookies_path
        return options

    @staticmethod
    def _download_error_message(error):
        detail = str(error)
        normalized = detail.lower()
        if any(term in normalized for term in (
            "403", "forbidden", "sign in to confirm", "bot", "captcha",
            "challenge",
        )):
            return (
                "YouTube rechazó la petición o requiere una verificación "
                "anti-bot. Comprueba el acceso y las cookies configuradas."
            )
        if any(term in normalized for term in (
            "signature", "nsig", "unable to extract", "javascript",
        )):
            return (
                "YouTube cambió su mecanismo de extracción. Actualiza yt-dlp "
                "y vuelve a intentarlo."
            )
        if isinstance(error, TimeoutError) or "timed out" in normalized or "timeout" in normalized:
            return (
                "La descarga superó el tiempo de espera de red. "
                "Vuelve a intentarlo."
            )
        if any(term in normalized for term in ("ffmpeg", "ffprobe", "postprocess")):
            return f"Falló la conversión del audio con FFmpeg: {detail[:500]}"
        return f"yt-dlp no pudo completar la descarga: {detail[:500]}"

    @staticmethod
    def _cleanup_download_artifacts(output_folder, filename_stem, include_mp3=False):
        extensions = MusicService.DOWNLOAD_ARTIFACT_EXTENSIONS
        if not include_mp3:
            extensions = tuple(ext for ext in extensions if ext != ".mp3")

        for extension in extensions:
            for suffix in (extension, f"{extension}.part"):
                artifact = os.path.join(output_folder, filename_stem + suffix)
                try:
                    os.remove(artifact)
                except FileNotFoundError:
                    pass
                except OSError as error:
                    current_app.logger.warning(
                        "No se pudo limpiar el archivo temporal %s: %s",
                        artifact,
                        error,
                    )

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
            home = Album(nombre="Home")
            db.session.add(home)
            db.session.commit()
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
        MusicService.check_media_tools()
        os.makedirs(output_folder, exist_ok=True)
        
        ydl_opts_info = MusicService._yt_dlp_options()
        search_query = entry if entry.startswith("http") else f"ytsearch1:{entry}"
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
                info = ydl.extract_info(search_query, download=False)
                if not info:
                    raise MusicDownloadError(
                        "YouTube no devolvió información para la búsqueda."
                    )
                if "entries" in info:
                    entries = info.get("entries") or []
                    info = entries[0] if entries else None
                if not info:
                    raise MusicDownloadError(
                        "No se encontraron canciones para esa búsqueda."
                    )
        except MusicDownloadError:
            raise
        except (yt_dlp.utils.YoutubeDLError, TimeoutError, OSError) as error:
            raise MusicDownloadError(
                MusicService._download_error_message(error)
            ) from error

        original_title = info.get('title', 'Unknown')
        webpage_url = info.get("webpage_url")
        if not webpage_url:
            raise MusicDownloadError(
                "YouTube no devolvió una URL válida para la canción."
            )
        clean_title = MusicService.clean_filename(original_title)
        
        # Split artist - title if present
        if " - " in clean_title:
            artist, title = clean_title.split(" - ", 1)
        else:
            artist, title = "Desconocido", clean_title
            
        filename = f"{artist} - {title}.mp3"
        filepath = os.path.join(output_folder, filename)
        filename_stem = filename[:-4]
        
        if os.path.exists(filepath):
            duration = MusicService.get_duration(filepath)
            if duration == "??:??":
                raise MusicDownloadError(
                    "El MP3 ya existente no tiene una duración legible."
                )
            MusicService.add_song_to_db(filename, artist, title, duration)
            MusicService._cleanup_download_artifacts(
                output_folder, filename_stem
            )
            return {"success": True, "message": "La canción ya existe", "exists": True}

        ydl_opts = MusicService._yt_dlp_options()
        ydl_opts.update({
            'format': 'bestaudio/best',
            'quiet': False,
            'outtmpl': os.path.join(output_folder, f"{artist} - {title}.%(ext)s"),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'keepvideo': False,
        })

        conversion_complete = False
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([webpage_url])

            if not os.path.isfile(filepath):
                raise MusicDownloadError(
                    "La descarga terminó, pero no se generó el archivo MP3."
                )
            duration = MusicService.get_duration(filepath)
            if duration == "??:??":
                raise MusicDownloadError(
                    "Mutagen no pudo leer la duración del MP3 descargado."
                )
            conversion_complete = True
            MusicService.add_song_to_db(filename, artist, title, duration)
            return {"success": True, "message": "Descarga completada", "exists": False}
        except MusicDownloadError:
            raise
        except (yt_dlp.utils.YoutubeDLError, TimeoutError, OSError) as error:
            raise MusicDownloadError(
                MusicService._download_error_message(error)
            ) from error
        finally:
            MusicService._cleanup_download_artifacts(
                output_folder,
                filename_stem,
                include_mp3=not conversion_complete,
            )

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
        """Adds available MP3 files to the database and Home album."""
        mp3_folder = current_app.config["MP3_FOLDER"]
        if os.path.exists(mp3_folder) and not os.path.isdir(mp3_folder):
            current_app.logger.warning(
                "La ruta de MP3 no es un directorio: %s", mp3_folder
            )
            return

        os.makedirs(mp3_folder, exist_ok=True)
        MusicService.ensure_home_album()

        for filename in os.listdir(mp3_folder):
            if not filename.lower().endswith(".mp3"):
                continue

            name_without_ext = filename[:-4]
            if " - " in name_without_ext:
                artist, title = name_without_ext.split(" - ", 1)
            else:
                artist, title = "Desconocido", name_without_ext

            path = os.path.join(mp3_folder, filename)
            if not os.path.isfile(path):
                continue
            duration = MusicService.get_duration(path)
            MusicService.add_song_to_db(filename, artist, title, duration)
