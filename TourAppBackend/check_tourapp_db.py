import pymongo
from pymongo import MongoClient

try:
    # Connect to tourapp database
    client = MongoClient('mongodb://localhost:27017/')
    db = client.tourapp
    
    print("✅ Connected to tourapp database!")
    print(f"Database name: {db.name}")
    print(f"Collections: {db.list_collection_names()}")
    
    # Check users collection
    users = list(db.users.find({}))
    print(f"\n📊 Total users in tourapp database: {len(users)}")
    
    if users:
        print("\n👥 Users found:")
        for user in users:
            print(f"  - {user.get('fullName', 'N/A')} ({user.get('email', 'N/A')}) - Role: {user.get('role', 'N/A')}")
            if 'password' in user:
                print(f"    Has password: Yes")
            else:
                print(f"    Has password: No")
    else:
        print("❌ No users found in tourapp database")
    
    # Check pending_registrations
    pending = list(db.pending_registrations.find({}))
    print(f"\n📝 Pending registrations: {len(pending)}")
    
    # Check advance_requests
    requests = list(db.advance_requests.find({}))
    print(f"📋 Advance requests: {len(requests)}")
    
    # Check notifications
    notifications = list(db.notifications.find({}))
    print(f"📢 Notifications: {len(notifications)}")
    
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'client' in locals():
        client.close()
