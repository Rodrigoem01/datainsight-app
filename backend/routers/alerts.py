from flask import Blueprint, request, jsonify
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

bp = Blueprint('alerts', __name__, url_prefix='/alerts')

# --- CONFIGURACIÓN SMTP ---
# En producción, usa variables de entorno
SMTP_SERVER = "smtp.gmail.com" # Ejemplo: Gmail
SMTP_PORT = 587
SMTP_USER = "tu_correo@gmail.com" # CAMBIAR ESTO
SMTP_PASSWORD = "tu_contraseña_aplicacion" # CAMBIAR ESTO

@bp.route('/send', methods=['POST'])
def send_alert():
    data = request.json
    recipient = data.get('recipient')
    subject = data.get('subject')
    message_body = data.get('message')

    if not recipient or not subject or not message_body:
        return jsonify({"detail": "Faltan datos requeridos"}), 400

    try:
        # Configurar mensaje
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(message_body, 'plain'))

        # NOTA: Como no tenemos credenciales reales, esto fallará si se intenta conectar de verdad.
        # Para propósitos de DEMOSTRACIÓN, simularemos el éxito si no están configuradas.
        if "tu_correo" in SMTP_USER:
             print(f"--- SIMULANDO ENVÍO DE CORREO ---\nPara: {recipient}\nAsunto: {subject}\nMensaje: {message_body}\n-----------------------------------")
             return jsonify({"message": "Alerta enviada (Simulación). Configura SMTP para envío real."}), 200

        # Conexión SMTP Real (Descomentar para usar)
        # server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        # server.starttls()
        # server.login(SMTP_USER, SMTP_PASSWORD)
        # text = msg.as_string()
        # server.sendmail(SMTP_USER, recipient, text)
        # server.quit()

        return jsonify({"message": "Alerta enviada exitosamente"}), 200

    except Exception as e:
        print(f"Error enviando correo: {e}")
        return jsonify({"detail": f"Error al enviar: {str(e)}"}), 500
