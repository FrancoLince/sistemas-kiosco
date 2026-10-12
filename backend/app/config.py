import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    PORT = int(os.getenv("PORT", 5000))