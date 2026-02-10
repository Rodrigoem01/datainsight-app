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
    # Verificar Autenticación para obtener Rol
    token = request.headers.get('Authorization')
    user_role = 'user' # Default
    if token and token.startswith("Bearer "):
        try:
            token_str = token.split(" ")[1]
            from .auth import SECRET_KEY, ALGORITHM
            payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
            # Podríamos buscar el usuario en TIEMPO REAL en DB para asegurar el rol
            # pero por rendimiento confiamos en el token o hacemos una query rapida
            # Para mayor seguridad:
            db = get_db()
            user = db.query(User).filter(User.username == payload.get("sub")).first()
            if user:
                user_role = user.role
            db.close()
        except Exception as e:
            print(f"Error verificando token en upload: {e}")
            pass

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
            # Procesar archivo
            if file.filename.endswith('.csv'):
                df = pd.read_csv(filepath)
            elif file.filename.endswith('.xlsx'):
                df = pd.read_excel(filepath)
            else:
                return jsonify({"message": "Formato no soportado"}), 400
            
            # Limpiar tabla anterior (opcional, para este demo reemplazamos todo)
            from ..database import Sale
            db.query(Sale).delete()
            
            # Determinar visibilidad
            visibility = 'admin' if user_role == 'admin' else 'public'
            
            # --- HELPER: Mapeo inteligente de columnas ---
            # Identificar qué columna del Excel corresponde a cada campo de DB
            cols = df.columns
            def get_col_name(candidates):
                for c in candidates:
                    # Búsqueda exacta case-insensitive
                    match = next((x for x in cols if str(x).lower().strip() == c.lower().strip()), None)
                    if match: return match
                return None

            # Definir candidatos para cada campo
            col_map = {
                'order_id': get_col_name(['Order ID', 'ID Pedido', 'ID', 'Orden']),
                'product': get_col_name(['Product Name', 'Product', 'Producto', 'Nombre Producto']),
                'category': get_col_name(['Category', 'Categoría', 'Categoria', 'Departamento']),
                'amount': get_col_name(['Sales', 'Amount', 'Ventas', 'Total', 'Importe']),
                'profit': get_col_name(['Profit', 'Ganancia', 'Margen', 'Utilidad']),
                'date': get_col_name(['Order Date', 'Date', 'Fecha', 'Fecha Pedido']),
                'region': get_col_name(['Region', 'Región', 'Zona', 'Area'])
            }

            # Guardar nuevos datos
            for _, row in df.iterrows():
                try:
                    # Extraer valores usando el mapa detectado
                    sale = Sale(
                        order_id=str(row[col_map['order_id']]) if col_map['order_id'] else f"ORD-{_}",
                        product=str(row[col_map['product']]) if col_map['product'] else "Desconocido",
                        category=str(row[col_map['category']]) if col_map['category'] else "General",
                        amount=float(row[col_map['amount']]) if col_map['amount'] else 0.0,
                        profit=float(row[col_map['profit']]) if col_map['profit'] else 0.0,
                        date=pd.to_datetime(row[col_map['date']]) if col_map['date'] else datetime.datetime.now(),
                        region=str(row[col_map['region']]) if col_map['region'] else "Global",
                        visibility=visibility
                    )
                    db.add(sale)
                except Exception as e:
                    print(f"Error procesando fila {_}: {e}")
                    continue
            
            db.commit()
            
            # Responder con los datos guardados (filtrados es opcional aquí, pero retornamos lo que se subió)
            sales = db.query(Sale).all()
            data = [{
                "Order ID": s.order_id,
                "Product": s.product,
                "Category": s.category,
                "Amount": s.amount,
                "Profit": s.profit,
                "Date": s.date.strftime('%Y-%m-%d'),
                "Region": s.region,
                "Visibility": s.visibility
            } for s in sales]

            return jsonify({
                "message": f"Datos subidos correctamente (Visibilidad: {visibility})", 
                "data": data
            })

        except Exception as e:
            return jsonify({"message": f"Error: {str(e)}"}), 500
        finally:
            db.close()

@bp.route('/data', methods=['GET'])
def get_data():
    db = get_db()
    try:
        from ..database import Sale
        sales = db.query(Sale).all()
        data = [{
            "Order ID": s.order_id,
            "Product": s.product,
            "Category": s.category,
            "Amount": s.amount,
            "Profit": s.profit,
            "Date": s.date.strftime('%Y-%m-%d'),
            "Region": s.region,
            "Visibility": s.visibility
        } for s in sales]
        return jsonify(data)
    finally:
        db.close()
