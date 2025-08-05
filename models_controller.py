from models import db, Album, Cancion

def crear_album(nombre_album):
    if not Album.query.filter_by(nombre=nombre_album).first():
        nuevo_album = Album(nombre=nombre_album)
        db.session.add(nuevo_album)
        db.session.commit()
        return True
    return False  # Ya existe

def agregar_cancion_a_album(nombre_album, nombre_cancion):
    album = Album.query.filter_by(nombre=nombre_album).first()
    cancion = Cancion.query.filter_by(nombre=nombre_cancion).first()

    if album and cancion:
        if cancion not in album.canciones:
            album.canciones.append(cancion)
            db.session.commit()
            return True
    return False

def quitar_cancion_de_album(nombre_album, nombre_cancion):
    album = Album.query.filter_by(nombre=nombre_album).first()
    cancion = Cancion.query.filter_by(nombre=nombre_cancion).first()

    if album and cancion and cancion in album.canciones:
        album.canciones.remove(cancion)
        db.session.commit()
        return True
    return False

def obtener_canciones_de_album(nombre_album):
    album = Album.query.filter_by(nombre=nombre_album).first()
    if album:
        return [c.nombre for c in album.canciones]
    return []

def obtener_todos_los_albumes():
    return [a.nombre for a in Album.query.all()]
