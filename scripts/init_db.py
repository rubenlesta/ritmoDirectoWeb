import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from werkzeug.utils import secure_filename

from app import create_app
from app.models import db


def _create_mysql_database_if_missing(app):
    database_url = make_url(app.config["SQLALCHEMY_DATABASE_URI"])
    if not database_url.drivername.startswith("mysql") or not database_url.database:
        return

    server_url = database_url.set(database="")
    engine = create_engine(server_url)
    preparer = engine.dialect.identifier_preparer
    database_name = preparer.quote(database_url.database)
    try:
        with engine.begin() as connection:
            connection.execute(text(
                f"CREATE DATABASE IF NOT EXISTS {database_name} "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            ))
    finally:
        engine.dispose()


def migrate_legacy_schema():
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())
    if "canciones" not in existing_tables:
        return

    preparer = db.engine.dialect.identifier_preparer
    table_name = preparer.quote("canciones")
    columns = {column["name"] for column in inspector.get_columns("canciones")}

    if "titulo" not in columns:
        if "nombre" not in columns:
            raise RuntimeError(
                "La tabla canciones no contiene ni la columna titulo ni nombre."
            )
        db.session.execute(text(
            f"ALTER TABLE {table_name} RENAME COLUMN "
            f"{preparer.quote('nombre')} TO {preparer.quote('titulo')}"
        ))
        db.session.commit()
        columns.remove("nombre")
        columns.add("titulo")

    additions = {
        "filename": "VARCHAR(255)",
        "plays": "INTEGER NOT NULL DEFAULT 0",
        "last_played": "DATETIME",
    }
    for column_name, column_type in additions.items():
        if column_name not in columns:
            db.session.execute(text(
                f"ALTER TABLE {table_name} ADD COLUMN "
                f"{preparer.quote(column_name)} {column_type}"
            ))
            db.session.commit()

    rows = db.session.execute(text(
        f"SELECT id, titulo, artista, filename FROM {table_name} "
        "ORDER BY id"
    )).mappings().all()
    used_filenames = set()
    for row in rows:
        filename = row["filename"]
        if not filename:
            artist = row["artista"] or "Desconocido"
            title = row["titulo"] or "Sin título"
            filename = secure_filename(f"{artist} - {title}.mp3")
            filename = filename or f"cancion-{row['id']}.mp3"

        if filename.casefold() in used_filenames:
            stem, extension = os.path.splitext(filename)
            filename = f"{stem}-{row['id']}{extension}"
            suffix = 2
            while filename.casefold() in used_filenames:
                filename = f"{stem}-{row['id']}-{suffix}{extension}"
                suffix += 1

        if filename != row["filename"]:
            db.session.execute(
                text(
                    f"UPDATE {table_name} SET "
                    f"{preparer.quote('filename')} = :filename "
                    "WHERE id = :song_id"
                ),
                {"filename": filename, "song_id": row["id"]},
            )
        used_filenames.add(filename.casefold())

    db.session.commit()
    indexes = inspect(db.engine).get_indexes("canciones")
    filename_is_unique = any(
        index.get("unique")
        and index.get("column_names") == ["filename"]
        for index in indexes
    )
    if not filename_is_unique:
        index_name = preparer.quote("uq_canciones_filename")
        db.session.execute(text(
            f"CREATE UNIQUE INDEX {index_name} "
            f"ON {table_name} ({preparer.quote('filename')})"
        ))
        db.session.commit()


def initialize_database(app=None):
    app = app or create_app()
    _create_mysql_database_if_missing(app)

    with app.app_context():
        db.create_all()
        migrate_legacy_schema()
        print(
            "Database initialized:",
            f"{db.engine.url.drivername} / {db.engine.url.database}",
        )


if __name__ == "__main__":
    initialize_database()
