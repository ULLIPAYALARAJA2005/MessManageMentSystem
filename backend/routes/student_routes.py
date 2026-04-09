from flask import Blueprint, request, jsonify
from middleware import token_required
from database import db
from bson.objectid import ObjectId
import datetime
from socket_instance import socketio
from badge_logic import update_student_stats

student_bp = Blueprint('student_bp', __name__)

@student_bp.route('/me', methods=['GET'])
@token_required(['Student'])
def get_me(current_user):
    return jsonify({
        "name": current_user['name'],
        "walletBalance": current_user.get('walletBalance', 0),
        "studentId": current_user.get('studentId', ''),
        "phone": current_user.get('phone', ''),
        "photoBase64": current_user.get('photoBase64', ''),
        "email": current_user.get('email', ''),
        "badge": current_user.get('badge', 'none'),
        "domainBadges": current_user.get('domainBadges', {}),
        "totalBookings": current_user.get('totalBookings', 0),
        "isBlocked": current_user.get('isBlocked', False),
        "blockReason": current_user.get('blockReason', '')
    }), 200
    
@student_bp.route('/profile', methods=['PUT'])
@token_required(['Student'])
def update_profile(current_user):
    data = request.json
    update_fields = {}
    if 'phone' in data:
        update_fields['phone'] = data['phone']
    if 'photoBase64' in data:
        update_fields['photoBase64'] = data['photoBase64']
        
    if update_fields:
        db.users.update_one({"_id": current_user['_id']}, {"$set": update_fields})
        
    return jsonify({"message": "Profile updated successfully"}), 200

@student_bp.route('/book', methods=['POST'])
@token_required(['Student'])
def book_meal(current_user):
    import random
    data = request.json
    date_str = data.get('date')
    meals = data.get('meals') # e.g. ["Morning Tea", "Morning Egg x2"]
    meal_qty_map = data.get('mealQty', {}) # e.g. {"Morning Egg": 2}
    is_guest = data.get('isGuest', False)
    
    if not date_str or not meals:
        return jsonify({"message": "Date and meals required"}), 400
        
    menu = db.menus.find_one({"date": date_str})
    if not menu:
        return jsonify({"message": "Menu not yet published for this date"}), 400
    if menu:
        now = datetime.datetime.now()
        if "T" in menu.get('deadline', ''):
            deadline_datetime = datetime.datetime.strptime(menu['deadline'], "%Y-%m-%dT%H:%M")
        else:
            # Fallback for old %H:%M format
            deadline_time = datetime.datetime.strptime(menu.get('deadline', '19:00'), "%H:%M").time()
            deadline_datetime = datetime.datetime.combine(datetime.datetime.strptime(date_str, "%Y-%m-%d").date(), deadline_time)
            deadline_datetime = deadline_datetime - datetime.timedelta(days=1)
            
        if now > deadline_datetime:
            return jsonify({
                "message": f"Booking deadline has passed for this menu. Deadline was {deadline_datetime.strftime('%Y-%m-%d %H:%M')}"
            }), 400
        
    total_price = 0
    item_codes = {}
    item_prices = {}
    
    # Standardize meal names and calculate price
    for meal_entry in meals:
        # Extract base meal name (e.g. "Morning Egg x2" -> "Morning Egg")
        base_name = meal_entry.split(' x')[0]
        if base_name in menu['items']:
            price = int(menu['items'][base_name].get('price', 0))
            qty = int(meal_qty_map.get(base_name, 1))
            total_price += (price * qty)
            item_prices[base_name] = price
            # Generate a 4-digit code for each item
            item_codes[base_name] = str(random.randint(1000, 9999))
            
    if is_guest:
        total_price = int(total_price * 1.5)
        
    if current_user.get('walletBalance', 0) < total_price:
        return jsonify({"message": f"Insufficient wallet balance. Total: ₹{total_price}"}), 400
        
    db.users.update_one({"_id": current_user['_id']}, {"$inc": {"walletBalance": -total_price}})
    
    booking = {
        "studentId": str(current_user['_id']),
        "studentRollId": current_user.get('studentId', ''),
        "studentName": current_user['name'],
        "date": date_str,
        "meals": meals,
        "mealQty": meal_qty_map,
        "codes": item_codes,
        "itemPrices": item_prices,
        "isGuest": is_guest,
        "price": total_price,
        "status": {base_name: "Booked" for base_name in item_codes.keys()},
        "createdAt": datetime.datetime.now()
    }
    db.bookings.insert_one(booking)
    
    # Auto-update badge and stats after booking
    update_student_stats(str(current_user['_id']))
    
    socketio.emit('bookingCreated', {"bookingId": str(booking['_id'])})
    return jsonify({"message": "Meal booked successfully!", "deducted": total_price}), 200

@student_bp.route('/cancel-booking/<id>', methods=['POST'])
@token_required(['Student'])
def cancel_booking(current_user, id):
    booking = db.bookings.find_one({"_id": ObjectId(id)})
    if not booking:
        return jsonify({"message": "Booking not found"}), 404
        
    if booking.get('studentId') != str(current_user['_id']):
        return jsonify({"message": "Access denied"}), 403
        
    # Check if any part is already verified/completed
    if any(s == "Completed" for s in booking.get('status', {}).values()):
        return jsonify({"message": "Cannot cancel partially completed booking"}), 400

    # Check deadline
    date_str = booking['date']
    menu = db.menus.find_one({"date": date_str})
    if menu:
        now = datetime.datetime.now()
        if "T" in menu.get('deadline', ''):
            deadline_datetime = datetime.datetime.strptime(menu['deadline'], "%Y-%m-%dT%H:%M")
        else:
            # Fallback for old %H:%M format
            deadline_time = datetime.datetime.strptime(menu.get('deadline', '19:00'), "%H:%M").time()
            deadline_datetime = datetime.datetime.combine(datetime.datetime.strptime(date_str, "%Y-%m-%d").date(), deadline_time)
            deadline_datetime = deadline_datetime - datetime.timedelta(days=1)
            
        if now > deadline_datetime:
             return jsonify({"message": "Cancellation deadline has passed"}), 400

    # Refund
    refund_amount = booking.get('price', 0)
    db.users.update_one({"_id": current_user['_id']}, {"$inc": {"walletBalance": refund_amount}})
    
    # Delete or Mark Cancelled
    db.bookings.delete_one({"_id": ObjectId(id)})
    
    # Auto-update badge and stats
    update_student_stats(str(current_user['_id']))
    
    socketio.emit('bookingCancelled', {"bookingId": id})
    return jsonify({"message": "Booking cancelled and amount refunded!", "refunded": refund_amount}), 200

@student_bp.route('/history', methods=['GET'])
@token_required(['Student'])
def get_history(current_user):
    bookings = list(db.bookings.find({"studentId": str(current_user['_id'])}).sort("createdAt", -1))
    for b in bookings:
        b['_id'] = str(b['_id'])
    return jsonify(bookings), 200

@student_bp.route('/complaints', methods=['GET', 'POST'])
@token_required(['Student'])
def handle_complaints(current_user):
    if request.method == 'GET':
        complaints = list(db.complaints.find({}).sort("createdAt", -1))
        for cp in complaints:
            cp['_id'] = str(cp['_id'])
            cp['studentId'] = str(cp.get('studentId', ''))
        return jsonify(complaints), 200
        
    if request.method == 'POST':
        data = request.json
        topic = data.get('topic')
        description = data.get('description')
        imageBase64 = data.get('imageBase64') # Simple base64 upload
        
        if not topic or not description:
            return jsonify({"message": "Topic and description required"}), 400
            
        complaint = {
            "studentId": str(current_user['_id']),
            "studentName": current_user['name'],
            "topic": topic,
            "description": description,
            "imageBase64": imageBase64,
            "status": "Pending",
            "likes": 0,
            "likedBy": [],
            "createdAt": datetime.datetime.now()
        }
        db.complaints.insert_one(complaint)
        socketio.emit('complaintAdded', {"message": "New complaint submitted"})
        return jsonify({"message": "Complaint submitted successfully!"}), 201

@student_bp.route('/complaints/<id>', methods=['PUT'])
@token_required(['Student'])
def edit_complaint(current_user, id):
    data = request.json
    complaint = db.complaints.find_one({"_id": ObjectId(id)})
    if not complaint:
        return jsonify({"message": "Not found"}), 404
    if complaint.get('studentId') != str(current_user['_id']):
        return jsonify({"message": "Only the owner can edit this complaint"}), 403
        
    db.complaints.update_one({"_id": ObjectId(id)}, {"$set": {"description": data.get('description')}})
    return jsonify({"message": "Complaint updated"}), 200

@student_bp.route('/complaints/<id>/like', methods=['PUT'])
@token_required(['Student'])
def like_complaint(current_user, id):
    complaint = db.complaints.find_one({"_id": ObjectId(id)})
    if not complaint:
        return jsonify({"message": "Not found"}), 404
        
    user_id_str = str(current_user['_id'])
    liked_by = complaint.get('likedBy', [])
    
    if user_id_str in liked_by:
        liked_by.remove(user_id_str)
        inc = -1
    else:
        liked_by.append(user_id_str)
        inc = 1
        
    db.complaints.update_one({"_id": ObjectId(id)}, {"$inc": {"likes": inc}, "$set": {"likedBy": liked_by}})
    return jsonify({"message": "Like updated", "likes": complaint.get('likes', 0) + inc}), 200

# Basic Poll System
@student_bp.route('/polls', methods=['GET'])
@token_required(['Student'])
def get_polls(current_user):
    polls = list(db.polls.find({"active": True}))
    if not polls:
        # Auto create a dummy poll for presentation
        dummy_poll = {
            "title": "Festival Menu Special!",
            "options": [{"name": "Paneer Butter Masala", "votes": 5}, {"name": "Chicken Biryani", "votes": 12}, {"name": "Veg Pulao", "votes": 2}],
            "votedBy": [],
            "active": True
        }
        db.polls.insert_one(dummy_poll)
        polls = list(db.polls.find({"active": True}))
        
    for p in polls:
        p['_id'] = str(p['_id'])
    return jsonify(polls), 200

@student_bp.route('/active-bookings', methods=['GET'])
@token_required(['Student'])
def get_active_bookings(current_user):
    today = datetime.datetime.now().strftime('%Y-%m-%d')
    # Show bookings for today onwards
    bookings = list(db.bookings.find({"studentId": str(current_user['_id']), "date": {"$gte": today}}).sort("date", 1))
    for b in bookings:
        b['_id'] = str(b['_id'])
    return jsonify(bookings), 200

@student_bp.route('/polls/<id>/vote', methods=['PUT'])
@token_required(['Student'])
def vote_poll(current_user, id):
    data = request.json
    option_name = data.get('optionName')
    
    poll = db.polls.find_one({"_id": ObjectId(id)})
    if not poll: return jsonify({"message": "Poll not found"}), 404
    
    user_id_str = str(current_user['_id'])
    if user_id_str in poll.get('votedBy', []):
        return jsonify({"message": "You already voted!"}), 400
        
    # Find option and increment
    db.polls.update_one(
        {"_id": ObjectId(id), "options.name": option_name},
        {"$inc": {"options.$.votes": 1}, "$push": {"votedBy": user_id_str}}
    )
    return jsonify({"message": "Vote recorded perfectly"}), 200
