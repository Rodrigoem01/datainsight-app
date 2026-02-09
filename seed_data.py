from backend.database import SessionLocal, User, engine, Base
from backend.routers.auth import get_password_hash

# Asegurar que las tablas existan
Base.metadata.create_all(bind=engine)

db = SessionLocal()

username = "admin"
password = "password123"

existing_user = db.query(User).filter(User.username == username).first()
if not existing_user:
    hashed_password = get_password_hash(password)
    user = User(username=username, hashed_password=hashed_password, role="admin")
    db.add(user)
    db.commit()
    print(f"User '{username}' created with password '{password}'")
else:
    print(f"User '{username}' already exists")

db.close()
