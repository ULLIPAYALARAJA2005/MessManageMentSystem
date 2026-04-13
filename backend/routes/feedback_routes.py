import datetime
from flask import Blueprint, request, jsonify
from database import db
from middleware import token_required
from bson import ObjectId
from socket_instance import socketio

feedback_bp = Blueprint('feedback_bp', __name__)

# ─────────────── helpers ───────────────

DEFAULT_QUESTIONS = [
    {
        "id": "q1",
        "question": "Timeliness of the service",
        "options": [
            {"id": "q1a", "label": "A. Maintained"},
            {"id": "q1b", "label": "B. Not Maintained (Delay < 10 minutes)"},
            {"id": "q1c", "label": "C. Not Maintained (Delay < 1 hour)"},
            {"id": "q1d", "label": "D. Not Maintained (Delay > 1 hour)"},
            {"id": "q1e", "label": "E. Not maintaining regularly"},
        ]
    },
    {
        "id": "q2",
        "question": "Neatness/Cleanliness of surroundings",
        "options": [
            {"id": "q2a", "label": "A. Maintained"},
            {"id": "q2b", "label": "B. Not maintained at dining area"},
            {"id": "q2c", "label": "C. Not maintained at dining tables"},
            {"id": "q2d", "label": "D. Not maintained at both"},
            {"id": "q2e", "label": "E. Not maintaining regularly"},
        ]
    },
    {
        "id": "q3i",
        "question": "Quality of food – Boiled Rice / Banana",
        "options": [
            {"id": "q3ia", "label": "A. Maintained quality"},
            {"id": "q3ib", "label": "B. Banana quality poor"},
            {"id": "q3ic", "label": "C. Rice quality poor"},
            {"id": "q3id", "label": "D. Both poor"},
            {"id": "q3ie", "label": "E. Not maintaining regularly"},
        ]
    },
    {
        "id": "q3ii",
        "question": "Quality of food – Taste of Curries / Fries",
        "options": [
            {"id": "q3iia", "label": "A. Both tasty"},
            {"id": "q3iib", "label": "B. Fries not tasty"},
            {"id": "q3iic", "label": "C. Curries not tasty"},
            {"id": "q3iid", "label": "D. Both not tasty"},
            {"id": "q3iie", "label": "E. Not maintaining regularly"},
        ]
    },
    {
        "id": "q3iii",
        "question": "Quality of food – Snacks / Tea / Coffee / Breakfast",
        "options": [
            {"id": "q3iiia", "label": "A. Tasty"},
            {"id": "q3iiib", "label": "B. Snacks not tasty"},
            {"id": "q3iiic", "label": "C. Tea/Coffee not tasty"},
            {"id": "q3iiid", "label": "D. Breakfast not tasty"},
            {"id": "q3iiie", "label": "E. Not maintaining regularly"},
        ]
    },
    {
        "id": "q4",
        "question": "Quantity of food",
        "options": [
            {"id": "q4a", "label": "A. Maintained for all meals"},
            {"id": "q4b", "label": "B. Not maintained in breakfast"},
            {"id": "q4c", "label": "C. Not maintained in lunch"},
            {"id": "q4d", "label": "D. Not maintained in lunch & dinner"},
            {"id": "q4e", "label": "E. Not maintained regularly"},
        ]
    },
    {
        "id": "q5",
        "question": "Courtesy of staff",
        "options": [
            {"id": "q5a", "label": "A. Maintained"},
            {"id": "q5b", "label": "B. Not maintained"},
            {"id": "q5c", "label": "C. Not maintained regularly"},
        ]
    },
    {
        "id": "q6",
        "question": "Uniform & Hygiene",
        "options": [
            {"id": "q6a", "label": "A. Worn properly"},
            {"id": "q6b", "label": "B. No head mask"},
            {"id": "q6c", "label": "C. No uniform"},
            {"id": "q6d", "label": "D. No gloves"},
            {"id": "q6e", "label": "E. Not following regularly"},
        ]
    },
    {
        "id": "q7",
        "question": "Cooking as per menu",
        "options": [
            {"id": "q7a", "label": "A. Yes"},
            {"id": "q7b", "label": "B. Issue in snacks"},
            {"id": "q7c", "label": "C. Issue in milk products"},
            {"id": "q7d", "label": "D. Issue in curry/dal"},
            {"id": "q7e", "label": "E. Not maintaining regularly"},
        ]
    },
    {
        "id": "q8",
        "question": "Cleanliness of wash area",
        "options": [
            {"id": "q8a", "label": "A. Maintained"},
            {"id": "q8b", "label": "B. Not maintained at dining area"},
            {"id": "q8c", "label": "C. Not maintained at dining tables"},
            {"id": "q8d", "label": "D. Not maintained at both"},
            {"id": "q8e", "label": "E. Not maintaining regularly"},
        ]
    },
]


def serialize_cycle(cycle):
    cycle = dict(cycle)
    cycle['_id'] = str(cycle['_id'])
    if isinstance(cycle.get('createdAt'), datetime.datetime):
        cycle['createdAt'] = cycle['createdAt'].isoformat()
    if isinstance(cycle.get('lastSentDate'), datetime.datetime):
        cycle['lastSentDate'] = cycle['lastSentDate'].isoformat()
    return cycle


def auto_trigger_cycle_if_due():
    """Check if it's time to start a new feedback cycle based on scheduleDays."""
    config = db.feedback_config.find_one({"_id": "global"})
    if not config or not config.get('enabled', False):
        return None

    schedule_days = config.get('scheduleDays', 7)
    last_sent = config.get('lastSentDate')

    if last_sent:
        if isinstance(last_sent, str):
            last_sent = datetime.datetime.fromisoformat(last_sent)
        delta = (datetime.datetime.utcnow() - last_sent).days
        if delta < schedule_days:
            return None

    # Load the saved global template (or fall back to hardcoded default)
    tmpl = db.feedback_template.find_one({"_id": "global"})
    questions = tmpl.get('questions', DEFAULT_QUESTIONS) if tmpl else DEFAULT_QUESTIONS
    # Only send visible questions/options to students
    visible_questions = [
        {**q, "options": [o for o in q.get('options', []) if not o.get('hidden')]}
        for q in questions if not q.get('hidden')
    ]

    # Create a new auto cycle
    now = datetime.datetime.utcnow()
    deadline_dt = now + datetime.timedelta(days=config.get('deadlineDays', 3))

    cycle = {
        "questions": visible_questions,
        "deadline": deadline_dt.isoformat(),
        "scheduleDays": schedule_days,
        "status": "active",
        "createdAt": now,
        "lastSentDate": now,
        "isAuto": True,
        "title": f"Weekly Feedback – {now.strftime('%d %b %Y')}"
    }
    res = db.feedback_cycles.insert_one(cycle)
    cycle['_id'] = str(res.inserted_id)
    cycle['createdAt'] = cycle['createdAt'].isoformat()
    cycle['lastSentDate'] = cycle['lastSentDate'].isoformat()

    # Update config
    db.feedback_config.update_one({"_id": "global"}, {"$set": {"lastSentDate": now}})

    socketio.emit('feedbackCycleCreated', cycle)
    return cycle


# ─────────────── routes ───────────────

@feedback_bp.route('/template', methods=['GET'])
@token_required(['Admin'])
def get_template(current_user):
    """Return the globally saved feedback template (all questions including hidden)."""
    tmpl = db.feedback_template.find_one({"_id": "global"})
    if not tmpl:
        return jsonify({"questions": DEFAULT_QUESTIONS, "isDefault": True}), 200
    questions = tmpl.get('questions', DEFAULT_QUESTIONS)
    return jsonify({"questions": questions, "isDefault": False,
                    "updatedAt": tmpl.get('updatedAt', '')}), 200


@feedback_bp.route('/template', methods=['PUT'])
@token_required(['Admin'])
def save_template(current_user):
    """Permanently save the global feedback template."""
    data = request.json
    questions = data.get('questions')
    if not questions or not isinstance(questions, list):
        return jsonify({"message": "questions array is required"}), 400

    visible = [q for q in questions if not q.get('hidden')]
    if len(visible) == 0:
        return jsonify({"message": "At least one visible question is required"}), 400

    now = datetime.datetime.utcnow().isoformat()
    db.feedback_template.update_one(
        {"_id": "global"},
        {"$set": {"questions": questions, "updatedAt": now}},
        upsert=True
    )
    return jsonify({"message": "Template saved permanently", "updatedAt": now}), 200


@feedback_bp.route('/config', methods=['GET', 'PUT'])
@token_required(['Admin'])
def manage_config(current_user):
    """Get or update the global feedback schedule config."""
    if request.method == 'GET':
        config = db.feedback_config.find_one({"_id": "global"}) or {}
        config.pop('_id', None)
        if isinstance(config.get('lastSentDate'), datetime.datetime):
            config['lastSentDate'] = config['lastSentDate'].isoformat()
        return jsonify(config), 200

    data = request.json
    update = {
        "scheduleDays": data.get('scheduleDays', 7),
        "deadlineDays": data.get('deadlineDays', 3),
        "enabled": data.get('enabled', False)
    }
    if 'lastSentDate' in data:
        update['lastSentDate'] = data['lastSentDate']

    db.feedback_config.update_one(
        {"_id": "global"},
        {"$set": update},
        upsert=True
    )
    return jsonify({"message": "Config updated"}), 200


@feedback_bp.route('/create', methods=['POST'])
@token_required(['Admin'])
def create_cycle(current_user):
    data = request.json
    title = data.get('title', f"Feedback – {datetime.datetime.utcnow().strftime('%d %b %Y')}")
    deadline = data.get('deadline')
    schedule_days = data.get('scheduleDays', 7)

    if not deadline:
        return jsonify({"message": "Deadline is required"}), 400

    # Determine questions to use
    if data.get('questions'):
        raw_qs = data['questions']
    else:
        # Load the saved global template
        tmpl = db.feedback_template.find_one({"_id": "global"})
        raw_qs = tmpl.get('questions', DEFAULT_QUESTIONS) if tmpl else DEFAULT_QUESTIONS
        
    # Strip hidden for students
    questions = [
        {**q, "options": [o for o in q.get('options', []) if not o.get('hidden')]}
        for q in raw_qs if not q.get('hidden')
    ]

    now = datetime.datetime.utcnow()
    cycle = {
        "title": title,
        "questions": questions,
        "deadline": deadline,
        "scheduleDays": schedule_days,
        "status": "active",
        "createdAt": now,
        "lastSentDate": now,
        "isAuto": False
    }
    res = db.feedback_cycles.insert_one(cycle)
    cycle['_id'] = str(res.inserted_id)

    # Update global config
    db.feedback_config.update_one(
        {"_id": "global"},
        {"$set": {"lastSentDate": now, "scheduleDays": schedule_days}},
        upsert=True
    )

    serialized = serialize_cycle(cycle)
    socketio.emit('feedbackCycleCreated', serialized)
    return jsonify({"message": "Feedback cycle created", "cycle": serialized}), 201


@feedback_bp.route('/all', methods=['GET'])
@token_required(['Admin'])
def get_all_cycles(current_user):
    cycles = list(db.feedback_cycles.find().sort("createdAt", -1))
    now_dt = datetime.datetime.utcnow()

    result = []
    for c in cycles:
        # Auto-close past deadline
        try:
            deadline_dt = datetime.datetime.fromisoformat(c.get('deadline', ''))
            if now_dt > deadline_dt and c.get('status') == 'active':
                db.feedback_cycles.update_one({"_id": c['_id']}, {"$set": {"status": "closed"}})
                c['status'] = 'closed'
        except Exception:
            pass

        # Count responses
        c['responseCount'] = db.feedback_responses.count_documents({"cycleId": str(c['_id'])})
        result.append(serialize_cycle(c))

    return jsonify(result), 200


@feedback_bp.route('/active', methods=['GET'])
@token_required(['Admin', 'Student'])
def get_active_cycle(current_user):
    """Return the currently active feedback cycle; auto-trigger new one if due."""
    # Try to auto-trigger a new cycle (no-op if schedule not met)
    auto_trigger_cycle_if_due()

    now_dt = datetime.datetime.utcnow()
    cycle = None

    # Find the most recent active cycle whose deadline hasn't passed
    candidates = list(db.feedback_cycles.find({"status": "active"}).sort("createdAt", -1))
    for c in candidates:
        try:
            deadline_dt = datetime.datetime.fromisoformat(c.get('deadline', ''))
            if now_dt <= deadline_dt:
                cycle = c
                break
            else:
                # Auto-close expired
                db.feedback_cycles.update_one({"_id": c['_id']}, {"$set": {"status": "closed"}})
        except Exception:
            pass

    if not cycle:
        return jsonify(None), 200

    student_id = str(current_user['_id'])
    has_submitted = db.feedback_responses.find_one({
        "cycleId": str(cycle['_id']),
        "studentId": student_id
    }) is not None

    serialized = serialize_cycle(cycle)
    serialized['hasSubmitted'] = has_submitted
    return jsonify(serialized), 200


@feedback_bp.route('/submit', methods=['POST', 'DELETE'])
@token_required(['Student'])
def submit_feedback(current_user):
    data = request.json
    cycle_id = data.get('cycleId')

    if not cycle_id:
        return jsonify({"message": "Cycle ID required"}), 400

    cycle = db.feedback_cycles.find_one({"_id": ObjectId(cycle_id)})
    if not cycle:
        return jsonify({"message": "Feedback cycle not found"}), 404

    # Check deadline
    try:
        deadline_dt = datetime.datetime.fromisoformat(cycle.get('deadline', ''))
        if datetime.datetime.utcnow() > deadline_dt:
            return jsonify({"message": "Feedback deadline has passed"}), 400
    except Exception:
        pass

    if cycle.get('status') != 'active':
        return jsonify({"message": "This feedback cycle is no longer active"}), 400

    student_id = str(current_user['_id'])

    # DELETE response
    if request.method == 'DELETE':
        res = db.feedback_responses.delete_one({"cycleId": cycle_id, "studentId": student_id})
        if res.deleted_count > 0:
            payload = {"cycleId": cycle_id, "studentName": current_user.get('name', ''), "action": "deleted"}
            socketio.emit('feedbackResponseReceived', payload)
            return jsonify({"message": "Your feedback response has been deleted"}), 200
        else:
            return jsonify({"message": "No response found to delete"}), 404

    # POST response
    answers = data.get('answers', {})
    comments = data.get('comments', '')

    # One submission per student per cycle
    existing = db.feedback_responses.find_one({"cycleId": cycle_id, "studentId": student_id})
    if existing:
        return jsonify({"message": "You have already submitted feedback for this cycle. If you want to change it, please delete your response first."}), 400

    # Badge-based weight
    badge = current_user.get('badge', 'none')
    weight = 1
    if badge == 'silver':   weight = 5
    elif badge == 'gold':   weight = 7
    elif badge == 'diamond': weight = 10

    response = {
        "cycleId": cycle_id,
        "studentId": student_id,
        "studentName": current_user.get('name', ''),
        "answers": answers,
        "comments": comments,
        "weight": weight,
        "badge": badge,
        "submittedAt": datetime.datetime.utcnow().isoformat()
    }

    db.feedback_responses.insert_one(response)

    payload = {"cycleId": cycle_id, "studentName": current_user.get('name', ''), "action": "submitted"}
    socketio.emit('feedbackResponseReceived', payload)

    return jsonify({"message": "Feedback submitted successfully! Thank you 🎉"}), 201


@feedback_bp.route('/responses/<cycle_id>', methods=['GET'])
@token_required(['Admin'])
def get_responses(current_user, cycle_id):
    responses = list(db.feedback_responses.find({"cycleId": cycle_id}))
    for r in responses:
        r['_id'] = str(r['_id'])
    return jsonify(responses), 200


@feedback_bp.route('/analytics/<cycle_id>', methods=['GET'])
@token_required(['Admin'])
def get_analytics(current_user, cycle_id):
    """Compute per-question analytics with badge weighting."""
    cycle = db.feedback_cycles.find_one({"_id": ObjectId(cycle_id)})
    if not cycle:
        return jsonify({"message": "Cycle not found"}), 404

    responses = list(db.feedback_responses.find({"cycleId": cycle_id}))
    questions = cycle.get('questions', DEFAULT_QUESTIONS)

    total_students = db.users.count_documents({"role": "Student"})
    response_count = len(responses)

    # Per-question option counts (weighted)
    question_stats = {}
    for q in questions:
        qid = q['id']
        option_counts = {opt['id']: {"label": opt['label'], "count": 0, "weightedCount": 0} for opt in q['options']}
        for resp in responses:
            selected = resp.get('answers', {}).get(qid)
            if selected and selected in option_counts:
                w = resp.get('weight', 1)
                option_counts[selected]['count'] += 1
                option_counts[selected]['weightedCount'] += w
        question_stats[qid] = {
            "question": q['question'],
            "options": list(option_counts.values())
        }

    # Worst categories: questions where option A (Maintained/Good) has < 50% responses
    worst = []
    for q in questions:
        qid = q['id']
        if not responses:
            continue
        opt_a_id = q['options'][0]['id']
        opt_a_count = question_stats[qid]['options'][0]['count']
        pct = (opt_a_count / response_count * 100) if response_count > 0 else 0
        if pct < 50:
            worst.append({
                "question": q['question'],
                "maintainedPct": round(pct, 1)
            })

    # Comments
    comments = [
        {"comment": r.get('comments', ''), "studentName": r.get('studentName', 'Anonymous'), "submittedAt": r.get('submittedAt', '')}
        for r in responses if r.get('comments', '').strip()
    ]

    return jsonify({
        "totalStudents": total_students,
        "responseCount": response_count,
        "questionStats": question_stats,
        "worstCategories": sorted(worst, key=lambda x: x['maintainedPct']),
        "comments": comments
    }), 200


@feedback_bp.route('/history', methods=['GET'])
@token_required(['Admin'])
def get_history(current_user):
    """Return aggregated scores per cycle for comparison charts."""
    cycles = list(db.feedback_cycles.find().sort("createdAt", 1))
    history = []
    for c in cycles:
        cid = str(c['_id'])
        responses = list(db.feedback_responses.find({"cycleId": cid}))
        if not responses:
            history.append({"cycleId": cid, "title": c.get('title', ''), "date": str(c.get('createdAt', '')), "avgScore": 0, "responseCount": 0})
            continue

        # Avg score: option A = 100, B = 75, C = 50, D = 25, E = 0
        score_map = {0: 100, 1: 75, 2: 50, 3: 25, 4: 0}
        questions = c.get('questions', DEFAULT_QUESTIONS)
        total_score = 0
        total_answers = 0
        for resp in responses:
            for q in questions:
                selected = resp.get('answers', {}).get(q['id'])
                if selected:
                    for i, opt in enumerate(q['options']):
                        if opt['id'] == selected:
                            total_score += score_map.get(i, 0)
                            total_answers += 1

        avg = round(total_score / total_answers, 1) if total_answers > 0 else 0
        history.append({
            "cycleId": cid,
            "title": c.get('title', ''),
            "date": c.get('createdAt', '').isoformat() if isinstance(c.get('createdAt'), datetime.datetime) else str(c.get('createdAt', '')),
            "avgScore": avg,
            "responseCount": len(responses)
        })

    return jsonify(history), 200


@feedback_bp.route('/<cycle_id>', methods=['PUT', 'DELETE'])
@token_required(['Admin'])
def manage_cycle(current_user, cycle_id):
    if request.method == 'DELETE':
        db.feedback_cycles.delete_one({"_id": ObjectId(cycle_id)})
        db.feedback_responses.delete_many({"cycleId": cycle_id})
        socketio.emit('feedbackCycleDeleted', {"cycleId": cycle_id})
        return jsonify({"message": "Feedback cycle deleted"}), 200

    data = request.json
    cycle = db.feedback_cycles.find_one({"_id": ObjectId(cycle_id)})
    if not cycle:
        return jsonify({"message": "Cycle not found"}), 404

    updates = {}
    if 'deadline' in data:   updates['deadline'] = data['deadline']
    if 'title' in data:      updates['title'] = data['title']
    if 'status' in data:     updates['status'] = data['status']
    if 'scheduleDays' in data: updates['scheduleDays'] = data['scheduleDays']

    db.feedback_cycles.update_one({"_id": ObjectId(cycle_id)}, {"$set": updates})
    updated = db.feedback_cycles.find_one({"_id": ObjectId(cycle_id)})
    serialized = serialize_cycle(updated)
    socketio.emit('feedbackCycleUpdated', serialized)
    return jsonify({"message": "Cycle updated", "cycle": serialized}), 200
