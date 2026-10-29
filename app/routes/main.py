from flask import Blueprint, render_template, send_from_directory, current_app


main_bp = Blueprint('main', __name__)

@main_bp.route("/")
def index():
    return render_template("index.html")


@main_bp.route("/sw.js")
def service_worker():
    response = send_from_directory(
        current_app.static_folder,
        "sw.js",
        mimetype="application/javascript",
    )
    response.headers["Service-Worker-Allowed"] = "/"
    response.headers["Cache-Control"] = "no-cache"
    return response


@main_bp.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(current_app.static_folder, filename)
