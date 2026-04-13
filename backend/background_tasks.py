import threading
import time
from datetime import datetime
import random
from database import db
from bson import ObjectId

def process_auto_orders():
    """
    Main logic for processing daily auto orders for students.
    Checks menus for Today and Tomorrow, and auto-books if the student hasn't booked yet.
    """
    now = datetime.now()
    from datetime import timedelta
    
    # Process both today and tomorrow
    for offset in [0, 1]:
        target_date = now + timedelta(days=offset)
        target_str = target_date.strftime("%Y-%m-%d")
        day_name = target_date.strftime("%A") # e.g., 'Monday'

        # Check if a menu is published for the target date
        target_menu = db.menus.find_one({"date": target_str})
        if not target_menu:
            continue

        # Check if deadline passed
        try:
            if "T" in target_menu.get('deadline', ''):
                deadline_dt = datetime.strptime(target_menu['deadline'], "%Y-%m-%dT%H:%M")
            else:
                deadline_time = datetime.strptime(target_menu.get('deadline', '23:59'), "%H:%M").time()
                deadline_dt = datetime.combine(datetime.strptime(target_str, "%Y-%m-%d").date(), deadline_time)
                
            if now > deadline_dt:
                continue # Deadline passed, can't auto-book
        except Exception:
            pass

        # Only process users who have autoConfig enabled
        active_users = db.users.find({
            "role": "Student",
            "autoConfig.enabled": True
        })

        for user in active_users:
            # Check if user already has a booking for this date
            existing_booking = db.bookings.find_one({"studentId": str(user['_id']), "date": target_str})
            if existing_booking:
                continue # Already booked manually or automatically for this day
                
            # Check if we already failed auto-booking for this date (prevent spam)
            failed_dates = user.get('autoConfig', {}).get('failedDates', [])
            if target_str in failed_dates:
                continue

            config = user.get('autoConfig', {})
            plan = config.get('plan', {})
            target_plan = plan.get(day_name, {})
            
            # If target day's plan is empty or all zeroes, skip
            if not target_plan or all(qty == 0 for qty in target_plan.values()):
                continue

            # Check if user is blocked
            if user.get("isBlocked"):
                continue

            # Prepare booking details based on target day's plan
            meals_to_book = []
            meal_qty_map = {}
            total_price = 0
            item_codes = {}
            item_prices = {}

            for dish, qty in target_plan.items():
                if qty > 0 and dish in target_menu.get("items", {}):
                    base_name = dish
                    display_name = f"{dish} x{qty}" if qty > 1 else dish
                    meals_to_book.append(display_name)
                    meal_qty_map[dish] = qty

                    price = int(target_menu["items"][dish].get("price", 0))
                    total_price += price * qty
                    item_prices[dish] = price
                    item_codes[dish] = str(random.randint(1000, 9999))

            if not meals_to_book:
                continue

            # Wallet / Payment Logic
            auto_pay = config.get("autoPay", False)
            wallet_balance = user.get("walletBalance", 0)

            if total_price > 0:
                if auto_pay and wallet_balance >= total_price:
                    # Deduct format setup
                    db.users.update_one({"_id": user['_id']}, {"$inc": {"walletBalance": -total_price}})
                else:
                    msg = ""
                    if not auto_pay:
                        msg = f"Auto booking skipped for {target_str}. Auto-payment is disabled but total was ₹{total_price}."
                    else:
                        msg = f"Auto booking failed for {target_str} due to low wallet balance. Required: ₹{total_price}, Available: ₹{wallet_balance}."
                        
                    db.notifications.insert_one({
                        "studentId": str(user['_id']),
                        "type": "error",
                        "message": msg,
                        "createdAt": datetime.now(),
                        "read": False
                    })
                    # Mark this date as failed so we don't keep sending notifications
                    db.users.update_one({"_id": user['_id']}, {"$addToSet": {"autoConfig.failedDates": target_str}})
                    continue

            # Create booking
            booking = {
                "studentId": str(user['_id']),
                "studentRollId": user.get('studentId', ''),
                "studentName": user['name'],
                "date": target_str,
                "meals": meals_to_book,
                "mealQty": meal_qty_map,
                "codes": item_codes,
                "itemPrices": item_prices,
                "isGuest": False,
                "price": total_price,
                "status": {base_name: "Booked" for base_name in item_codes.keys()},
                "createdAt": datetime.now(),
                "isAutoBooked": True
            }
            db.bookings.insert_one(booking)

            # Send success notification
            db.notifications.insert_one({
                "studentId": str(user['_id']),
                "type": "success",
                "message": f"Your meals for {target_str} ({day_name}) are booked automatically. Used ₹{total_price}.",
                "createdAt": datetime.now(),
                "read": False
            })
            print(f"Auto-booked for {user['name']} on {target_str} ({day_name})")

def start_scheduler():
    def _run():
        while True:
            try:
                process_auto_orders()
            except Exception as e:
                print(f"Error in auto order scheduler: {e}")
            # Check every 60 seconds as a fallback
            time.sleep(60)
            
    t = threading.Thread(target=_run, daemon=True)
    t.start()
    print("Auto-order background scheduler started (polling every 1 minute).")
