from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from ..database import SessionLocal, User
import jwt
import datetime
import bcrypt

bp = Blueprint('auth', __name__, url_prefix='/auth')

SECRET_KEY = "tu_clave_secreta_super_segura"
ALGORITHM = "HS256"

# Utilidades
def get_db():
    return SessionLocal()

def verify_password(plain_password, hashed_password):
    # Usar bcrypt directamente
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')
    return bcrypt.checkpw(plain_password, hashed_password)

def get_password_hash(password):
    # Usar bcrypt directamente
    if isinstance(password, str):
        password = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password, salt)
    return hashed.decode('utf-8')

@bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    db = get_db()
    try:
        user = db.query(User).filter(User.username == username).first()
        
        if not user or not verify_password(password, user.hashed_password):
            return jsonify({"detail": "Credenciales inválidas"}), 401
        
        token_payload = {
            "sub": user.username,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
        }
        
        token = jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)
        
        return jsonify({"access_token": token, "token_type": "bearer", "role": user.role})
    finally:
        db.close()

@bp.route('/profile', methods=['PUT'])
def update_profile():
    token = request.headers.get('Authorization')
    if not token or not token.startswith("Bearer "):
        return jsonify({"detail": "Token no proporcionado"}), 401
    
    token = token.split(" ")[1]
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise jwt.InvalidTokenError
    except jwt.ExpiredSignatureError:
        return jsonify({"detail": "Token expirado"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"detail": "Token inválido"}), 401
        
    data = request.json
    current_password = data.get('current_password')
    new_username = data.get('new_username')
    new_password = data.get('new_password')
    
    if not current_password:
        return jsonify({"detail": "Contraseña actual requerida"}), 400
        
    db = get_db()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return jsonify({"detail": "Usuario no encontrado"}), 404
            
        if not verify_password(current_password, user.hashed_password):
            return jsonify({"detail": "Contraseña actual incorrecta"}), 401
            
        if new_username:
            # Check if username exists
            existing = db.query(User).filter(User.username == new_username).first()
            if existing and existing.id != user.id:
                 return jsonify({"detail": "El nombre de usuario ya está en uso"}), 400
            user.username = new_username
            
        if new_password:
            user.hashed_password = get_password_hash(new_password)
            
        db.commit()
        
        # If username changed, generate new token
        new_token = None
        if new_username:
            token_payload = {
                "sub": user.username,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
            }
            new_token = jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)
            
        return jsonify({
            "message": "Perfil actualizado exitosamente",
            "access_token": new_token # Client should update token if present
        })
        
    finally:
        db.close()

@bp.route('/users', methods=['GET'])
def list_users():
    token = request.headers.get('Authorization')
    # Simple check for now
    if not token:
        return jsonify({"detail": "Token no proporcionado"}), 401
    
    db = get_db()
    try:
        users = db.query(User).all()
        return jsonify([{
            "id": u.id,
            "username": u.username,
            "role": u.role
        } for u in users])
    finally:
        db.close()

@bp.route('/users', methods=['POST'])
def create_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    
    if not username or not password:
        return jsonify({"detail": "Usuario y contraseña requeridos"}), 400
        
    db = get_db()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            return jsonify({"detail": "El usuario ya existe"}), 400
            
        hashed_password = get_password_hash(password)
        new_user = User(username=username, hashed_password=hashed_password, role=role)
        db.add(new_user)
        db.commit()
        
        return jsonify({"message": "Usuario creado exitosamente"}), 201
    finally:
        db.close()

@bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    db = get_db()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return jsonify({"detail": "Usuario no encontrado"}), 404
            
        if user.username == "admin":
             return jsonify({"detail": "No se puede eliminar el admin principal"}), 400

        db.delete(user)
        db.commit()
        return jsonify({"message": "Usuario eliminado"})
    finally:
        db.close()
