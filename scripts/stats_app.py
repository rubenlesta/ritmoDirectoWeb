from flask import Flask, render_template, jsonify
from app.models import db, Cancion
from app.config import Config
from sqlalchemy import func
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, template_folder='app/templates', static_folder='app/static')
app.config.from_object(Config)
db.init_app(app)

@app.route('/')
def index():
    return render_template('stats.html')

@app.route('/api/stats')
def get_stats():
    # Top 5 Songs
    top_songs = Cancion.query.order_by(Cancion.plays.desc()).limit(5).all()
    songs_data = [{"title": s.titulo, "artist": s.artista, "plays": s.plays} for s in top_songs]
    
    # Top 5 Artists
    # Group by artist, sum plays
    top_artists = db.session.query(
        Cancion.artista, func.sum(Cancion.plays).label('total_plays')
    ).group_by(Cancion.artista).order_by(text('total_plays DESC')).limit(5).all()
    
    artists_data = [{"artist": a[0] or "Desconocido", "plays": a[1]} for a in top_artists]
    
    # Total Minutes
    # We need to parse duration "MM:SS" to seconds, sum it up, then convert to minutes
    # Since duration is string, we might need to do this in python if DB doesn't support easy conversion
    # Or we can iterate all songs with plays > 0
    
    all_played_songs = Cancion.query.filter(Cancion.plays > 0).all()
    total_seconds = 0
    for song in all_played_songs:
        try:
            parts = song.duracion.split(':')
            if len(parts) == 2:
                seconds = int(parts[0]) * 60 + int(parts[1])
                total_seconds += seconds * song.plays
        except:
            pass
            
    total_minutes = int(total_seconds / 60)
    
    return jsonify({
        "top_songs": songs_data,
        "top_artists": artists_data,
        "total_minutes": total_minutes
    })

from sqlalchemy import text

if __name__ == '__main__':
    port = int(os.environ.get('STATS_PORT', 5002))
    app.run(host='0.0.0.0', port=port, debug=True)
