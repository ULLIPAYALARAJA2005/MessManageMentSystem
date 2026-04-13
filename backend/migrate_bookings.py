from database import db

bookings = db.bookings.find({})
count = 0
for b in bookings:
    old_meals = b.get("meals", [])
    new_meals = []
    
    modified = False
    new_status = {}
    old_status = b.get("status", {})
    
    for meal in old_meals:
        if meal == "Morning Tea": 
            new_meals.append("Morning Tea/Milk")
            new_status["Morning Tea/Milk"] = old_status.get(meal, "Pending")
            modified = True
        elif meal == "Evening Tea": 
            new_meals.append("Evening Tea/Milk")
            new_status["Evening Tea/Milk"] = old_status.get(meal, "Pending")
            modified = True
        elif meal == "Evening Snacks": 
            new_meals.append("Snacks")
            new_status["Snacks"] = old_status.get(meal, "Pending")
            modified = True
        elif meal == "Lunch":
            new_meals.append("Lunch Veg")
            new_status["Lunch Veg"] = old_status.get(meal, "Pending")
            modified = True
        elif meal == "Dinner":
            new_meals.append("Dinner Veg")
            new_status["Dinner Veg"] = old_status.get(meal, "Pending")
            modified = True
        else:
            new_meals.append(meal)
            if meal in old_status:
                new_status[meal] = old_status[meal]
                
    if modified:
        db.bookings.update_one({"_id": b["_id"]}, {"$set": {"meals": new_meals, "status": new_status}})
        count += 1
print(f"Migrated {count} bookings")
