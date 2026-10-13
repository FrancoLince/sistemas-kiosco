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
                SELECT id, name, barcode, price, stock 
                FROM pos_products 
                ORDER BY name ASC;
            """)
            products = cur.fetchall()
        conn.close()
        return jsonify(products), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@products_bp.route('/barcode/<barcode>', methods=['GET'])
def get_by_barcode(barcode):
    """Busca un producto individual por código de barras."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, barcode, price, stock 
                FROM pos_products 
                WHERE barcode = %s;
            """, (barcode,))
            product = cur.fetchone()
        conn.close()

        if not product:
            return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404

        return jsonify({'success': True, 'data': product}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@products_bp.route('', methods=['POST'])
def create_product():
    """Crea un nuevo producto en el catálogo."""
    data = request.get_json() or {}
    name = data.get('name')
    barcode = data.get('barcode')
    price = data.get('price')
    stock = data.get('stock', 0)

    # Convertir strings vacíos o de puros espacios a None para evitar violaciones UNIQUE
    if barcode and isinstance(barcode, str):
        barcode = barcode.strip()
        if not barcode:
            barcode = None

    if not name or price is None:
        return jsonify({'error': 'El nombre y el precio son obligatorios'}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO pos_products (name, barcode, price, stock)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, barcode, price, stock;
            """, (name, barcode, price, stock))
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
    """Actualiza precio, stock o datos de un producto."""
    data = request.get_json() or {}
    barcode = data.get('barcode')

    if barcode and isinstance(barcode, str):
        barcode = barcode.strip()
        if not barcode:
            barcode = None

    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE pos_products
                SET name = COALESCE(%s, name),
                    barcode = COALESCE(%s, barcode),
                    price = COALESCE(%s, price),
                    stock = COALESCE(%s, stock)
                WHERE id = %s
                RETURNING id, name, barcode, price, stock;
            """, (data.get('name'), barcode, data.get('price'), data.get('stock'), product_id))
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