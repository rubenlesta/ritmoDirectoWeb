from flask import Blueprint, jsonify, request, send_from_directory, current_app, send_file
from flask_login import login_required, current_user
import os
import zipfile
import io

download_bp = Blueprint('download', __name__)

@download_bp.route("/api/download_file/<filename>")
@login_required
def download_file_client(filename):
    """Allows user to download the MP3 file to their local machine."""
    if not filename.endswith(".mp3"):
        filename += ".mp3"
        
    path = os.path.join(current_app.config['MP3_FOLDER'], filename)
    if os.path.exists(path):
        return send_from_directory(current_app.config['MP3_FOLDER'], filename, as_attachment=True)
    return jsonify({"success": False, "error": "File not found"}), 404

@download_bp.route("/api/prepare_cd", methods=["POST"])
@login_required
def prepare_cd():
    """Zips selected songs and returns download link."""
    data = request.get_json()
    filenames = data.get("filenames", [])
    
    if not filenames:
         return jsonify({"success": False, "error": "No songs selected"})
         
    # Create in-memory zip
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for filename in filenames:
            path = os.path.join(current_app.config['MP3_FOLDER'], filename)
            if os.path.exists(path):
                zf.write(path, filename)
            else:
                print(f"File not found for zip: {filename}")
                
    memory_file.seek(0)
    
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name='CD_Compilation.zip'
    )
