#!/usr/bin/env python3
"""
Script to clean up multiple admin accounts and keep only one
"""

import pymongo
from pymongo import MongoClient
import datetime

def cleanup_admin_accounts():
    """Remove all admin accounts except the first one created"""
    try:
        # Connect to MongoDB
        client = MongoClient('mongodb+srv://tourapp_user:Prenit9091@cluster0.ohen7ao.mongodb.net/tourapp?retryWrites=true&w=majority&appName=Cluster0')
        db = client.tourapp
        
        print("Cleaning up Admin Accounts...")
        print("=" * 50)
        
        # Find all admin users
        admin_users = list(db.users.find({'role': 'admin'}).sort('created_at', 1))
        
        if len(admin_users) == 0:
            print("✅ No admin users found")
            return True
        elif len(admin_users) == 1:
            print("✅ Only one admin user found - no cleanup needed")
            print(f"   Admin: {admin_users[0].get('fullName')} ({admin_users[0].get('email')})")
            return True
        
        print(f"Found {len(admin_users)} admin users:")
        for i, admin in enumerate(admin_users, 1):
            print(f"{i}. {admin.get('fullName')} ({admin.get('email')}) - Created: {admin.get('created_at')}")
        
        # Keep the first admin (oldest by creation date)
        admin_to_keep = admin_users[0]
        admins_to_remove = admin_users[1:]
        
        print(f"\nKeeping: {admin_to_keep.get('fullName')} ({admin_to_keep.get('email')})")
        print(f"Removing {len(admins_to_remove)} admin(s):")
        
        for admin in admins_to_remove:
            print(f"  - {admin.get('fullName')} ({admin.get('email')})")
        
        # Confirm before deletion
        confirm = input("\nProceed with cleanup? (y/N): ").strip().lower()
        if confirm != 'y':
            print("❌ Cleanup cancelled")
            return False
        
        # Remove the extra admin accounts
        removed_count = 0
        for admin in admins_to_remove:
            result = db.users.delete_one({'_id': admin['_id']})
            if result.deleted_count == 1:
                removed_count += 1
                print(f"✅ Removed admin: {admin.get('fullName')} ({admin.get('email')})")
            else:
                print(f"❌ Failed to remove admin: {admin.get('fullName')} ({admin.get('email')})")
        
        # Verify final state
        final_admin_count = db.users.count_documents({'role': 'admin'})
        print(f"\nFinal admin count: {final_admin_count}")
        
        if final_admin_count == 1:
            print("✅ Cleanup successful - only one admin remains")
            remaining_admin = db.users.find_one({'role': 'admin'})
            print(f"   Remaining admin: {remaining_admin.get('fullName')} ({remaining_admin.get('email')})")
            return True
        else:
            print(f"❌ Cleanup failed - {final_admin_count} admins still exist")
            return False
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        return False
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    cleanup_admin_accounts()
