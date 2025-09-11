import pymongo
from pymongo import MongoClient
from passlib.hash import bcrypt

try:
    # Connect to tourapp database
    client = MongoClient('mongodb://localhost:27017/')
    db = client.tourapp
    
    print("✅ Connected to tourapp database!")
    
    # Update passwords for all users
    users_to_update = [
        {"email": "testmanager@test.com", "password": "manager123"},
        {"email": "ahmad@gmail.com", "password": "admin123"},
        {"email": "ahmadsyed7070@gmail.com", "password": "employee123"},
        {"email": "syed@gamil.com", "password": "manager123"},
        {"email": "ahmad.prenit@gmail.com", "password": "employee123"},
        {"email": "koli.prenitworld@gmail.com", "password": "employee123"}
    ]
    
    for user_data in users_to_update:
        email = user_data["email"]
        password = user_data["password"]
        
        # Hash the password
        hashed_password = bcrypt.hash(password)
        
        # Update user password
        result = db.users.update_one(
            {"email": email},
            {"$set": {"password": hashed_password}}
        )
        
        if result.modified_count > 0:
            print(f"✅ Updated password for {email} to: {password}")
        else:
            print(f"⚠️  No changes for {email}")
    
    print(f"\n🔑 Updated credentials for testing:")
    print(f"  Manager: testmanager@test.com / manager123")
    print(f"  Admin: ahmad@gmail.com / admin123")
    print(f"  Employee: ahmadsyed7070@gmail.com / employee123")
    print(f"  Manager: syed@gamil.com / manager123")
    print(f"  Employee: ahmad.prenit@gmail.com / employee123")
    print(f"  Employee: koli.prenitworld@gmail.com / employee123")
    
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'client' in locals():
        client.close()
