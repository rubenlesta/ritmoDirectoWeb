from flask import Flask
from app.config import Config
from app.models import db

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    
    from flask_login import LoginManager
    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)
    
    from app.models import User
    
    @login_manager.user_loader
    def load_user(user_id):
        # Debug user loading
        # print(f"DEBUG: Loading user_id {user_id}") 
        return db.session.get(User, int(user_id))

    from app.routes.main import main_bp
    from app.routes.api import api_bp
    from app.routes.auth import auth_bp
    from app.routes.download import download_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(download_bp)

    return app
