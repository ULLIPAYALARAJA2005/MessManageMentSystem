from flask import Blueprint, request, jsonify
from middleware import token_required
from database import db
from bson.objectid import ObjectId
import bcrypt
from datetime import datetime, timedelta
from socket_instance import socketio

admin_bp = Blueprint('admin_bp', __name__)

@admin_bp.route('/dashboard', methods=['GET'])
@token_required(['Admin'])
def get_dashboard(current_user):
    total_students = db.users.count_documents({"role": "Student"})
    # Let's count today's bookings:
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    total_bookings = db.bookings.count_documents({"date": {"$gte": today_start}})
    
    # Wallet collection
    pipeline = [{"$match": {"role": "Student"}}, {"$group": {"_id": None, "total": {"$sum": "$walletBalance"}}}]
    wallet_agg = list(db.users.aggregate(pipeline))
    wallet_collection = wallet_agg[0]['total'] if wallet_agg else 0
    
    feedback_count = db.complaints.count_documents({})
    
    return jsonify({
        "totalStudents": total_students,
        "totalBookings": total_bookings,
        "walletCollection": wallet_collection,
        "feedbackCount": feedback_count
    }), 200

@admin_bp.route('/employees', methods=['POST'])
@token_required(['Admin'])
def create_employee(current_user):
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    
    if not email or not password or not name:
        return jsonify({"message": "Required fields missing"}), 400
        
    if db.users.find_one({"email": email}):
        return jsonify({"message": "Email already exists"}), 400
        
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    db.users.insert_one({
        "name": name,
        "email": email,
        "password": hashed_password,
        "role": "Employee",
        "walletBalance": 0
    })
    
    socketio.emit('employeeAdded', {"message": "New employee added"})
    return jsonify({"message": "Employee created successfully"}), 201

@admin_bp.route('/employees', methods=['GET'])
@token_required(['Admin'])
def get_employees(current_user):
    employees = list(db.users.find({"role": "Employee"}, {"password": 0}))
    for emp in employees:
        emp['_id'] = str(emp['_id'])
    return jsonify(employees), 200

@admin_bp.route('/employees/<id>', methods=['DELETE'])
@token_required(['Admin'])
def delete_employee(current_user, id):
    db.users.delete_one({"_id": ObjectId(id), "role": "Employee"})
    socketio.emit('employeeRemoved', {"employeeId": id})
    return jsonify({"message": "Employee removed"}), 200

@admin_bp.route('/weekly-menu', methods=['GET'])
@token_required(['Admin', 'Student'])
def get_weekly_menu(current_user):
    weekly = db.weekly_menu.find_one({"_id": "default"})
    if not weekly:
        # Initial scaffold
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        empty_day = {
            "Morning Tea": {"name": "", "price": 0}, "Morning Egg": {"name": "", "price": 0},
            "Tiffin": {"name": "", "price": 0},
            "Lunch": {"name": "", "price": 0}, "Lunch Egg": {"name": "", "price": 0},
            "Evening Tea": {"name": "", "price": 0}, "Evening Snacks": {"name": "", "price": 0},
            "Dinner": {"name": "", "price": 0}, "Dinner Egg": {"name": "", "price": 0}
        }
        weekly = {"_id": "default", **{day: empty_day.copy() for day in days}}
        db.weekly_menu.insert_one(weekly)
    return jsonify(weekly), 200

@admin_bp.route('/weekly-menu', methods=['PUT'])
@token_required(['Admin'])
def update_weekly_menu(current_user):
    data = request.json
    db.weekly_menu.update_one({"_id": "default"}, {"$set": data}, upsert=True)
    socketio.emit('menuUpdated', {"type": "weekly"})
    return jsonify({"message": "Weekly menu updated successfully"}), 200

@admin_bp.route('/menu', methods=['POST'])
@token_required(['Admin'])
def set_menu(current_user):
    data = request.json
    date_str = data.get('date')
    items = data.get('items')
    deadline = data.get('deadline')
    is_festival = data.get('isFestival', False)
    festival_name = data.get('festivalName', '')
    description = data.get('description', '')
    
    if not date_str or not items or not deadline: return jsonify({"message": "Required fields missing"}), 400
    
    update_doc = {
        "date": date_str, 
        "items": items, 
        "deadline": deadline, 
        "isFestival": is_festival,
        "festivalName": festival_name,
        "description": description,
        "createdAt": datetime.now()
    }
    db.menus.update_one({"date": date_str}, {"$set": update_doc}, upsert=True)
    socketio.emit('menuUpdated', {"type": "daily", "date": date_str})
    return jsonify({"message": "Daily menu override saved"}), 200

@admin_bp.route('/menu/<date>', methods=['GET'])
@token_required(['Admin', 'Student', 'Employee'])
def get_menu(current_user, date):
    menu = db.menus.find_one({"date": date}, {"_id": 0})
    
    if not menu:
        try:
            day_name = datetime.strptime(date, "%Y-%m-%d").strftime("%A")
            weekly = db.weekly_menu.find_one({"_id": "default"})
            if weekly and day_name in weekly:
                menu = {
                    "date": date,
                    "items": weekly[day_name],
                    "deadline": "19:00"
                }
                # Removed: db.menus.insert_one({**menu, "createdAt": datetime.now()})
                # This prevents deleted menus from re-appearing in the "Published" list.
        except Exception as ex:
            print("Menu fallback error:", ex)
            
    if not menu:
        return jsonify({"message": "Menu not found for this date"}), 404

    # Filter empty items for students/employees to avoid showing placeholders
    if current_user['role'] in ['Student', 'Employee']:
        filtered_items = {}
        for meal_type, data in menu.get('items', {}).items():
            # If name is present and price > 0, include it
            if data.get('name') and int(data.get('price', 0)) > 0:
                filtered_items[meal_type] = data
        menu['items'] = filtered_items

    return jsonify(menu), 200

@admin_bp.route('/menu/<date>', methods=['DELETE'])
@token_required(['Admin'])
def delete_menu(current_user, date):
    res = db.menus.delete_one({"date": date})
    if res.deleted_count > 0:
        socketio.emit('menuUpdated', {"type": "daily", "date": date, "action": "deleted"})
        return jsonify({"message": f"Menu for {date} deleted successfully"}), 200
    return jsonify({"message": "Menu not found"}), 404

@admin_bp.route('/menus', methods=['GET'])
@token_required(['Admin'])
def get_all_menus(current_user):
    menus = list(db.menus.find({}, {"_id": 0}).sort("date", -1))
    return jsonify(menus), 200

@admin_bp.route('/complaints', methods=['GET'])
@token_required(['Admin'])
def get_complaints(current_user):
    complaints = list(db.complaints.find({}))
    results = []
    
    badge_priority = {"diamond": 3, "gold": 2, "silver": 1, "none": 0}
    
    for cp in complaints:
        cp['_id'] = str(cp['_id'])
        s_id = cp.get('studentId', '')
        cp['studentId'] = str(s_id)
        
        # Fetch student badge for priority sorting
        student_badge = "none"
        if s_id:
            student = db.users.find_one({"_id": ObjectId(s_id)})
            if student:
                student_badge = student.get('badge', 'none')
        
        cp['badge'] = student_badge
        cp['priority'] = badge_priority.get(student_badge, 0)
        results.append(cp)
        
    # Sort by priority desc, then createdAt desc
    results.sort(key=lambda x: (x['priority'], x.get('createdAt', '')), reverse=True)
    return jsonify(results), 200

@admin_bp.route('/complaints/<id>/resolve', methods=['PUT'])
@token_required(['Admin'])
def resolve_complaint(current_user, id):
    db.complaints.update_one({"_id": ObjectId(id)}, {"$set": {"status": "Resolved"}})
    socketio.emit('complaintUpdated', {"complaintId": id, "status": "Resolved"})
    return jsonify({"message": "Complaint resolved"}), 200

@admin_bp.route('/students', methods=['GET'])
@token_required(['Admin'])
def get_students(current_user):
    students = list(db.users.find({"role": "Student"}, {"password": 0}))
    for s in students: s['_id'] = str(s['_id'])
    return jsonify(students), 200

@admin_bp.route('/students/<id>/block', methods=['PUT'])
@token_required(['Admin'])
def toggle_block_student(current_user, id):
    student = db.users.find_one({"_id": ObjectId(id), "role": "Student"})
    if not student:
        return jsonify({"message": "Student not found"}), 404

    data = request.get_json(silent=True) or {}
    new_blocked = not student.get('isBlocked', False)
    reason = data.get('reason', '')

    db.users.update_one({"_id": ObjectId(id)}, {"$set": {
        "isBlocked": new_blocked,
        "blockReason": reason if new_blocked else ""
    }})

    if new_blocked:
        socketio.emit('studentBlocked', {"userId": id, "reason": reason})
    else:
        socketio.emit('studentUnblocked', {"userId": id})

    action = "blocked" if new_blocked else "unblocked"
    return jsonify({"message": f"Student {student['name']} has been {action}.", "isBlocked": new_blocked}), 200

@admin_bp.route('/bookings', methods=['GET'])
@token_required(['Admin'])
def get_bookings(current_user):
    bookings = list(db.bookings.find({}).sort("createdAt", -1))
    for b in bookings: b['_id'] = str(b['_id'])
    return jsonify(bookings), 200

@admin_bp.route('/analytics', methods=['GET'])
@token_required(['Admin'])
def get_analytics(current_user):
    # Mocking analytics data format for Recharts
    attendance = [
        {"name": "Mon", "tiffin": 120, "lunch": 200, "dinner": 190},
        {"name": "Tue", "tiffin": 130, "lunch": 210, "dinner": 195},
        {"name": "Wed", "tiffin": 110, "lunch": 195, "dinner": 180},
        {"name": "Thu", "tiffin": 140, "lunch": 220, "dinner": 200},
        {"name": "Fri", "tiffin": 105, "lunch": 180, "dinner": 160},
    ]
    return jsonify({"attendance": attendance}), 200
