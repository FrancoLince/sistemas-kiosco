from flask import Blueprint, request, jsonify
from app.database import get_db_connection
import psycopg

products_bp = Blueprint('products', __name__)

@products_bp.route('', methods=['GET'])
def get_products():
    """Obtiene todos los productos activos del catálogo."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, barcode, price, stock, image_url 
                FROM pos_products 
                WHERE is_active = TRUE
                ORDER BY name ASC;
            """)
            products = cur.fetchall()
        conn.close()
        return jsonify(products), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@products_bp.route('', methods=['POST'])
def create_product():
    """Crea un nuevo producto en el catálogo."""
    data = request.get_json() or {}
    name = data.get('name')
    barcode = data.get('barcode')
    price = data.get('price')
    stock = data.get('stock', 0)
    image_url = data.get('image_url')

    if barcode and isinstance(barcode, str):
        barcode = barcode.strip() or None

    if image_url and isinstance(image_url, str):
        image_url = image_url.strip() or None

    if not name or price is None:
        return jsonify({'error': 'El nombre y el precio son obligatorios'}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO pos_products (name, barcode, price, stock, image_url, is_active)
                VALUES (%s, %s, %s, %s, %s, TRUE)
                RETURNING id, name, barcode, price, stock, image_url;
            """, (name, barcode, price, stock, image_url))
            new_product = cur.fetchone()
            conn.commit()
        conn.close()
        return jsonify({'success': True, 'product': new_product}), 201
    except psycopg.errors.UniqueViolation:
        return jsonify({'error': 'Ya existe un producto registrado con ese código de barras.'}), 400
    except Exception as e:
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500


@products_bp.route('/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    """Actualiza precio, stock, imagen o datos de un producto."""
    data = request.get_json() or {}
    barcode = data.get('barcode')
    image_url = data.get('image_url')

    if barcode and isinstance(barcode, str):
        barcode = barcode.strip() or None

    if image_url and isinstance(image_url, str):
        image_url = image_url.strip() or None

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE pos_products
                SET name = COALESCE(%s, name),
                    barcode = %s,
                    price = COALESCE(%s, price),
                    stock = COALESCE(%s, stock),
                    image_url = %s
                WHERE id = %s AND is_active = TRUE
                RETURNING id, name, barcode, price, stock, image_url;
            """, (data.get('name'), barcode, data.get('price'), data.get('stock'), image_url, product_id))
            updated_product = cur.fetchone()
            conn.commit()
        conn.close()

        if not updated_product:
            return jsonify({'error': 'Producto no encontrado'}), 404

        return jsonify({'success': True, 'product': updated_product}), 200
    except psycopg.errors.UniqueViolation:
        return jsonify({'error': 'Ya existe otro producto registrado con ese código de barras.'}), 400
    except Exception as e:
        return jsonify({'error': f'Error en el servidor: {str(e)}'}), 500


@products_bp.route('/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    """Realiza un borrado lógico del producto."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE pos_products 
                SET is_active = FALSE 
                WHERE id = %s RETURNING id;
            """, (product_id,))
            deleted = cur.fetchone()
            conn.commit()
        conn.close()

        if not deleted:
            return jsonify({'error': 'Producto no encontrado'}), 404

        return jsonify({'success': True, 'message': 'Producto eliminado correctamente'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
