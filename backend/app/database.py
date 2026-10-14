from __future__ import annotations
import json
import os
from typing import Any, Optional
import psycopg
from psycopg.rows import dict_row

def get_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL no está configurado")
    return psycopg.connect(database_url, row_factory=dict_row)

# Alias para mantener compatibilidad con la importación en otros módulos
get_db_connection = get_connection

# Buscar producto por código de barras o ID
def fetch_product_by_barcode(barcode: str) -> Optional[dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, barcode, name, price, COALESCE(cost_price, 0.00) AS cost_price, stock FROM pos_products WHERE barcode = %s AND is_active = TRUE",
                (barcode,)
            )
            row = cur.fetchone()
            return dict(row) if row else None

# Obtener todos los productos
def fetch_all_products() -> list[dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, barcode, name, price, COALESCE(cost_price, 0.00) AS cost_price, stock FROM pos_products WHERE is_active = TRUE ORDER BY name ASC")
            return [dict(row) for row in cur.fetchall()]

# Registrar Venta y Descontar Stock en una sola Transacción Atómica
def process_sale_transaction(payment_method: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 1. Calcular total de la venta
            total = sum(float(item["price"]) * int(item["quantity"]) for item in items)

            # 2. Insertar Venta (Cabecera)
            cur.execute(
                "INSERT INTO pos_sales (total, payment_method) VALUES (%s, %s) RETURNING id, created_at, total, payment_method",
                (total, payment_method)
            )
            sale = cur.fetchone()
            sale_id = sale["id"]

            # 3. Insertar Detalle guardando precio de costo histórico y descontar stock
            for item in items:
                product_id = item["id"]
                qty = int(item["quantity"])
                price = float(item["price"])
                subtotal = price * qty

                # Obtener el precio de costo actual del producto
                cur.execute("SELECT COALESCE(cost_price, 0.00) AS cost_price FROM pos_products WHERE id = %s;", (product_id,))
                prod_row = cur.fetchone()
                unit_cost = float(prod_row["cost_price"]) if prod_row else 0.00

                # Insertar ítem vendido incluyendo unit_cost
                cur.execute(
                    """
                    INSERT INTO pos_sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, subtotal)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (sale_id, product_id, item["name"], qty, price, unit_cost, subtotal)
                )

                # Descontar stock (sin permitir valores negativos)
                cur.execute(
                    "UPDATE pos_products SET stock = GREATEST(0, stock - %s) WHERE id = %s",
                    (qty, product_id)
                )

            conn.commit()
            return dict(sale)
