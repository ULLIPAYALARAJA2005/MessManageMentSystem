from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
from database import db
from socket_instance import socketio

load_dotenv()

app = Flask(__name__)
# Enable CORS for frontend
CORS(app)
app.config['SECRET_KEY'] = os.getenv("JWT_SECRET", "super_secret_key")

socketio.init_app(app)

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "running", "message": "Smart Mess Management System API"}), 200

from routes.auth_routes import auth_bp
from routes.admin_routes import admin_bp
from routes.student_routes import student_bp
from routes.wallet_routes import wallet_bp
from routes.employee_routes import employee_bp
from routes.store_routes import store_bp
from routes.poll_routes import poll_bp
from routes.badge_routes import badge_bp
from routes.feedback_routes import feedback_bp

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(student_bp, url_prefix='/api/student')
app.register_blueprint(wallet_bp, url_prefix='/api/wallet')
app.register_blueprint(employee_bp, url_prefix='/api/employee')
app.register_blueprint(store_bp, url_prefix='/api/store')
app.register_blueprint(poll_bp, url_prefix='/api/poll')
app.register_blueprint(badge_bp, url_prefix='/api/badge')
app.register_blueprint(feedback_bp, url_prefix='/api/feedback')

from background_tasks import start_scheduler

if __name__ == '__main__':
    start_scheduler()
    socketio.run(app, host='0.0.0.0', debug=True, port=5000)
