from app import create_app
from app.models import db, Album, Cancion, AlbumCancion

app = create_app()

with app.app_context():
    print("--- ALBUMES ---")
    albumes = Album.query.all()
    for a in albumes:
        print(f"ID: {a.id}, Nombre: {a.nombre}")
        print(f"  Canciones ({len(a.canciones)}):")
        for ac in a.canciones:
            print(f"    - {ac.cancion.titulo} ({ac.cancion.filename})")

    print("\n--- CANCIONES (Total) ---")
    canciones = Cancion.query.all()
    for c in canciones:
        print(f"ID: {c.id}, Titulo: {c.titulo}, Filename: {c.filename}")
