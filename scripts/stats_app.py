from flask import Flask, render_template, jsonify
from app.models import db, Cancion
from app.config import Config
from sqlalchemy import func
from sqlalchemy import text


def create_stats_app(config_overrides=None):
    app = Flask(__name__, template_folder='../app/templates', static_folder='../app/static')
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)
    db.init_app(app)

    @app.route('/')
    def index():
        return render_template('stats.html')

    @app.route('/api/stats')
    def get_stats():
        top_songs = Cancion.query.order_by(Cancion.plays.desc()).limit(5).all()
        songs_data = [{"title": song.titulo, "artist": song.artista, "plays": song.plays} for song in top_songs]

        top_artists = db.session.query(
            Cancion.artista, func.sum(Cancion.plays).label('total_plays')
        ).group_by(Cancion.artista).order_by(text('total_plays DESC')).limit(5).all()
        artists_data = [
            {"artist": artist or "Desconocido", "plays": plays}
            for artist, plays in top_artists
        ]

        all_played_songs = Cancion.query.filter(Cancion.plays > 0).all()
        total_seconds = 0
        for song in all_played_songs:
            try:
                minutes, seconds = song.duracion.split(':')
                total_seconds += (int(minutes) * 60 + int(seconds)) * song.plays
            except (AttributeError, ValueError):
                continue

        return jsonify({
            "top_songs": songs_data,
            "top_artists": artists_data,
            "total_minutes": total_seconds // 60
        })

    return app


app = create_stats_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=app.config['STATS_PORT'], debug=app.config['DEBUG'])
