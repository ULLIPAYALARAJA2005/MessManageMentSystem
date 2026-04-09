from flask import request, jsonify
from functools import wraps
import jwt
import os
import sys
from database import db
from bson.objectid import ObjectId

JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key")

def token_required(roles=None):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = None
            if 'Authorization' in request.headers:
                token_header = request.headers['Authorization']
                if token_header.startswith("Bearer "):
                    token = token_header.split(" ")[1]

            if not token:
                return jsonify({"message": "Token is missing!"}), 401

            try:
                data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
                current_user = db.users.find_one({"_id": ObjectId(data['user_id'])})
                if not current_user:
                    return jsonify({"message": "User not found!"}), 401

                # Security fix: Database role MUST take precedence over token role.
                # If an admin updates a user's role, their existing token shouldn't grant old privileges.
                token_role = data.get('role', '').strip()
                db_role = current_user.get('role', '').strip()
                user_role = db_role or token_role  # use DB first

                # If DB role is missing/empty but token role is valid, repair DB silently
                if not db_role and token_role:
                    db.users.update_one(
                        {"_id": current_user['_id']},
                        {"$set": {"role": token_role}}
                    )
                    current_user['role'] = token_role
                    user_role = token_role

                if roles:
                    normalized_role = user_role.strip().title()
                    allowed_roles = [r.strip().title() for r in roles]
                    if normalized_role not in allowed_roles:
                        print(
                            f"DEBUG AUTH: User {current_user.get('email')} "
                            f"role={user_role!r} (token={token_role!r}, db={db_role!r}) "
                            f"not in {roles!r}",
                            file=sys.stderr
                        )
                        return jsonify({"message": "Unauthorized role!"}), 403

                # Block check: if student is blocked, deny access to action endpoints
                if normalized_role == 'Student' and current_user.get('isBlocked', False):
                    # Allow read-only profile endpoint so student can see the blocked banner
                    if not request.path.endswith('/me'):
                        return jsonify({"message": "Access Denied – You are blocked by admin"}), 403

            except jwt.ExpiredSignatureError:
                return jsonify({"message": "Token has expired!"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"message": "Token is invalid!"}), 401

            return f(current_user, *args, **kwargs)
        return decorated
    return decorator
