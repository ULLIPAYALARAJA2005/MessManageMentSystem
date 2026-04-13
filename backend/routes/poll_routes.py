import datetime
import uuid
from flask import Blueprint, request, jsonify
from database import db
from middleware import token_required
from bson import ObjectId
from socket_instance import socketio

poll_bp = Blueprint('poll_bp', __name__)

@poll_bp.route('/create', methods=['POST'])
@token_required(['Admin'])
def create_poll(current_user):
    data = request.json
    title = data.get('title')
    description = data.get('description', '')
    date = data.get('date')
    deadline = data.get('deadline')
    options = data.get('options', [])
    allow_multiple = data.get('allowMultiple', False)
    domain = data.get('domain', 'none') # e.g., 'lunch', 'morningTea', etc.

    if not title or not date or not deadline or len(options) < 2:
        return jsonify({"message": "Invalid poll data. Minimum 2 options required."}), 400

    # Ensure each option has an ID and starting votes
    formatted_options = []
    for opt in options:
        if not opt.get('item') or not opt.get('price'):
            return jsonify({"message": "Each option must have an item name and price"}), 400
        formatted_options.append({
            "id": str(uuid.uuid4()),
            "item": opt['item'],
            "price": float(opt['price']),
            "image": opt.get('image', ''),
            "votes": 0
        })

    created_at_str = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    poll = {
        "title": title,
        "description": description,
        "date": date,
        "deadline": deadline,
        "allowMultiple": allow_multiple,
        "domain": domain,
        "options": formatted_options,
        "votedBy": [],
        "studentVotes": {},
        "status": "active",
        "createdAt": created_at_str
    }

    res = db.polls.insert_one(poll)
    poll['_id'] = str(res.inserted_id)
    
    socketio.emit('pollCreated', poll)
    return jsonify({"message": "Poll Created Successfully", "poll": poll}), 201


@poll_bp.route('/all', methods=['GET'])
@token_required(['Admin', 'Student'])
def get_polls(current_user):
    polls = list(db.polls.find().sort("createdAt", -1))
    now = datetime.datetime.now()

    formatted_polls = []
    for poll in polls:
        poll['_id'] = str(poll['_id'])
        # Convert datetime objects to strings for JSON serialization
        if isinstance(poll.get('createdAt'), datetime.datetime):
            poll['createdAt'] = poll['createdAt'].strftime("%Y-%m-%dT%H:%M:%S")
        
        # Determine status based on deadline
        try:
            if "T" in poll.get('deadline', ''):
                deadline_dt = datetime.datetime.strptime(poll['deadline'], "%Y-%m-%dT%H:%M")
            else:
                deadline_dt = datetime.datetime.strptime(poll['deadline'], "%Y-%m-%d %H:%M")

            if now > deadline_dt and poll['status'] == 'active':
                poll['status'] = 'closed'
                db.polls.update_one({"_id": ObjectId(poll['_id'])}, {"$set": {"status": "closed"}})
        except Exception:
            pass
            
        formatted_polls.append(poll)

    return jsonify(formatted_polls), 200

@poll_bp.route('/vote', methods=['POST'])
@token_required(['Student'])
def submit_vote(current_user):
    data = request.json
    poll_id = data.get('pollId')
    option_ids = data.get('optionIds', [])

    if not poll_id or not option_ids:
        return jsonify({"message": "Poll ID and Options are required"}), 400

    poll = db.polls.find_one({"_id": ObjectId(poll_id)})
    if not poll:
        return jsonify({"message": "Poll not found"}), 404

    # Check deadline
    now = datetime.datetime.now()
    try:
        if "T" in poll.get('deadline', ''):
            deadline_dt = datetime.datetime.strptime(poll['deadline'], "%Y-%m-%dT%H:%M")
        else:
            deadline_dt = datetime.datetime.strptime(poll['deadline'], "%Y-%m-%d %H:%M")
        if now > deadline_dt or poll['status'] == 'closed':
            return jsonify({"message": "Poll is closed. Voting is no longer allowed."}), 400
    except Exception:
        pass

    student_id = str(current_user['_id'])

    if not poll.get('allowMultiple') and len(option_ids) > 1:
        return jsonify({"message": "Multiple selections are not allowed for this poll"}), 400

    options = poll.get('options', [])
    already_voted = student_id in poll.get('votedBy', [])
    prev_votes = poll.get('studentVotes', {}).get(student_id, [])

    # Calculate vote weight based on badge for the specific poll domain
    domain = poll.get('domain', 'none')
    domain_badges = current_user.get('domainBadges', {})
    
    # Fallback to general badge if domain-specific badge is missing or for legacy polls
    badge = domain_badges.get(domain) if domain and domain != 'none' else current_user.get('badge', 'none')
    
    weight = 1
    if badge == 'silver': weight = 5
    elif badge == 'gold': weight = 7
    elif badge == 'diamond': weight = 10

    # Adjust vote counts: decrement previous, increment new
    for opt in options:
        if opt['id'] in prev_votes and opt['id'] not in option_ids:
            opt['votes'] = max(0, opt['votes'] - weight)  # remove old vote
        elif opt['id'] not in prev_votes and opt['id'] in option_ids:
            opt['votes'] += weight  # add new vote

    update_doc = {
        "$set": {
            f"studentVotes.{student_id}": option_ids,
            "options": options
        }
    }
    if not already_voted:
        update_doc["$push"] = {"votedBy": student_id}

    db.polls.update_one({"_id": ObjectId(poll_id)}, update_doc)

    updated_poll = db.polls.find_one({"_id": ObjectId(poll_id)})
    updated_poll['_id'] = str(updated_poll['_id'])
    if isinstance(updated_poll.get('createdAt'), datetime.datetime):
        updated_poll['createdAt'] = updated_poll['createdAt'].strftime("%Y-%m-%dT%H:%M:%S")

    socketio.emit('voteUpdated', updated_poll)
    msg = "Vote changed successfully!" if already_voted else "Vote submitted successfully!"
    return jsonify({"message": msg, "poll": updated_poll}), 200


@poll_bp.route('/<poll_id>', methods=['PUT', 'DELETE'])
@token_required(['Admin'])
def manage_poll(current_user, poll_id):
    if request.method == 'DELETE':
        res = db.polls.delete_one({"_id": ObjectId(poll_id)})
        if res.deleted_count > 0:
            socketio.emit('pollDeleted', {"pollId": poll_id})
            return jsonify({"message": "Poll deleted successfully"}), 200
        return jsonify({"message": "Poll not found"}), 404
        
    elif request.method == 'PUT':
        data = request.json
        poll = db.polls.find_one({"_id": ObjectId(poll_id)})
        if not poll: return jsonify({"message": "Poll not found"}), 404
        
        # Check deadline/status — but allow admin to still edit metadata on closed polls
        # Options can only be changed if no votes have been cast (already enforced below)

        # Updating options requires care if votes already exist. 
        # For simplicity, we can just replace everything except votedBy/studentVotes if they haven't started voting yet.
        # If voting has started, it's safer to disallow editing options. Let's just allow title/description/date/deadline updates.
        
        updates = {
            "title": data.get('title', poll['title']),
            "description": data.get('description', poll.get('description', '')),
            "date": data.get('date', poll['date']),
            "deadline": data.get('deadline', poll['deadline']),
            "allowMultiple": data.get('allowMultiple', poll.get('allowMultiple', False))
        }

        # If no one has voted, allow options update
        if len(poll.get('votedBy', [])) == 0 and data.get('options'):
            formatted_options = []
            for opt in data['options']:
                formatted_options.append({
                    "id": str(uuid.uuid4()) if 'id' not in opt else opt['id'],
                    "item": opt['item'],
                    "price": float(opt['price']),
                    "image": opt.get('image', ''),
                    "votes": 0
                })
            updates['options'] = formatted_options
            
        db.polls.update_one({"_id": ObjectId(poll_id)}, {"$set": updates})
        updated_poll = db.polls.find_one({"_id": ObjectId(poll_id)})
        updated_poll['_id'] = str(updated_poll['_id'])
        if isinstance(updated_poll.get('createdAt'), datetime.datetime):
            updated_poll['createdAt'] = updated_poll['createdAt'].strftime("%Y-%m-%dT%H:%M:%S")
        
        socketio.emit('pollUpdated', updated_poll)
        return jsonify({"message": "Poll updated successfully", "poll": updated_poll}), 200

