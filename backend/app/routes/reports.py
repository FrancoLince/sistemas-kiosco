from flask import Blueprint, jsonify
from ..database import get_connection
from psycopg.rows import dict_row

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/reports/daily", methods=["GET"])
def get_daily_report():
    try:
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Consulta para obtener el total recaudado hoy y desglose por método de pago
                cur.execute(
                    """
                    SELECT 
                        payment_method,
                        COUNT(id) as total_sales,
                        SUM(total) as total_amount
                    FROM pos_sales
                    WHERE DATE(created_at) = CURRENT_DATE
                    GROUP BY payment_method
                    """
                )
                rows = cur.fetchall()
                return jsonify({"success": True, "data": [dict(r) for r in rows]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500