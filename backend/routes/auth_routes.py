from flask import Blueprint, request, jsonify
import bcrypt
import jwt
import os
import datetime
from database import db
from bson.objectid import ObjectId

auth_bp = Blueprint('auth_bp', __name__)
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key")

def generate_token(user):
    payload = {
        'user_id': str(user['_id']),
        'email': user['email'],
        'role': user['role'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"message": "Email and password required"}), 400
        
    user = db.users.find_one({"email": email})
    if not user:
        return jsonify({"message": "Invalid email or password"}), 401
        
    if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        token = generate_token(user)
        return jsonify({
            "token": token,
            "role": user['role'],
            "name": user['name'],
            "userId": str(user['_id'])
        }), 200
        
    return jsonify({"message": "Invalid email or password"}), 401

@auth_bp.route('/register/student', methods=['POST'])
def register_student():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    student_id = data.get('studentId') # Unique ID like r210264
    
    if not email or not password or not name or not student_id:
        return jsonify({"message": "All fields are required"}), 400
        
    if db.users.find_one({"email": email}) or db.users.find_one({"studentId": student_id}):
        return jsonify({"message": "User with email or student ID already exists"}), 400
        
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    new_student = {
        "name": name,
        "email": email,
        "password": hashed_password,
        "role": "Student",
        "studentId": student_id,
        "walletBalance": 0
    }
    
    db.users.insert_one(new_student)
    return jsonify({"message": "Student registered successfully"}), 201
