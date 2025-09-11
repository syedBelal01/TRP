"""
Database configuration and connection setup for MongoDB Atlas
"""
import os
from pymongo import MongoClient
from flask_pymongo import PyMongo
from urllib.parse import quote_plus

# MongoDB Atlas connection string with correct password
MONGODB_URI = "mongodb+srv://tourapp_user:Prenit9091@cluster0.ohen7ao.mongodb.net/tourapp?retryWrites=true&w=majority&appName=Cluster0"

# Database name
DATABASE_NAME = "tourapp"

def get_mongo_client():
    """
    Create and return a MongoDB client connection
    """
    try:
        client = MongoClient(MONGODB_URI)
        # Test the connection
        client.admin.command('ping')
        print("Successfully connected to MongoDB Atlas!")
        return client
    except Exception as e:
        print(f"Failed to connect to MongoDB Atlas: {e}")
        raise e

def get_database():
    """
    Get the database instance
    """
    client = get_mongo_client()
    return client[DATABASE_NAME]

def get_collections():
    """
    Get all collection references
    """
    db = get_database()
    return {
        'users': db.users,
        'advance_requests': db.advance_requests,
        'notifications': db.notifications,
        'otp_verifications': db.otp_verifications
    }

def test_connection():
    """
    Test the MongoDB connection
    """
    try:
        client = get_mongo_client()
        db = client[DATABASE_NAME]
        
        # Test basic operations
        collections = db.list_collection_names()
        print(f"Connected to database: {DATABASE_NAME}")
        print(f"Available collections: {collections}")
        
        # Test a simple query
        user_count = db.users.count_documents({})
        print(f"Total users in database: {user_count}")
        
        client.close()
        return True
    except Exception as e:
        print(f"Connection test failed: {e}")
        return False

if __name__ == "__main__":
    # Test the connection when running this file directly
    test_connection()
