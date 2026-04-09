from database import db

users = db.users.find()
for u in users:
    print(f"User: {u.get('email', 'No email')}, Role: '{u.get('role', 'No role')}'")
