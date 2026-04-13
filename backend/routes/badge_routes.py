from flask import Blueprint, request, jsonify
from middleware import token_required
from database import db
from bson.objectid import ObjectId
import datetime
from socket_instance import socketio

from badge_logic import update_student_stats, DOMAINS, BADGE_RANKS, best_badge

badge_bp = Blueprint('badge_bp', __name__)

@badge_bp.route('/students', methods=['GET'])
@token_required(['Admin'])
def get_badge_students(current_user):
    students = list(db.users.find({"role": "Student"}, {"password": 0}))
    
    results = []
    for s in students:
        s_id = str(s['_id'])
        stats = update_student_stats(s_id)
        # Re-fetch to get updated domainBadges
        updated = db.users.find_one({"_id": s['_id']}, {"password": 0})
        
        results.append({
            "id": s_id,
            "name": s['name'],
            "email": s['email'],
            "studentId": s.get('studentId', ''),
            "totalBookings": stats['totalBookings'],
            "badge": stats.get('badge', updated.get('badge', 'none')),
            "domainBadges": stats.get('domainBadges', {}),
            "mealCounts": stats['mealCounts']
        })
    
    return jsonify(results), 200

@badge_bp.route('/student/<email>', methods=['GET'])
@token_required(['Admin'])
def get_student_badge_details(current_user, email):
    user = db.users.find_one({"email": email, "role": "Student"}, {"password": 0})
    if not user:
        return jsonify({"message": "Student not found"}), 404
        
    s_id = str(user['_id'])
    stats = update_student_stats(s_id)
    updated = db.users.find_one({"_id": user['_id']}, {"password": 0})
    
    return jsonify({
        "id": s_id,
        "name": user['name'],
        "email": user['email'],
        "studentId": user.get('studentId', ''),
        "badge": updated.get('badge', 'none'),
        "domainBadges": updated.get('domainBadges', {d: 'none' for d in DOMAINS}),
        "badgeHistory": updated.get('badgeHistory', []),
        "mealCounts": stats['mealCounts'],
        "totalBookings": stats['totalBookings']
    }), 200

@badge_bp.route('/assign', methods=['POST'])
@token_required(['Admin'])
def assign_badge(current_user):
    data = request.json
    email = data.get('email')
    domain = data.get('domain')    # e.g. "morningTea", "lunch", "dinner" — or 'all'
    badge = data.get('badge')      # silver, gold, diamond, none
    
    if not email or badge not in ['silver', 'gold', 'diamond', 'none']:
        return jsonify({"message": "Invalid badge or email"}), 400
    
    if domain and domain != 'all' and domain not in DOMAINS:
        return jsonify({"message": f"Invalid domain. Valid ones: {DOMAINS}"}), 400
        
    user = db.users.find_one({"email": email, "role": "Student"})
    if not user:
        return jsonify({"message": "Student not found"}), 404

    history_entry = {
        "badge": badge,
        "domain": domain or "all",
        "reason": "Manually assigned by Admin",
        "date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    }
        
    if domain and domain != 'all':
        # Update only this domain's badge
        current_domain_badges = user.get('domainBadges', {d: 'none' for d in DOMAINS})
        current_domain_badges[domain] = badge
        top_badge = best_badge(current_domain_badges)
        db.users.update_one({"email": email}, {
            "$set": {
                f"domainBadges.{domain}": badge,
                "badge": top_badge
            },
            "$push": {"badgeHistory": history_entry}
        })
        if socketio.server:
            socketio.emit('badgeUpdated', {"userId": str(user['_id']), "domain": domain, "badge": badge, "topBadge": top_badge})
    else:
        # Assign to ALL domains
        all_domain_badges = {d: badge for d in DOMAINS}
        db.users.update_one({"email": email}, {
            "$set": {"domainBadges": all_domain_badges, "badge": badge},
            "$push": {"badgeHistory": history_entry}
        })
        if socketio.server:
            socketio.emit('badgeUpdated', {"userId": str(user['_id']), "badge": badge})

    return jsonify({"message": f"Badge '{badge}' assigned to {user['name']} for domain '{domain or 'all'}'"}), 200

@badge_bp.route('/rules', methods=['GET'])
@token_required(['Admin'])
def get_rules(current_user):
    from badge_logic import get_badge_rules
    rules = get_badge_rules()
    return jsonify(rules), 200

@badge_bp.route('/rules/update', methods=['POST'])
@token_required(['Admin'])
def update_rules(current_user):
    # Expects format: { "rules": { "morningEgg": {"silver": 50, "gold": 100, "diamond": 200}, "lunch": {...} } }
    data = request.json
    new_rules = data.get('rules', {})
    
    if not new_rules:
        return jsonify({"message": "No rules provided"}), 400
        
    db.settings.update_one(
        {"_id": "badge_rules"},
        {"$set": {"rules": new_rules}},
        upsert=True
    )
    
    # Recalculate everything automatically
    from badge_logic import update_student_stats
    students = list(db.users.find({"role": "Student"}, {"_id": 1}))
    for s in students:
        update_student_stats(str(s['_id']))
        
    return jsonify({"message": "Badge rules successfully updated and all students recalculated!"}), 200

@badge_bp.route('/recalculate', methods=['POST'])
@token_required(['Admin'])
def recalculate_all(current_user):
    from badge_logic import update_student_stats
    students = list(db.users.find({"role": "Student"}, {"_id": 1}))
    count = 0
    for s in students:
        update_student_stats(str(s['_id']))
        count += 1
    return jsonify({"message": f"Successfully recalculated badges for {count} students."}), 200
