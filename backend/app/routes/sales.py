from flask import Blueprint, jsonify, request
from ..database import process_sale_transaction, fetch_product_by_barcode, fetch_all_products

sales_bp = Blueprint("sales", __name__)

@sales_bp.route("/products", methods=["GET"])
def get_products():
    try:
        products = fetch_all_products()
        return jsonify({"success": True, "data": products}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@sales_bp.route("/products/barcode/<barcode>", methods=["GET"])
def get_by_barcode(barcode):
    try:
        product = fetch_product_by_barcode(barcode)
        if not product:
            return jsonify({"success": False, "error": "Producto no encontrado"}), 404
        return jsonify({"success": True, "data": product}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@sales_bp.route("/sales", methods=["POST"])
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