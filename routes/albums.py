from flask import Blueprint, jsonify, request
from models import db, Cancion, Album, AlbumCancion

albums_bp = Blueprint('albums', __name__)

@albums_bp.route("/api/albumes", methods=["GET"])
def obtener_albumes():
    albumes = Album.query.all()
    return jsonify([
        {"id": album.id, "nombre": album.nombre}
        for album in albumes
    ])

@albums_bp.route("/api/album/<int:album_id>/canciones", methods=["GET"])
def obtener_canciones_album(album_id):
    album = Album.query.get_or_404(album_id)
    canciones = [
        {"id": c.id, "titulo": c.titulo, "artista": c.artista}
        for c in album.canciones
    ]
    return jsonify({"album": album.nombre, "canciones": canciones})

@albums_bp.route("/api/album/<int:album_id>/agregar_cancion", methods=["POST"])
def agregar_cancion_a_album(album_id):
    datos = request.get_json()
    titulo = datos.get("titulo")
    artista = datos.get("artista")

    if not titulo or not artista:
        return jsonify({"success": False, "error": "Faltan datos"}), 400

    album = Album.query.get(album_id)
    if not album:
        return jsonify({"success": False, "error": "Álbum no encontrado"}), 404

    cancion = Cancion.query.filter_by(titulo=titulo, artista=artista).first()
    if not cancion:
        cancion = Cancion(titulo=titulo, artista=artista)
        db.session.add(cancion)
        db.session.commit()

    # Evitar duplicados
    ya_existe = AlbumCancion.query.filter_by(album_id=album.id, cancion_id=cancion.id).first()
    if ya_existe:
        return jsonify({"success": False, "error": "La canción ya está en el álbum"}), 409

    relacion = AlbumCancion(album_id=album.id, cancion_id=cancion.id)
    db.session.add(relacion)
    db.session.commit()

    return jsonify({"success": True})
