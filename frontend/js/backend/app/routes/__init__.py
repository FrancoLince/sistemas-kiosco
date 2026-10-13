from flask import Flask
from flask_cors import CORS
from app.config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Permitir CORS para comunicación con el frontend
    CORS(app)

    # Importar y registrar blueprints
    from app.routes.products import products_bp
    from app.routes.sales import sales_bp
    from app.routes.reports import reports_bp

    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(sales_bp, url_prefix='/api/sales')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')

    return app