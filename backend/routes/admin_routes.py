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

@admin_bp.route('/bookings/collection', methods=['GET'])
@token_required(['Admin'])
def get_daily_collection(current_user):
    date = request.args.get('date')
    if not date:
        return jsonify({"message": "Date is required"}), 400
        
    bookings = list(db.bookings.find({"date": date}))
    
    collection_map = {}
    total_revenue = 0
    total_quantity = 0
    
    for b in bookings:
        is_guest = b.get('isGuest', False)
        meal_qtys = b.get('mealQty', {})
        item_prices = b.get('itemPrices', {})
        meals_list = b.get('meals', [])  # e.g. ["Lunch", "Dinner", "Morning Egg x2"]
        
        # Build a comprehensive section->qty mapping from BOTH mealQty and meals array
        # mealQty is the authoritative source for qty, but meals array tells us WHICH meals were booked
        section_qty = {}
        
        # First pass: parse the meals array to find all booked sections
        for meal_str in meals_list:
            # meal_str could be "Lunch" or "Morning Egg x2"
            if ' x' in meal_str:
                parts = meal_str.rsplit(' x', 1)
                base_name = parts[0].strip()
                try:
                    qty = int(parts[1])
                except:
                    qty = 1
            else:
                base_name = meal_str.strip()
                qty = 1
            section_qty[base_name] = qty
        
        # Second pass: override with mealQty if present (it is the authoritative source)
        for section, qty_val in meal_qtys.items():
            try:
                section_qty[section] = int(qty_val)
            except:
                pass
        
        # Now aggregate
        for section, qty in section_qty.items():
            price = int(item_prices.get(section, 0))
            if is_guest:
                price = int(price * 1.5)
                
            cost = price * qty
            
            if section not in collection_map:
                collection_map[section] = {"section": section, "quantity": 0, "price": price, "total": 0}
                
            collection_map[section]["quantity"] += qty
            collection_map[section]["total"] += cost
            total_quantity += qty
            total_revenue += cost
            
    # Sort or predefined order
    ORDER = ["Morning Tea/Milk", "Morning Egg", "Morning Banana", "Tiffin", "Lunch Veg", "Lunch Non-Veg", "Lunch Egg", "Evening Tea/Milk", "Snacks", "Dinner Veg", "Dinner Non-Veg", "Dinner Egg"]
    
    sorted_data = []
    for section in ORDER:
        if section in collection_map:
            sorted_data.append(collection_map[section])
            
    for k, v in collection_map.items():
        if k not in ORDER:
            sorted_data.append(v)
            
    return jsonify({
        "date": date,
        "data": sorted_data,
        "totalQuantity": total_quantity,
        "totalRevenue": total_revenue
    }), 200




@admin_bp.route('/overview', methods=['GET'])
@token_required(['Admin'])
def get_full_overview(current_user):
    today = datetime.now().date()
    today_str = str(today)
    yesterday = today - timedelta(days=1)
    yesterday_str = str(yesterday)

    MEALS = ["Morning Tea/Milk", "Morning Egg", "Morning Banana", "Tiffin", "Lunch Veg", "Lunch Non-Veg", "Lunch Egg", "Evening Tea/Milk", "Snacks", "Dinner Veg", "Dinner Non-Veg", "Dinner Egg"]

    today_bookings = list(db.bookings.find({"date": today_str}))
    yesterday_bookings_count = db.bookings.count_documents({"date": yesterday_str})

    meal_breakdown = {}
    total_completed = 0
    total_pending = 0
    for meal in MEALS:
        booked = 0
        completed = 0
        for b in today_bookings:
            meals_list = b.get("meals", [])
            if any(meal in m for m in meals_list):
                booked += 1
                status_map = b.get("status", {})
                if isinstance(status_map, dict):
                    if status_map.get(meal) == "Completed":
                        completed += 1
                elif isinstance(status_map, str) and status_map == "Completed":
                    completed += 1
        meal_breakdown[meal] = {"booked": booked, "completed": completed, "pending": booked - completed}
        total_completed += completed
        total_pending += (booked - completed)

    total_bookings_today = len(today_bookings)

    rev_pipeline = [
        {"$match": {"date": today_str}},
        {"$group": {"_id": None, "total": {"$sum": "$price"}}}
    ]
    rev_agg = list(db.bookings.aggregate(rev_pipeline))
    today_revenue = rev_agg[0]["total"] if rev_agg else 0

    yesterday_rev_pipeline = [
        {"$match": {"date": yesterday_str}},
        {"$group": {"_id": None, "total": {"$sum": "$price"}}}
    ]
    yesterday_rev_agg = list(db.bookings.aggregate(yesterday_rev_pipeline))
    yesterday_revenue = yesterday_rev_agg[0]["total"] if yesterday_rev_agg else 0

    all_complaints = list(db.complaints.find({}))
    pending_complaints = [c for c in all_complaints if c.get("status") == "Pending"]
    ratings = [c.get("rating", 0) for c in all_complaints if c.get("rating")]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

    latest_feedbacks = []
    for c in sorted(all_complaints, key=lambda x: x.get("createdAt", ""), reverse=True)[:5]:
        latest_feedbacks.append({
            "id": str(c["_id"]),
            "message": c.get("message", "")[:80],
            "studentName": c.get("studentName", "Anonymous"),
            "status": c.get("status", "Pending"),
            "rating": c.get("rating", 0)
        })

    total_students = db.users.count_documents({"role": "Student"})
    blocked_students = db.users.count_documents({"role": "Student", "isBlocked": True})
    badge_counts = {
        "diamond": db.users.count_documents({"role": "Student", "badge": "diamond"}),
        "gold": db.users.count_documents({"role": "Student", "badge": "gold"}),
        "silver": db.users.count_documents({"role": "Student", "badge": "silver"})
    }

    top_students = []
    for s in db.users.find({"role": "Student"}, {"name": 1, "studentId": 1, "badge": 1, "totalBookings": 1}).sort("totalBookings", -1).limit(5):
        top_students.append({
            "name": s.get("name", ""),
            "studentId": s.get("studentId", ""),
            "badge": s.get("badge", "none"),
            "totalBookings": s.get("totalBookings", 0)
        })

    employees = list(db.users.find({"role": "Employee"}, {"name": 1, "email": 1}))
    emp_performance = []
    for e in employees:
        served = db.bookings.count_documents({"verifiedBy": str(e["_id"])})
        emp_performance.append({
            "name": e.get("name", "Unknown"),
            "email": e.get("email", ""),
            "mealsServed": served,
            "errors": 0
        })

    today_menu = db.menus.find_one({"date": today_str}, {"_id": 0})
    menu_status = "Published" if today_menu else "Not Published"

    active_poll = db.polls.find_one({"status": "active"})
    poll_data = None
    if active_poll:
        options = active_poll.get("options", [])
        def count_votes(o):
            v = o.get("votes", 0)
            return v if isinstance(v, int) else len(v)
        total_votes = sum(count_votes(o) for o in options)
        leading = max(options, key=count_votes, default={}) if options else {}
        poll_data = {
            "question": active_poll.get("title", active_poll.get("question", "")),
            "totalVotes": total_votes,
            "leading": leading.get("item", leading.get("text", "N/A")),
            "leadingVotes": count_votes(leading) if leading else 0,
            "options": [
                {"label": o.get("item", o.get("text", "")), "votes": count_votes(o)}
                for o in options
            ]
        }

    wallet_pipeline = [
        {"$match": {"role": "Student"}},
        {"$group": {"_id": None, "total": {"$sum": "$walletBalance"}}}
    ]
    wallet_agg = list(db.users.aggregate(wallet_pipeline))
    total_wallet = wallet_agg[0]["total"] if wallet_agg else 0

    weekly_chart = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        count = db.bookings.count_documents({"date": str(d)})
        weekly_chart.append({"day": d.strftime("%a"), "bookings": count})

    meal_groups = {
        "Breakfast": sum(meal_breakdown.get(m, {}).get("booked", 0) for m in ["Morning Tea/Milk", "Morning Egg", "Morning Banana", "Tiffin"]),
        "Lunch": sum(meal_breakdown.get(m, {}).get("booked", 0) for m in ["Lunch Veg", "Lunch Non-Veg", "Lunch Egg"]),
        "Snacks": sum(meal_breakdown.get(m, {}).get("booked", 0) for m in ["Evening Tea/Milk", "Snacks"]),
        "Dinner": sum(meal_breakdown.get(m, {}).get("booked", 0) for m in ["Dinner Veg", "Dinner Non-Veg", "Dinner Egg"]),
    }

    completion_rate = (total_completed / total_bookings_today * 100) if total_bookings_today > 0 else 100
    feedback_score = (avg_rating / 5.0 * 100) if avg_rating > 0 else 80
    pending_penalty = min(len(pending_complaints) * 2, 30)
    health_score = round(completion_rate * 0.5 + feedback_score * 0.3 + (100 - pending_penalty) * 0.2)

    return jsonify({
        "summary": {
            "totalStudents": total_students,
            "totalBookingsToday": total_bookings_today,
            "yesterdayBookings": yesterday_bookings_count,
            "mealsCompleted": total_completed,
            "mealsPending": total_pending,
            "todayRevenue": today_revenue,
            "yesterdayRevenue": yesterday_revenue,
            "avgRating": avg_rating,
            "blockedStudents": blocked_students
        },
        "mealBreakdown": [{"meal": m, **meal_breakdown[m]} for m in MEALS],
        "weeklyChart": weekly_chart,
        "mealDistribution": [{"name": k, "value": v} for k, v in meal_groups.items()],
        "feedbackSummary": {
            "avgRating": avg_rating,
            "pendingCount": len(pending_complaints),
            "latest": latest_feedbacks
        },
        "badgeSummary": badge_counts,
        "topStudents": top_students,
        "employeePerformance": emp_performance,
        "menuStatus": menu_status,
        "todayMenu": today_menu,
        "pollData": poll_data,
        "walletSummary": {
            "totalWalletBalance": total_wallet,
            "todayRevenue": today_revenue,
            "totalTransactions": db.bookings.count_documents({})
        },
        "alerts": {
            "blockedStudents": blocked_students,
            "pendingComplaints": len(pending_complaints)
        },
        "healthScore": health_score
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
            "Morning Tea/Milk": {"name": "", "price": 0}, 
            "Morning Egg": {"name": "", "price": 0},
            "Morning Banana": {"name": "", "price": 0},
            "Tiffin": {"name": "", "price": 0},
            "Lunch Veg": {"name": "", "price": 0}, 
            "Lunch Non-Veg": {"name": "", "price": 0}, 
            "Lunch Egg": {"name": "", "price": 0},
            "Evening Tea/Milk": {"name": "", "price": 0}, 
            "Snacks": {"name": "", "price": 0},
            "Dinner Veg": {"name": "", "price": 0}, 
            "Dinner Non-Veg": {"name": "", "price": 0}, 
            "Dinner Egg": {"name": "", "price": 0}
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
    # Ensure the deleted flag is removed when re-publishing a menu
    db.menus.update_one(
        {"date": date_str},
        {"$set": update_doc, "$unset": {"deleted": ""}},
        upsert=True
    )
    socketio.emit('menuUpdated', {"type": "daily", "date": date_str})
    
    # Instantly trigger the auto-order engine so it books meals within milliseconds of publish
    from background_tasks import process_auto_orders
    import threading
    threading.Thread(target=process_auto_orders, daemon=True).start()
    
    return jsonify({"message": "Daily menu override saved"}), 200

@admin_bp.route('/menu/<date>', methods=['GET'])
@token_required(['Admin', 'Student', 'Employee'])
def get_menu(current_user, date):
    menu = db.menus.find_one({"date": date}, {"_id": 0})
    is_student = current_user['role'] == 'Student'

    # If the menu was explicitly deleted by admin, show nothing
    if menu and menu.get('deleted'):
        return jsonify({"message": "Menu not found for this date"}), 404

    # Weekly template fallback: ONLY for Admin and Employee — NOT for students.
    # Students must only see menus that admin has explicitly published for their date.
    if not menu and not is_student:
        try:
            day_name = datetime.strptime(date, "%Y-%m-%d").strftime("%A")
            weekly = db.weekly_menu.find_one({"_id": "default"})
            if weekly and day_name in weekly:
                menu = {
                    "date": date,
                    "items": weekly[day_name],
                    "deadline": "23:59"
                }
        except Exception as ex:
            print("Menu fallback error:", ex)

    if not menu:
        return jsonify({"message": "Menu not found for this date"}), 404

    # Enforce booking deadline for students
    if is_student:
        now = datetime.now()
        deadline_str = menu.get('deadline')

        if deadline_str:
            try:
                if 'T' in deadline_str:
                    deadline_dt = datetime.strptime(deadline_str, "%Y-%m-%dT%H:%M")
                else:
                    deadline_time = datetime.strptime(deadline_str, "%H:%M").time()
                    deadline_dt = datetime.combine(datetime.strptime(date, "%Y-%m-%d").date(), deadline_time)

                if now > deadline_dt:
                    return jsonify({"message": "Booking deadline has passed for this menu"}), 404
            except Exception as e:
                print(f"Error parsing deadline in get_menu: {e}")

    # Filter out empty/placeholder items for students and employees
    if current_user['role'] in ['Student', 'Employee']:
        filtered_items = {}
        for meal_type, data in menu.get('items', {}).items():
            if data.get('name') and int(data.get('price', 0)) > 0:
                filtered_items[meal_type] = data
        menu['items'] = filtered_items

    return jsonify(menu), 200

@admin_bp.route('/menu/<date>', methods=['DELETE'])
@token_required(['Admin'])
def delete_menu(current_user, date):
    # Mark as deleted instead of physically removing, so weekly fallback is suppressed
    res = db.menus.update_one(
        {"date": date},
        {"$set": {"date": date, "deleted": True, "items": {}}},
        upsert=True
    )
    if res.matched_count > 0 or res.upserted_id:
        socketio.emit('menuUpdated', {"type": "daily", "date": date, "action": "deleted"})
        return jsonify({"message": f"Menu for {date} deleted successfully"}), 200
    return jsonify({"message": "Menu not found"}), 404

@admin_bp.route('/menus', methods=['GET'])
@token_required(['Admin'])
def get_all_menus(current_user):
    # Exclude menus marked as deleted from the admin published list
    menus = list(db.menus.find({"deleted": {"$ne": True}}, {"_id": 0}).sort("date", -1))
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

@admin_bp.route('/complaints/<id>', methods=['DELETE'])
@token_required(['Admin'])
def delete_complaint(current_user, id):
    db.complaints.delete_one({"_id": ObjectId(id)})
    socketio.emit('complaintUpdated', {"complaintId": id, "status": "Deleted"})
    return jsonify({"message": "Complaint permanently deleted"}), 200

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

@admin_bp.route('/students/<id>', methods=['DELETE'])
@token_required(['Admin'])
def delete_student(current_user, id):
    student = db.users.find_one({"_id": ObjectId(id), "role": "Student"})
    if not student:
        return jsonify({"message": "Student not found"}), 404
        
    student_email = student.get('email')
    
    # Cascading Deletions
    db.users.delete_one({"_id": ObjectId(id)})
    db.bookings.delete_many({"studentId": id})
    db.complaints.delete_many({"studentId": id})
    db.notifications.delete_many({"studentId": id})
    
    if student_email:
        db.transactions.delete_many({"email": student_email})
        
    # Cleanup poll votes
    db.polls.update_many({}, {
        "$pull": {"votedBy": id},
        "$unset": {f"studentVotes.{id}": ""}
    })
    
    return jsonify({"message": f"Student {student.get('name')} and all associated data have been permanently deleted."}), 200

@admin_bp.route('/bookings', methods=['GET'])
@token_required(['Admin'])
def get_bookings(current_user):
    # Sort by createdAt descending, use _id as fallback for identical creation times or missing fields
    bookings = list(db.bookings.find({}).sort([("createdAt", -1), ("_id", -1)]))
    for b in bookings: b['_id'] = str(b['_id'])
    return jsonify(bookings), 200

@admin_bp.route('/analytics/bookings', methods=['GET'])
@token_required(['Admin'])
def get_analytics_bookings(current_user):
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')
    domain = request.args.get('domain', 'All Bookings')
    
    metric = request.args.get('metric', 'bookings')
    
    if not start_date or not end_date:
        return jsonify({"message": "startDate and endDate are required"}), 400
        
    bookings = list(db.bookings.find({
        "date": {"$gte": start_date, "$lte": end_date}
    }))
    
    # We will build a map of { date: { total: int, domains: { ... } } }
    data_map = {}
    
    # Initialize the date range with 0 to ensure continuous charts
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        delta = timedelta(days=1)
        while start_dt <= end_dt:
            d_str = start_dt.strftime("%Y-%m-%d")
            data_map[d_str] = {"date": d_str, "total": 0, "domains": {}}
            start_dt += delta
    except Exception as e:
        return jsonify({"message": "Invalid date format, use YYYY-MM-DD"}), 400

    total_bookings = 0
    highest_day = {"date": None, "count": -1}
    lowest_day = {"date": None, "count": float('inf')}
    
    for b in bookings:
        b_date = b.get('date')
        if b_date not in data_map:
            continue
            
        meal_qtys = b.get('mealQty', {})
        meals_list = b.get('meals', [])
        
        section_qty = {}
        for meal_str in meals_list:
            if ' x' in meal_str:
                parts = meal_str.rsplit(' x', 1)
                base_name = parts[0].strip()
                try:
                    qty = int(parts[1])
                except:
                    qty = 1
            else:
                base_name = meal_str.strip()
                qty = 1
            section_qty[base_name] = qty
            
        for section, qty_val in meal_qtys.items():
            try:
                section_qty[section] = int(qty_val)
            except:
                pass
                
        for section, qty in section_qty.items():
            if domain != 'All Bookings' and domain != section:
                continue # Filter out if not matching domain
            
            value = qty
            if metric == 'revenue':
                price = int(b.get('itemPrices', {}).get(section, 0))
                if b.get('isGuest', False): 
                    price = int(price * 1.5)
                value = qty * price
                
            data_map[b_date]["total"] += value
            total_bookings += value
            
            if section not in data_map[b_date]["domains"]:
                data_map[b_date]["domains"][section] = 0
            data_map[b_date]["domains"][section] += value

    data_list = sorted(list(data_map.values()), key=lambda x: x['date'])
    
    for d in data_list:
        if d['total'] > highest_day['count']:
            highest_day = {"date": d['date'], "count": d['total']}
        if d['total'] < lowest_day['count']:
            lowest_day = {"date": d['date'], "count": d['total']}
            
    if lowest_day['count'] == float('inf'):
        lowest_day = {"date": "N/A", "count": 0}
    if highest_day['count'] == -1:
        highest_day = {"date": "N/A", "count": 0}
        
    days_count = len(data_list)
    average = round(total_bookings / days_count) if days_count > 0 else 0
    
    return jsonify({
        "data": data_list,
        "summary": {
            "totalBookings": total_bookings,
            "highestDay": highest_day['date'],
            "highestCount": highest_day['count'],
            "lowestDay": lowest_day['date'],
            "lowestCount": lowest_day['count'],
            "average": average
        }
    }), 200
