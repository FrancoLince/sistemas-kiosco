from flask import Blueprint, jsonify
from app.database import get_db_connection

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/daily-summary', methods=['GET'])
def get_daily_summary():
    """Obtiene el resumen de ventas e ingresos del día actual y el historial reciente."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # 1. Total de ventas e ingresos de hoy por medio de pago
            cur.execute("""
                SELECT 
                    payment_method, 
                    COUNT(id) AS total_sales,
                    COALESCE(SUM(total), 0) AS total_amount
                FROM pos_sales
                WHERE DATE(created_at) = CURRENT_DATE
                GROUP BY payment_method;
            """)
            summary_rows = cur.fetchall()

            # 2. Historial de las últimas 50 ventas del día con el detalle de sus ítems
            cur.execute("""
                SELECT 
                    s.id,
                    s.total,
                    s.payment_method,
                    s.created_at,
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'product_name', i.product_name,
                            'quantity', i.quantity,
                            'unit_price', i.unit_price,
                            'subtotal', i.subtotal
                        )
                    ) AS items
                FROM pos_sales s
                JOIN pos_sale_items i ON s.id = i.sale_id
                WHERE DATE(s.created_at) = CURRENT_DATE
                GROUP BY s.id
                ORDER BY s.created_at DESC
                LIMIT 50;
            """)
            sales_history = cur.fetchall()

        conn.close()

        # Armar diccionario de totales por medio de pago
        totals_by_method = {row['payment_method']: float(row['total_amount']) for row in summary_rows}
        grand_total = sum(totals_by_method.values())

        return jsonify({
            'success': True,
            'data': {
                'grand_total': grand_total,
                'by_payment_method': totals_by_method,
                'sales_history': sales_history
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
