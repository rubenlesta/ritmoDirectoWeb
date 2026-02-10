from app import create_app
from app.models import db, User, Album

app = create_app()

with app.app_context():
    print("Creating tables...")
    db.create_all()
    print("Tables created!")
    
    # Create Root User if not exists
    if not User.query.filter_by(username="root").first():
        print("Creating default 'root' user...")
        root = User(username="root")
        root.set_password("RUBIOLESTA4")
        db.session.add(root)
        db.session.commit()
        
        # Ensure root has a Home album
        if not Album.query.filter_by(nombre="Home", user_id=root.id).first():
            home = Album(nombre="Home", user_id=root.id)
            db.session.add(home)
            db.session.commit()
            
        print("Root user created (user: root, pass: root).")
    else:
        print("Root user already exists.")
