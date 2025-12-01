from app import create_app
from app.models import db

app = create_app()

with app.app_context():
    print("Creating tables...")
    db.create_all()
    print("Tables created!")
