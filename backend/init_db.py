from database import db
import bcrypt

def init_admin():
    admin_email = "admin@gmail.com"
    existing_admin = db.users.find_one({"email": admin_email})
    if not existing_admin:
        hashed_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
        db.users.insert_one({
            "name": "Super Admin",
            "email": admin_email,
            "password": hashed_password.decode('utf-8'),
            "role": "Admin",
            "walletBalance": 0
        })
        print("Default admin created successfully.")
    else:
        print("Admin already exists.")

if __name__ == "__main__":
    init_admin()
