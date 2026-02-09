from flask import Blueprint, request, jsonify
from ..database import SessionLocal, FileMetadata
import os
import pandas as pd
import datetime

bp = Blueprint('files', __name__, url_prefix='/files')

def get_db():
    return SessionLocal()

@bp.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"message": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400
        
    if file:
        filepath = os.path.join("uploads", file.filename)
        file.save(filepath)
        
        db = get_db()
        try:
            # Guardar metadatos
            db_file = FileMetadata(filename=file.filename, filepath=filepath, upload_date=datetime.datetime.utcnow())
            db.add(db_file)
            db.commit()
            
            # Procesar
            data_preview = []
            try:
                if file.filename.endswith('.csv'):
                    df = pd.read_csv(filepath)
                elif file.filename.endswith('.xlsx'):
                    df = pd.read_excel(filepath)
                else:
                    return jsonify({"message": "File uploaded", "preview": "Not a supported data file"})
                
                # Handling NaNs for JSON serialization
                df = df.where(pd.notnull(df), None)
                
                # Return all data for charts, but frontend should limit table view
                data_preview = df.to_dict(orient='records')
                columns = list(df.columns)
                
                return jsonify({
                    "message": "File processed successfully", 
                    "columns": columns,
                    "data": data_preview
                })
            except Exception as e:
                return jsonify({"message": f"File uploaded but error processing data: {str(e)}"}), 500
        finally:
            db.close()
