from flask import Blueprint, render_template, send_from_directory, current_app
import os

main_bp = Blueprint('main', __name__)

@main_bp.route("/")
def index():
    return render_template("index.html")

@main_bp.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(current_app.static_folder, filename)
