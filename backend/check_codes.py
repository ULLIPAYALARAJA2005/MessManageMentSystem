from database import db
b = db.bookings.find_one()
if b:
    print(b.get('codes'))
    print(b.get('status'))
else:
    print("No bookings")
