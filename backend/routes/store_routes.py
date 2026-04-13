from flask import Blueprint, request, jsonify
from middleware import token_required
from database import db
from bson.objectid import ObjectId
from socket_instance import socketio

store_bp = Blueprint('store_bp', __name__)

@store_bp.route('/inventory', methods=['GET'])
@token_required(['StoreManager', 'Admin'])
def get_inventory(current_user):
    items = list(db.inventory.find({}))
    for item in items:
        item['_id'] = str(item['_id'])
    return jsonify(items), 200

@store_bp.route('/inventory', methods=['POST'])
@token_required(['StoreManager', 'Admin'])
def add_inventory(current_user):
    data = request.json
    name = data.get('name')
    quantity = data.get('quantity')
    
    if not name or not quantity:
        return jsonify({"message": "Name and quantity required"}), 400
        
    db.inventory.update_one(
        {"name": name},
        {"$set": {"quantity": quantity}},
        upsert=True
    )
    socketio.emit('inventoryUpdated', {"message": "Inventory quantities updated"})
    return jsonify({"message": "Inventory updated successfully"}), 200

@store_bp.route('/requests', methods=['POST'])
@token_required(['StoreManager'])
def make_request(current_user):
    data = request.json
    item_name = data.get('itemName')
    amount = data.get('amount')
    
    if not item_name or not amount:
        return jsonify({"message": "ItemName and Amount required"}), 400
        
    req = {
        "itemName": item_name,
        "amount": amount,
        "status": "Pending"
    }
    db.store_requests.insert_one(req)
    socketio.emit('stockRequested', {"message": "New stock requested"})
    return jsonify({"message": "Request submitted to admin"}), 201
