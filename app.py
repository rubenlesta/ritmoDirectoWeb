from config import MP3_FOLDER, SQLALCHEMY_DATABASE_URI

from flask import Flask, jsonify, request, render_template, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from models import db, Cancion, Album, AlbumCancion
from mutagen.mp3 import MP3
from werkzeug.utils import secure_filename
import tempfile
import convertidor
import os

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

from routes.albums import albums_bp
app.register_blueprint(albums_bp)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
mp3_folder = MP3_FOLDER
os.makedirs(mp3_folder, exist_ok=True)

@app.route("/")
def index():
    return render_template("index.html")  # Página principal

@app.route("/descargar")
def descargar():
    entrada = request.args.get("entrada", "")
    if not entrada:
        return jsonify({"success": False, "error": "Entrada vacía"})

    try:
        convertidor.descargar(entrada, mp3_folder)
        return jsonify({"success": True})
    except Exception as e:
        print("Error en descarga:", e)
        return jsonify({"success": False, "error": str(e)})

def obtener_duracion(ruta):
    try:
        audio = MP3(ruta)
        duracion_seg = int(audio.info.length)
        minutos = duracion_seg // 60
        segundos = duracion_seg % 60
        return f"{minutos:02}:{segundos:02}"
    except Exception:
        return "??:??"

@app.route("/lista_canciones")
def lista_canciones():
    canciones = []
    for archivo in os.listdir(mp3_folder):
        ruta = os.path.join(mp3_folder, archivo)
        if archivo.endswith(".mp3") and os.path.isfile(ruta):
            nombre_cancion = archivo[:-4]  # Quitar extensión .mp3

            duracion_formateada = obtener_duracion(ruta)

            if " - " in nombre_cancion:
                artista, cancion = nombre_cancion.split(" - ", 1)
            else:
                artista, cancion = "Desconocido", nombre_cancion

            canciones.append({
                "artista": artista,
                "cancion": cancion,
                "duracion": duracion_formateada
            })

    return jsonify({"canciones": canciones})

@app.route("/reproducir")
def reproducir():
    cancion = request.args.get("cancion", "")
    album = request.args.get("album", "")

    # Eliminar extensión .mp3 si existe
    if cancion.lower().endswith(".mp3"):
        cancion = cancion[:-4]

    if album and album != "Sin clasificar":
        ruta_album = os.path.join(mp3_folder, album)
        archivo = os.path.join(ruta_album, f"{cancion}.mp3")
        if os.path.exists(archivo):
            return send_from_directory(ruta_album, f"{cancion}.mp3")
    else:
        archivo = os.path.join(mp3_folder, f"{cancion}.mp3")
        if os.path.exists(archivo):
            return send_from_directory(mp3_folder, f"{cancion}.mp3")

    return jsonify({"success": False, "error": "Archivo no encontrado"})

@app.route("/eliminar")
def eliminar():
    cancion = request.args.get("cancion", "")
    if not cancion:
        return jsonify({"success": False, "error": "No se especificó la canción"})

    # Quitar extensión .mp3 si viene incluida
    if cancion.lower().endswith(".mp3"):
        cancion = cancion[:-4]

    archivo = os.path.join(mp3_folder, f"{cancion}.mp3")

    try:
        if os.path.exists(archivo):
            os.remove(archivo)

            # También eliminar de la base de datos
            cancion_db = Cancion.query.filter_by(nombre=cancion).first()
            if cancion_db:
                # Eliminar relaciones con álbumes primero
                AlbumCancion.query.filter_by(cancion_id=cancion_db.id).delete()

                db.session.delete(cancion_db)
                db.session.commit()

            return jsonify({"success": True})

        else:
            return jsonify({"success": False, "error": "Archivo no encontrado"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/albumes")
def albumes():
    carpetas = [nombre for nombre in os.listdir(mp3_folder)
                if os.path.isdir(os.path.join(mp3_folder, nombre))]
    carpetas.insert(0, "Sin clasificar")
    return jsonify({"albumes": carpetas})

@app.route("/crear_album", methods=["POST"])
def crear_album():
    data = request.get_json()
    nombre = data.get("nombre", "").strip()
    if not nombre:
        return jsonify({"success": False, "error": "Nombre vacío"})

    ruta_album = os.path.join(mp3_folder, nombre)
    try:
        os.makedirs(ruta_album, exist_ok=True)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/lista_canciones_album")
def lista_canciones_album():
    album = request.args.get("album", "")
    ruta_album = os.path.join(mp3_folder, album)
    canciones = []

    if os.path.exists(ruta_album):
        for archivo in os.listdir(ruta_album):
            if archivo.endswith(".mp3"):
                nombre_cancion = archivo[:-4]

                duracion_formateada = obtener_duracion(os.path.join(ruta_album, archivo))

                if " - " in nombre_cancion:
                    artista, cancion_nombre = nombre_cancion.split(" - ", 1)
                else:
                    artista, cancion_nombre = "", nombre_cancion

                canciones.append({
                    "artista": artista,
                    "cancion": cancion_nombre,
                    "duracion": duracion_formateada
                })

    return jsonify({"canciones": canciones})

@app.route("/lista_canciones_sin_album")
def lista_canciones_sin_album():
    canciones = []
    for archivo in os.listdir(mp3_folder):
        ruta = os.path.join(mp3_folder, archivo)
        if archivo.endswith(".mp3") and os.path.isfile(ruta):
            nombre_cancion = archivo[:-4]

            duracion_formateada = obtener_duracion(ruta)

            if " - " in nombre_cancion:
                artista, cancion_nombre = nombre_cancion.split(" - ", 1)
            else:
                artista, cancion_nombre = "", nombre_cancion

            canciones.append({
                "artista": artista,
                "cancion": cancion_nombre,
                "duracion": duracion_formateada
            })
    return jsonify({"canciones": canciones})

@app.route("/reproducir_album")
def reproducir_album():
    album = request.args.get("album", "")
    cancion = request.args.get("cancion", "")
    archivo = os.path.join(mp3_folder, album, f"{cancion}.mp3")

    if os.path.exists(archivo):
        return send_from_directory(os.path.join(mp3_folder, album), f"{cancion}.mp3")
    else:
        return jsonify({"success": False, "error": "Archivo no encontrado"})

@app.route("/subir_txt_album", methods=["POST"])
def subir_txt_album():
    if "archivoTxt" not in request.files:
        return jsonify({"success": False, "error": "No se recibió ningún archivo"})

    archivo = request.files["archivoTxt"]
    if archivo.filename == "":
        return jsonify({"success": False, "error": "Nombre de archivo vacío"})

    try:
        nombre_album = os.path.splitext(archivo.filename)[0].strip()

        # Ruta final donde guardar el archivo txt
        ruta_txt_final = os.path.join(BASE_DIR, "albumes_txt", f"{nombre_album}.txt")
        archivo.save(ruta_txt_final)

        # Paso 1: Descargar canciones
        convertidor.descargar_txt_como_album(
            ruta_txt_final,
            carpeta_mp3=mp3_folder,
            carpeta_albumes_txt=os.path.join(BASE_DIR, "albumes_txt")
        )

        # Paso 2: Leer canciones del txt
        with open(ruta_txt_final, "r", encoding="utf-8") as f:
            lineas = [line.strip() for line in f if line.strip()]

        # Paso 3: Crear álbum en la base de datos si no existe
        album = Album.query.filter_by(nombre=nombre_album).first()
        if not album:
            album = Album(nombre=nombre_album)
            db.session.add(album)
            db.session.commit()

        # Paso 4: Procesar cada canción
        for linea in lineas:
            if " - " in linea:
                artista, titulo = linea.split(" - ", 1)
            else:
                artista, titulo = "Desconocido", linea

            # Generar el nombre del archivo
            nombre_archivo = f"{artista.strip()} - {titulo.strip()}"

            # Buscar la canción por nombre (que es único)
            cancion = Cancion.query.filter_by(nombre=nombre_archivo).first()

            # Si no existe, crearla
            if not cancion:
                duracion = "??:??"
                ruta_mp3 = os.path.join(mp3_folder, nombre_album, f"{nombre_archivo}.mp3")
                if os.path.exists(ruta_mp3):
                    try:
                        audio = MP3(ruta_mp3)
                        duracion_seg = int(audio.info.length)
                        minutos = duracion_seg // 60
                        segundos = duracion_seg % 60
                        duracion = f"{minutos:02}:{segundos:02}"
                    except:
                        pass

                cancion = Cancion(nombre=nombre_archivo, artista=artista, duracion=duracion)
                db.session.add(cancion)
                db.session.commit()

            # Relación con el álbum si no está ya
            existe = AlbumCancion.query.filter_by(album_id=album.id, cancion_id=cancion.id).first()
            if not existe:
                relacion = AlbumCancion(album_id=album.id, cancion_id=cancion.id)
                db.session.add(relacion)

        db.session.commit()

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

if __name__ == "__main__":
    app.run(debug=True)
