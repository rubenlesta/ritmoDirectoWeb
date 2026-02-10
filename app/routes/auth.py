from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from app.models import db, User, Album
from app.services.music_service import MusicService

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    # If using a modal, this might be an API call or a redirect if accessed directly
    if request.method == 'POST':
        # Accept JSON or Form data
        if request.is_json:
            data = request.get_json()
            username = data.get('username')
            password = data.get('password')
        else:
            username = request.form.get('username')
            password = request.form.get('password')
            
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user, remember=True) # Try verify remember
            print(f"DEBUG: User {username} logged in successfully.")
            # Ensure "Home" album exists for this user (even root)
            MusicService.ensure_home_album(user)
            
            if request.is_json:
                return jsonify({"success": True})
            return redirect(url_for('main.index'))
        
        # If user not found or password wrong
        print(f"DEBUG: Login failed for {username}")
        error_msg = "Usuario no encontrado" if not user else "Contraseña incorrecta"
        if request.is_json:
             return jsonify({"success": False, "error": error_msg})
        flash(error_msg)
        
    return render_template('login.html') # Need to create this or handle in index

@auth_bp.route('/register', methods=['POST'])
def register():
    return jsonify({"success": False, "error": "El registro público está desactivado."})
    # Legacy code below disabled
    # data = request.get_json() if request.is_json else request.form
    # ...

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.index'))

@auth_bp.route('/api/update_theme', methods=['POST'])
@login_required
def update_theme():
    data = request.get_json()
    theme = data.get('theme')
    if theme:
        current_user.theme_color = theme
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "No theme provided"})

@auth_bp.route('/api/current_user')
def get_current_user():
    # print(f"DEBUG: Checking current_user. Is Auth? {current_user.is_authenticated}")
    if current_user.is_authenticated:
        return jsonify({
            "is_authenticated": True, 
            "username": current_user.username,
            "theme": current_user.theme_color
        })
    else:
        return jsonify({"is_authenticated": False})
