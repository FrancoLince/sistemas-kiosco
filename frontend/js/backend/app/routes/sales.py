from flask import Blueprint, jsonify, request
from app.database import process_sale_transaction, fetch_product_by_barcode, fetch_all_products

sales_bp = Blueprint("sales", __name__)

@sales_bp.route("", methods=["POST"])
def create_sale():
    payload = request.get_json(silent=True) or {}
    items = payload.get("items", [])
    payment_method = payload.get("payment_method", "efectivo")

    if not items:
        return jsonify({"success": False, "error": "El carrito de venta está vacío"}), 400

    try:
        sale = process_sale_transaction(payment_method, items)
        return jsonify({"success": True, "data": sale}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500