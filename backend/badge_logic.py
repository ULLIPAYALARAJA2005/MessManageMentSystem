from database import db
from bson.objectid import ObjectId
import datetime
from socket_instance import socketio

# Default thresholds (if admin hasn't configured them)
DEFAULT_THRESHOLDS = { "silver": 50, "gold": 100, "diamond": 200 }

# Mapping from meal name fragment to domain key
DOMAIN_MAP = [
    ("Morning Tea/Milk", "morningTea"),
    ("Morning Egg",  "morningEgg"),
    ("Morning Banana", "morningBanana"),
    ("Evening Tea/Milk", "eveningTea"),
    ("Tiffin",       "tiffin"),
    ("Lunch Veg",    "lunchVeg"),
    ("Lunch Non-Veg", "lunchNonVeg"),
    ("Lunch Egg",    "lunchEgg"),
    ("Snacks",       "snacks"),
    ("Dinner Veg",   "dinnerVeg"),
    ("Dinner Non-Veg", "dinnerNonVeg"),
    ("Dinner Egg",   "dinnerEgg"),
]

DOMAINS = ["morningTea", "morningEgg", "morningBanana", "tiffin", "lunchVeg", "lunchNonVeg", "lunchEgg", "eveningTea", "snacks", "dinnerVeg", "dinnerNonVeg", "dinnerEgg"]
BADGE_RANKS = {"none": 0, "silver": 1, "gold": 2, "diamond": 3}

def get_badge_rules():
    """Return current badge rules (thresholds) grouped by domain from DB (or defaults)."""
    doc = db.settings.find_one({"_id": "badge_rules"})
    
    # Generate default rules if none exist in the DB
    default_rules = {
        d: {"silver": 50, "gold": 100, "diamond": 200} for d in DOMAINS
    }
    
    if doc and "rules" in doc:
        # Merge DB rules with defaults to ensure all domains exist
        rules = default_rules.copy()
        rules.update(doc["rules"])
        return rules
        
    return default_rules

def meal_to_domain(base_name):
    """Map a meal name to a domain key."""
    for fragment, key in DOMAIN_MAP:
        if fragment in base_name:
            return key
    return None

def count_for_badge(count, domain_rules):
    """Return the badge tier for a given count using domain-specific rules."""
    diamond_thresh = domain_rules.get("diamond", 200)
    gold_thresh = domain_rules.get("gold", 100)
    silver_thresh = domain_rules.get("silver", 50)
    
    if count >= diamond_thresh:
        return "diamond"
    if count >= gold_thresh:
        return "gold"
    if count >= silver_thresh:
        return "silver"
    return "none"

def best_badge(domain_badges: dict) -> str:
    """Return the highest badge the student holds across all domains."""
    best = "none"
    for b in domain_badges.values():
        if BADGE_RANKS.get(b, 0) > BADGE_RANKS.get(best, 0):
            best = b
    return best

def update_student_stats(student_id):
    """Recalculate per-domain meal counts, auto-assign domain badges, and persist."""
    bookings = list(db.bookings.find({"studentId": student_id}))

    meal_counts = {d: 0 for d in DOMAINS}
    total_meals = 0

    for b in bookings:
        for meal_full_name in b.get('meals', []):
            base_name = meal_full_name.split(' x')[0]
            key = meal_to_domain(base_name)
            if key:
                qty = int(b.get('mealQty', {}).get(base_name, 1))
                meal_counts[key] += qty
                total_meals += qty

    # Build per-domain auto-badges
    rules = get_badge_rules()
    auto_domain_badges = {d: count_for_badge(meal_counts[d], rules[d]) for d in DOMAINS}

    user = db.users.find_one({"_id": ObjectId(student_id)})
    if not user:
        return {}

    current_domain_badges = user.get('domainBadges', {d: 'none' for d in DOMAINS})
    new_domain_badges = dict(current_domain_badges)
    badge_history = list(user.get('badgeHistory', []))
    promoted = []

    for domain in DOMAINS:
        auto_tier = auto_domain_badges[domain]
        current_tier = current_domain_badges.get(domain, 'none')
        # Only auto-upgrade; admin manual overrides are preserved if higher
        if BADGE_RANKS.get(auto_tier, 0) > BADGE_RANKS.get(current_tier, 0):
            new_domain_badges[domain] = auto_tier
            promoted.append(domain)
            badge_history.append({
                "domain": domain,
                "badge": auto_tier,
                "reason": f"Auto-upgrade ({meal_counts[domain]} bookings)",
                "date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
            })

    top_badge = best_badge(new_domain_badges)

    update_data = {
        "mealCounts": meal_counts,
        "totalBookings": total_meals,
        "domainBadges": new_domain_badges,
        "badge": top_badge,            # keep a summary field for fast queries
        "badgeHistory": badge_history,
    }

    db.users.update_one({"_id": ObjectId(student_id)}, {"$set": update_data})

    if promoted and socketio.server:
        socketio.emit('badgeUpdated', {"userId": student_id, "domainBadges": new_domain_badges, "badge": top_badge})

    return update_data
