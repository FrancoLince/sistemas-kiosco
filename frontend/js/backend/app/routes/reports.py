from flask import Blueprint, jsonify
from app.database import get_db_connection

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/daily-summary', methods=['GET'])
def get_daily_summary():
    """Obtiene el resumen de ventas e ingresos del día actual."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Total de ventas e ingresos de hoy
            cur.execute("""
                SELECT 
                    COUNT(id) AS total_sales,
                    COALESCE(SUM(total_amount), 0) AS total_revenue
                FROM pos_sales
                WHERE DATE(created_at) = CURRENT_DATE;
            """)
            summary = cur.fetchone()

            # Métodos de pago usados hoy
            cur.execute("""
                SELECT 
                    payment_method, 
                    COALESCE(SUM(total_amount), 0) as total
                FROM pos_sales
                WHERE DATE(created_at) = CURRENT_DATE
                GROUP BY payment_method;
            """)
            payment_methods = cur.fetchall()

        conn.close()

        return jsonify({
            'success': True,
            'data': {
                'total_sales': summary['total_sales'],
                'total_revenue': float(summary['total_revenue']),
                'by_payment_method': payment_methods
            }
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@reports_bp.route('/top-products', methods=['GET'])
def get_top_products():
    """Obtiene los 5 productos más vendidos."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    p.name,
                    SUM(si.quantity) AS total_units_sold,
                    SUM(si.quantity * si.unit_price) AS total_generated
                FROM pos_sale_items si
                JOIN pos_products p ON si.product_id = p.id
                GROUP BY p.id, p.name
                ORDER BY total_units_sold DESC
                LIMIT 5;
            """)
            top_products = cur.fetchall()

        conn.close()

        return jsonify({
            'success': True,
            'products': top_products
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500