from database import db

# Weekly Menu Data
WEEKLY_MENU = {
    "_id": "default",
    "Monday": {
        "Morning Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Morning Egg": {"name": "Boiled Egg", "price": 7},
        "Morning Banana": {"name": "Banana", "price": 7},
        "Tiffin": {"name": "Idli + Sambar + Coconut Chutney", "price": 20},
        "Lunch Veg": {"name": "Rice + Dal + Bendakaya Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Egg": {"name": "Egg Curry", "price": 7},
        "Evening Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Snacks": {"name": "Pakoda", "price": 7},
        "Dinner Veg": {"name": "Rice + Aloo Curry + Beans Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Egg": {"name": "Boiled Egg", "price": 7}
    },
    "Tuesday": {
        "Morning Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Morning Egg": {"name": "Boiled Egg", "price": 7},
        "Morning Banana": {"name": "Banana", "price": 7},
        "Tiffin": {"name": "Dosa + Chutney + Sambar", "price": 20},
        "Lunch Veg": {"name": "Rice + Sambar + Aloo Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Egg": {"name": "Egg Curry", "price": 7},
        "Evening Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Snacks": {"name": "Samosa", "price": 7},
        "Dinner Veg": {"name": "Rice + Tomato Curry + Beans Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Egg": {"name": "Boiled Egg", "price": 7}
    },
    "Wednesday": {
        "Morning Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Morning Egg": {"name": "Boiled Egg", "price": 7},
        "Morning Banana": {"name": "Banana", "price": 7},
        "Tiffin": {"name": "Upma + Chutney", "price": 20},
        "Lunch Veg": {"name": "Rice + Dal + Cabbage Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Egg": {"name": "Egg Curry", "price": 7},
        "Evening Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Snacks": {"name": "Biscuits", "price": 7},
        "Dinner Veg": {"name": "Chapati + Aloo Curry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Egg": {"name": "Boiled Egg", "price": 7}
    },
    "Thursday": {
        "Morning Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Morning Egg": {"name": "Boiled Egg", "price": 7},
        "Morning Banana": {"name": "Banana", "price": 7},
        "Tiffin": {"name": "Poori + Aloo Curry", "price": 20},
        "Lunch Veg": {"name": "Rice + Beetroot Fry + Dal + Curd + Rasam + Pickle", "price": 32},
        "Lunch Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Egg": {"name": "Egg Curry", "price": 7},
        "Evening Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Snacks": {"name": "Mirchi Bajji", "price": 7},
        "Dinner Veg": {"name": "Veg Fried Rice + Curd + Rasam + Pickle", "price": 20},
        "Dinner Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Egg": {"name": "Boiled Egg", "price": 7}
    },
    "Friday": {
        "Morning Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Morning Egg": {"name": "Boiled Egg", "price": 7},
        "Morning Banana": {"name": "Banana", "price": 7},
        "Tiffin": {"name": "Pongal + Chutney", "price": 20},
        "Lunch Veg": {"name": "Rice + Dal + Aloo Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Egg": {"name": "Egg Curry", "price": 7},
        "Evening Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Snacks": {"name": "Biscuits", "price": 7},
        "Dinner Veg": {"name": "Rice + Carrot Beans Curry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Egg": {"name": "Boiled Egg", "price": 7}
    },
    "Saturday": {
        "Morning Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Morning Egg": {"name": "Boiled Egg", "price": 7},
        "Morning Banana": {"name": "Banana", "price": 7},
        "Tiffin": {"name": "Masala Dosa + Chutney", "price": 20},
        "Lunch Veg": {"name": "Rice + Drumstick Sambar + Curry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 32},
        "Lunch Egg": {"name": "Egg Curry", "price": 7},
        "Evening Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Snacks": {"name": "Samosa", "price": 7},
        "Dinner Veg": {"name": "Rice + Vankaya Curry + Potato Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Egg": {"name": "Boiled Egg", "price": 7}
    },
    "Sunday": {
        "Morning Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Morning Egg": {"name": "Boiled Egg", "price": 7},
        "Morning Banana": {"name": "Banana", "price": 7},
        "Tiffin": {"name": "Poori + Chole", "price": 20},
        "Lunch Veg": {"name": "Veg Biryani + Raita + Rasam + Pickle", "price": 32},
        "Lunch Non-Veg": {"name": "Chicken Biryani + Raita + Rasam + Pickle", "price": 32},
        "Lunch Egg": {"name": "Boiled Egg", "price": 7},
        "Evening Tea/Milk": {"name": "Tea / Milk", "price": 10},
        "Snacks": {"name": "Mixture", "price": 7},
        "Dinner Veg": {"name": "Rice + Paneer Curry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Non-Veg": {"name": "Rice + Chicken Curry + Fry + Curd + Rasam + Pickle", "price": 20},
        "Dinner Egg": {"name": "Boiled Egg", "price": 7}
    }
}

def set_weekly_menu():
    print("Setting weekly menu in database...")
    db.weekly_menu.update_one({"_id": "default"}, {"$set": WEEKLY_MENU}, upsert=True)
    print("Weekly menu updated successfully!")

if __name__ == "__main__":
    set_weekly_menu()
