"""
Production configuration for TourApp Backend
"""
import os

class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-change-in-production'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'your-jwt-secret-key-change-in-production'
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours in seconds
    
    # MongoDB Atlas configuration
    MONGO_URI = os.environ.get('MONGO_URI') or 'mongodb+srv://tourapp_user:Prenit9091@cluster0.ohen7ao.mongodb.net/tourapp?retryWrites=true&w=majority&appName=Cluster0'
    
    # Email configuration
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'smtp.gmail.com'
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME') or 'contactnitin.k@gmail.com'
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') or 'alne vbwh niaj sedo'
    
    # Development mode
    DEVELOPMENT_MODE = os.environ.get('DEVELOPMENT_MODE', 'false').lower() in ['true', 'on', '1']

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    DEVELOPMENT_MODE = False
    
class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    DEVELOPMENT_MODE = True

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
