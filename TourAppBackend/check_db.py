import pymongo
from pymongo import MongoClient

try:
    # Connect to MongoDB
    client = MongoClient('mongodb://localhost:27017/')
    db = client.tour_app
    
    print("✅ Database connected successfully!")
    print(f"Database name: {db.name}")
    print(f"Collections: {db.list_collection_names()}")
    
    # Check users collection
    users = list(db.users.find({}))
    print(f"\n📊 Total users in database: {len(users)}")
    
    if users:
        print("\n👥 Users found:")
        for user in users:
            print(f"  - {user.get('fullName', 'N/A')} ({user.get('email', 'N/A')}) - Role: {user.get('role', 'N/A')}")
    else:
        print("❌ No users found in database")
    
    # Check for duplicate emails
    email_counts = {}
    for user in users:
        email = user.get('email', '')
        if email:
            email_counts[email] = email_counts.get(email, 0) + 1
    
    duplicates = [email for email, count in email_counts.items() if count > 1]
    if duplicates:
        print(f"\n⚠️  Duplicate emails found: {duplicates}")
    else:
        print("\n✅ No duplicate emails found")
    
    # Check OTPs collection
    otps = list(db.otps.find({}))
    print(f"\n🔐 Total OTPs in database: {len(otps)}")
    
    # Check notifications collection
    notifications = list(db.notifications.find({}))
    print(f"📢 Total notifications in database: {len(notifications)}")
    
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'client' in locals():
        client.close()
