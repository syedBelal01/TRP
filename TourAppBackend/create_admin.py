#!/usr/bin/env python3
"""
Script to create an admin user directly in the database for testing
"""

import requests
import json

BASE_URL = 'http://192.168.3.251:5000'

def create_admin_directly():
    """Create an admin user directly by calling the admin registration endpoint"""
    try:
        # Try to use the admin registration endpoint
        response = requests.post(f'{BASE_URL}/admin/register', json={
            'email': 'testadmin@example.com',
            'fullName': 'Test Admin',
            'password': 'admin123',
            'role': 'admin'
        })
        print(f"Direct admin creation:")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.text}")
        print()
        return response
    except Exception as e:
        print(f"Error creating admin directly: {e}")
        return None

def test_admin_login():
    """Test admin login"""
    try:
        response = requests.post(f'{BASE_URL}/login', json={
            'email': 'testadmin@example.com', 
            'password': 'admin123'
        })
        print(f"Admin login test:")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.text}")
        print()
        return response
    except Exception as e:
        print(f"Error testing admin login: {e}")
        return None

if __name__ == "__main__":
    print("Creating admin user directly...")
    print("="*50)
    
    # Create admin user
    create_admin_directly()
    
    # Test admin login
    test_admin_login()
