from flask import Blueprint, request, jsonify
from middleware import token_required
from database import db
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from socket_instance import socketio

wallet_bp = Blueprint('wallet_bp', __name__)

def serialize(doc):
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc

@wallet_bp.route('/summary', methods=['GET'])
@token_required(['Admin'])
def wallet_summary(current_user):
    students = list(db.users.find({'role': 'Student'}, {'walletBalance': 1}))
    total_wallet = sum(s.get('walletBalance', 0) for s in students)
    low_balance = sum(1 for s in students if s.get('walletBalance', 0) < 50)
    
    today = datetime.now().strftime('%Y-%m-%d')
    today_txns = list(db.transactions.find({'date': {'$gte': today}, 'type': 'credit'}))
    today_collection = sum(t.get('amount', 0) for t in today_txns)
    
    all_credits = list(db.transactions.find({'type': 'credit'}))
    total_revenue = sum(t.get('amount', 0) for t in all_credits)
    
    return jsonify({
        'totalRevenue': total_revenue,
        'todayCollection': today_collection,
        'totalWalletBalance': total_wallet,
        'lowBalanceCount': low_balance
    }), 200

@wallet_bp.route('/transactions', methods=['GET'])
@token_required(['Admin'])
def get_transactions(current_user):
    txns = list(db.transactions.find({}).sort('date', -1).limit(200))
    return jsonify([serialize(t) for t in txns]), 200

@wallet_bp.route('/students', methods=['GET'])
@token_required(['Admin'])
def get_wallet_students(current_user):
    students = list(db.users.find({'role': 'Student'}, {'password': 0}))
    return jsonify([serialize(s) for s in students]), 200

@wallet_bp.route('/low-balance', methods=['GET'])
@token_required(['Admin'])
def low_balance_students(current_user):
    students = list(db.users.find({'role': 'Student', 'walletBalance': {'$lt': 50}}, {'password': 0}))
    return jsonify([serialize(s) for s in students]), 200

@wallet_bp.route('/add', methods=['POST'])
@token_required(['Admin'])
def add_money(current_user):
    data = request.json
    email = data.get('email')
    amount = float(data.get('amount', 0))
    purpose = data.get('purpose', 'Recharge')
    
    if amount <= 0:
        return jsonify({'message': 'Amount must be positive'}), 400
    
    student = db.users.find_one({'email': email, 'role': 'Student'})
    if not student:
        return jsonify({'message': 'Student not found'}), 404
    
    db.users.update_one({'email': email}, {'$inc': {'walletBalance': amount}})
    db.transactions.insert_one({
        'email': email,
        'studentName': student.get('name', email),
        'type': 'credit',
        'amount': amount,
        'purpose': purpose,
        'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'by': 'Admin'
    })
    socketio.emit('walletUpdated', {"email": email, "type": "credit"})
    return jsonify({'message': f'₹{amount} added to {email}'}), 200

@wallet_bp.route('/deduct', methods=['POST'])
@token_required(['Admin'])
def deduct_money(current_user):
    data = request.json
    email = data.get('email')
    amount = float(data.get('amount', 0))
    purpose = data.get('purpose', 'Adjustment')
    
    if amount <= 0:
        return jsonify({'message': 'Amount must be positive'}), 400
    
    student = db.users.find_one({'email': email, 'role': 'Student'})
    if not student:
        return jsonify({'message': 'Student not found'}), 404
    
    if student.get('walletBalance', 0) < amount:
        return jsonify({'message': f'Insufficient balance. Current: ₹{student.get("walletBalance", 0)}'}), 400
    
    db.users.update_one({'email': email}, {'$inc': {'walletBalance': -amount}})
    db.transactions.insert_one({
        'email': email,
        'studentName': student.get('name', email),
        'type': 'debit',
        'amount': amount,
        'purpose': purpose,
        'date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'by': 'Admin'
    })
    socketio.emit('walletUpdated', {"email": email, "type": "debit"})
    return jsonify({'message': f'₹{amount} deducted from {email}'}), 200

@wallet_bp.route('/bulk-action', methods=['POST'])
@token_required(['Admin'])
def bulk_action(current_user):
    data = request.json
    action = data.get('action') # 'add' or 'deduct'
    amount = float(data.get('amount', 0))
    purpose = data.get('purpose', 'Bulk Update')
    
    if amount <= 0:
        return jsonify({'message': 'Amount must be positive'}), 400
        
    students = list(db.users.find({'role': 'Student'}))
    if not students:
        return jsonify({'message': 'No active students found'}), 404
        
    inc_amount = amount if action == 'add' else -amount
    type_action = 'credit' if action == 'add' else 'debit'
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Bulk array constructs for transaction logging
    transactions = []
    for s in students:
        transactions.append({
            'email': s.get('email'),
            'studentName': s.get('name', 'Unknown'),
            'type': type_action,
            'amount': amount,
            'purpose': purpose,
            'date': current_time,
            'by': 'Admin (Bulk)'
        })
        
    # Apply global updates
    db.users.update_many({'role': 'Student'}, {'$inc': {'walletBalance': inc_amount}})
    if transactions:
        db.transactions.insert_many(transactions)
        
    socketio.emit('walletUpdated', {"type": type_action, "bulk": True})
    return jsonify({'message': f'₹{amount} has been successfully {action}ed from all {len(students)} students!'}), 200

@wallet_bp.route('/analytics', methods=['GET'])
@token_required(['Admin'])
def wallet_analytics(current_user):
    # Daily revenue for last 7 days
    daily = []
    for i in range(6, -1, -1):
        day = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        label = (datetime.now() - timedelta(days=i)).strftime('%a')
        txns = list(db.transactions.find({'type': 'credit', 'date': {'$gte': day, '$lt': day + 'T'}}))
        # fallback: match by prefix
        txns2 = list(db.transactions.find({'type': 'credit', 'date': {'$regex': f'^{day}'}}))
        total = sum(t.get('amount', 0) for t in txns2)
        daily.append({'name': label, 'revenue': total})
    
    # Meal-wise earnings from booking purposes
    booking_txns = list(db.transactions.find({'type': 'debit', 'purpose': 'Meal Booking'}))
    meal_total = sum(t.get('amount', 0) for t in booking_txns)
    recharge_txns = list(db.transactions.find({'type': 'credit', 'purpose': 'Recharge'}))
    recharge_total = sum(t.get('amount', 0) for t in recharge_txns)
    bonus_txns = list(db.transactions.find({'type': 'credit', 'purpose': 'Bonus'}))
    bonus_total = sum(t.get('amount', 0) for t in bonus_txns)
    
    return jsonify({
        'daily': daily,
        'breakdown': [
            {'name': 'Meal Bookings', 'value': meal_total},
            {'name': 'Recharges', 'value': recharge_total},
            {'name': 'Bonuses', 'value': bonus_total},
        ]
    }), 200
