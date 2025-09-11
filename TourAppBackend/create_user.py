import pymongo
from pymongo import MongoClient
from passlib.hash import bcrypt
import datetime

try:
    # Connect to MongoDB
    client = MongoClient('mongodb://localhost:27017/')
    db = client.tour_app
    
    print("✅ Database connected successfully!")
    
    # Check if user already exists
    existing_user = db.users.find_one({"email": "tarun@tarun.com"})
    
    if existing_user:
        print(f"👤 User already exists: {existing_user.get('fullName')}")
        print("🔄 Updating password...")
        
        # Update password
        hashed_password = bcrypt.hash("password123")
        db.users.update_one(
            {"email": "tarun@tarun.com"},
            {"$set": {"password": hashed_password}}
        )
        print("✅ Password updated successfully!")
        
    else:
        print("👤 Creating new user...")
        
        # Create new user
        hashed_password = bcrypt.hash("password123")
        new_user = {
            "email": "tarun@tarun.com",
            "password": hashed_password,
            "fullName": "Tarun",
            "role": "manager",
            "created_at": datetime.datetime.now(),
            "is_active": True
        }
        
        result = db.users.insert_one(new_user)
        print(f"✅ User created successfully! ID: {result.inserted_id}")
    
    # Verify user exists
    user = db.users.find_one({"email": "tarun@tarun.com"})
    if user:
        print(f"\n📋 User details:")
        print(f"  Name: {user.get('fullName')}")
        print(f"  Email: {user.get('email')}")
        print(f"  Role: {user.get('role')}")
        print(f"  Has Password: {'Yes' if user.get('password') else 'No'}")
        print(f"  Active: {user.get('is_active', 'Unknown')}")
    
    print(f"\n🔑 Test credentials:")
    print(f"  Email: tarun@tarun.com")
    print(f"  Password: password123")
    
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'client' in locals():
        client.close()
