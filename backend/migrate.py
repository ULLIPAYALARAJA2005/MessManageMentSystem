from database import db

# Migrate weekly_menu
weekly = db.weekly_menu.find_one({"_id": "default"})
if weekly:
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]:
        if day in weekly:
            day_data = weekly[day]
            new_data = {}
            for k, v in day_data.items():
                if k == "Morning Tea": new_data["Morning Tea/Milk"] = v
                elif k == "Evening Tea": new_data["Evening Tea/Milk"] = v
                elif k == "Evening Snacks": new_data["Snacks"] = v
                elif k == "Lunch": 
                    new_data["Lunch Veg"] = v
                    new_data["Lunch Non-Veg"] = v.copy()
                elif k == "Dinner":
                    new_data["Dinner Veg"] = v
                    new_data["Dinner Non-Veg"] = v.copy()
                else:
                    new_data[k] = v
            weekly[day] = new_data
    db.weekly_menu.replace_one({"_id": "default"}, weekly)
    print("Migrated weekly_menu")

# Migrate old daily menus
menus = db.menus.find({})
count = 0
for menu in menus:
    if "items" in menu:
        day_data = menu["items"]
        new_data = {}
        for k, v in day_data.items():
            if k == "Morning Tea": new_data["Morning Tea/Milk"] = v
            elif k == "Evening Tea": new_data["Evening Tea/Milk"] = v
            elif k == "Evening Snacks": new_data["Snacks"] = v
            elif k == "Lunch": 
                new_data["Lunch Veg"] = v
                new_data["Lunch Non-Veg"] = v.copy()
            elif k == "Dinner":
                new_data["Dinner Veg"] = v
                new_data["Dinner Non-Veg"] = v.copy()
            else:
                new_data[k] = v
        menu["items"] = new_data
        db.menus.replace_one({"_id": menu["_id"]}, menu)
        count += 1
print(f"Migrated {count} menus")
