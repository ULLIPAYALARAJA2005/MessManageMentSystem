import bcrypt
import os
from database import db

def bulk_add_students(start_idx, end_idx):
    password = "123"
    print(f"Hashing password '{password}'...")
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    print(f"Starting insertion for students {start_idx} to {end_idx}...")
    
    students = []
    total_added = 0
    
    for i in range(start_idx, end_idx + 1):
        # Student ID format: S21 + 3 digits (e.g. S21025)
        student_id = f"S21{str(i).zfill(3)}"
        
        # Check if student already exists to avoid duplicates
        if db.users.find_one({"$or": [{"email": f"student{i}@gmail.com"}, {"studentId": student_id}]}):
            continue

        student_doc = {
            "name": f"Student{i}",
            "email": f"student{i}@gmail.com",
            "password": hashed_password,
            "role": "Student",
            "studentId": student_id,
            "walletBalance": 0
        }
        students.append(student_doc)
        total_added += 1
        
        # Batch insert every 100 students
        if len(students) >= 100:
            db.users.insert_many(students)
            print(f"✅ Inserted batch. Total added so far: {total_added}")
            students = []

    # Final batch
    if students:
        db.users.insert_many(students)
        print(f"✅ Inserted final batch. Total added: {total_added}")
    else:
        print(f"Done. Total added: {total_added}")

if __name__ == "__main__":
    try:
        bulk_add_students(25, 1000)
    except Exception as e:
        print(f"❌ Error during bulk insertion: {e}")
