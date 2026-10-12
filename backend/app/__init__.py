from flask import Flask
from flask_cors import CORS

from .routes.products import products_bp
from .routes.sales import sales_bp
from .routes.reports import reports_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config.Config")

    # Permitir peticiones CORS desde el frontend
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Registrar Blueprints
    app.register_blueprint(products_bp, url_prefix="/api")
    app.register_blueprint(sales_bp, url_prefix="/api")
    app.register_blueprint(reports_bp, url_prefix="/api")

    # Endpoint directo de salud
    @app.route("/health")
    def health():
        return {"status": "ok", "service": "kiosco-pos-mvp"}, 200

    return app