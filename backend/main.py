from flask import Flask, send_from_directory
from flask_cors import CORS
from .database import engine, Base
from .routers import auth, files, alerts
import os

app = Flask(__name__, static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend")))
CORS(app)

# Asegurar directorios
os.makedirs("uploads", exist_ok=True)

# Crear tablas
Base.metadata.create_all(bind=engine)

# Registrar Blueprints
app.register_blueprint(auth.bp)
app.register_blueprint(files.bp)
app.register_blueprint(alerts.bp)

# --- AUTO-CREATE ADMIN USER ---
def create_initial_user():
    from .database import SessionLocal, User
    from .routers.auth import get_password_hash
    
    db = SessionLocal()
    try:
        username = "admin"
        if not db.query(User).filter(User.username == username).first():
            print(f"Creando usuario inicial: {username}")
            hashed_password = get_password_hash("password123")
            user = User(username=username, hashed_password=hashed_password, role="admin")
            db.add(user)
            db.commit()
    except Exception as e:
        print(f"Error creando usuario inicial: {e}")
    finally:
        db.close()

# Ejecutar creación de usuario
create_initial_user()

# Rutas estáticas
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    app.run(debug=True, port=8000)
