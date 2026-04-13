from flask import Blueprint, request, jsonify
from middleware import token_required
from database import db
from bson.objectid import ObjectId
import datetime
from socket_instance import socketio

employee_bp = Blueprint('employee_bp', __name__)

@employee_bp.route('/bookings', methods=['GET'])
@token_required(['Employee'])
def get_bookings(current_user):
    date_str = request.args.get('date', datetime.datetime.now().strftime("%Y-%m-%d"))
    section = request.args.get('section')
    
    query = {"date": date_str}
    bookings = list(db.bookings.find(query).sort("createdAt", -1))
    
    result = []
    for b in bookings:
        b['_id'] = str(b['_id'])
        if section:
            actual_key = next((k for k in b.get('status', {}).keys() if k.lower() == section.lower()), None)
            if actual_key:
                status = b['status'][actual_key]
                # If Booked, treat as Pending
                if status == "Booked": status = "Pending"
                result.append({
                    "studentName": b.get('studentName', ''),
                    "studentId": b.get('studentRollId', b.get('studentId', '')),
                    "status": status,
                    "bookingId": b['_id'],
                    "qty": b.get('mealQty', {}).get(actual_key, 1)
                })
        else:
            result.append(b)
            
    return jsonify(result), 200

@employee_bp.route('/verify', methods=['POST'])
@token_required(['Employee'])
def verify_student(current_user):
    data = request.json
    student_id = data.get('studentId')
    date_str = data.get('date', datetime.datetime.now().strftime("%Y-%m-%d"))
    section = data.get('section')
    
    if not student_id or not section:
        return jsonify({"message": "Student ID and Section required"}), 400
        
    student = db.users.find_one({"studentId": student_id, "role": "Student"})
    if not student:
        return jsonify({"message": "Student not found"}), 404
        
    booking = db.bookings.find_one({"studentId": str(student['_id']), "date": date_str})
    if not booking:
        return jsonify({"message": "No booking found for this student on selected date"}), 404
        
    actual_meal_key = next((k for k in booking.get('status', {}).keys() if k.lower() == section.lower()), None)
    if not actual_meal_key:
        return jsonify({"message": f"Student did not book {section}"}), 404
        
    status = booking['status'][actual_meal_key]
    if status == "Booked": status = "Pending"
        
    return jsonify({
        "studentName": student['name'],
        "studentId": student['studentId'],
        "mealSection": actual_meal_key,
        "status": status,
        "bookingId": str(booking['_id'])
    }), 200

@employee_bp.route('/complete', methods=['POST'])
@token_required(['Employee'])
def mark_complete(current_user):
    data = request.json
    booking_id = data.get('bookingId')
    section = data.get('section')
    
    if not booking_id or not section:
        return jsonify({"message": "Missing fields"}), 400
        
    booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        return jsonify({"message": "Booking not found"}), 404
        
    actual_meal_key = next((k for k in booking.get('status', {}).keys() if k.lower() == section.lower()), None)
    if not actual_meal_key:
        return jsonify({"message": f"Student did not book {section}"}), 400
        
    if booking['status'][actual_meal_key] == "Completed":
        return jsonify({"message": "Already Completed"}), 400
        
    update_field = f"status.{actual_meal_key}"
    db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": {update_field: "Completed"}})
    
    socketio.emit('mealStatusUpdate', {"bookingId": booking_id, "mealType": actual_meal_key, "status": "Completed"})
    return jsonify({"message": f"{section} marked as Completed!"}), 200

@employee_bp.route('/undo', methods=['POST'])
@token_required(['Employee'])
def mark_undo(current_user):
    data = request.json
    booking_id = data.get('bookingId')
    section = data.get('section')
    
    if not booking_id or not section:
        return jsonify({"message": "Missing fields"}), 400
        
    booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        return jsonify({"message": "Booking not found"}), 404
        
    actual_meal_key = next((k for k in booking.get('status', {}).keys() if k.lower() == section.lower()), None)
    if not actual_meal_key:
        return jsonify({"message": f"Student did not book {section}"}), 400
        
    update_field = f"status.{actual_meal_key}"
    db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": {update_field: "Pending"}})
    
    socketio.emit('mealStatusUpdate', {"bookingId": booking_id, "mealType": actual_meal_key, "status": "Pending"})
    return jsonify({"message": f"{section} marked as Pending!"}), 200

@employee_bp.route('/stats', methods=['GET'])
@token_required(['Employee', 'Admin'])
def get_daily_stats(current_user):
    date_str = request.args.get('date', datetime.datetime.now().strftime("%Y-%m-%d"))
    section = request.args.get('section')
    
    bookings = list(db.bookings.find({"date": date_str}))
    
    summary = {"total": 0, "completed": 0, "pending": 0}
    meal_stats = {
        "Morning Tea/Milk": {"total": 0, "completed": 0, "pending": 0},
        "Morning Egg": {"total": 0, "completed": 0, "pending": 0},
        "Morning Banana": {"total": 0, "completed": 0, "pending": 0},
        "Tiffin": {"total": 0, "completed": 0, "pending": 0},
        "Lunch Veg": {"total": 0, "completed": 0, "pending": 0},
        "Lunch Non-Veg": {"total": 0, "completed": 0, "pending": 0},
        "Lunch Egg": {"total": 0, "completed": 0, "pending": 0},
        "Evening Tea/Milk": {"total": 0, "completed": 0, "pending": 0},
        "Snacks": {"total": 0, "completed": 0, "pending": 0},
        "Dinner Veg": {"total": 0, "completed": 0, "pending": 0},
        "Dinner Non-Veg": {"total": 0, "completed": 0, "pending": 0},
        "Dinner Egg": {"total": 0, "completed": 0, "pending": 0}
    }
    
    for b in bookings:
        for meal, status in b.get('status', {}).items():
            if status == "Booked": status = "Pending"
            
            # Check section specific
            if section and meal.lower() == section.lower():
                summary['total'] += 1
                if status == "Completed":
                    summary['completed'] += 1
                else:
                    summary['pending'] += 1

            # Keeping general stats for admin compatibility
            for cat in meal_stats.keys():
                if cat.lower() in meal.lower():
                    meal_stats[cat]["total"] += 1
                    if status == "Completed":
                        meal_stats[cat]["completed"] += 1
                    else:
                        meal_stats[cat]["pending"] += 1
    
    if not section:
        # Calculate summary across all items if no specific section
        for b in bookings:
            for meal, status in b.get('status', {}).items():
                if status == "Booked": status = "Pending"
                summary['total'] += 1
                if status == "Completed":
                    summary['completed'] += 1
                else:
                    summary['pending'] += 1

    return jsonify({
        "summary": summary,
        "meals": meal_stats
    }), 200

@employee_bp.route('/analysis', methods=['GET'])
@token_required(['Employee', 'Admin'])
def get_analysis_data(current_user):
    meal_type = request.args.get('mealType', 'All')
    
    start_str = request.args.get('startDate')
    end_str = request.args.get('endDate')
    
    if start_str and end_str:
        start_date = datetime.datetime.strptime(start_str, "%Y-%m-%d")
        end_date = datetime.datetime.strptime(end_str, "%Y-%m-%d")
        if start_date > end_date:
            start_date, end_date = end_date, start_date
            
        days = (end_date - start_date).days + 1
        dates = [(start_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    else:
        days = int(request.args.get('days', 7))
        end_date_str = request.args.get('endDate')
        if end_date_str:
            end_date = datetime.datetime.strptime(end_date_str, "%Y-%m-%d")
        else:
            end_date = datetime.datetime.now()
            
        dates = [(end_date - datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days-1, -1, -1)]
    
    query = {"date": {"$in": dates}}
    bookings = list(db.bookings.find(query))
    
    data = []
    for d in dates:
        count = 0
        for b in bookings:
            if b.get("date") == d:
                for meal, status in b.get('status', {}).items():
                    if meal_type != "All" and meal_type.lower() != meal.lower():
                        continue
                    count += 1
        data.append({"date": d, "count": count})
        
    return jsonify(data), 200
