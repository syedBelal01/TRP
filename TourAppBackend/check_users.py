#!/usr/bin/env python3
"""
Script to check existing users in the database
"""

import requests
import json

BASE_URL = 'https://54.91.37.236'

def test_login(email, password):
    """Test login with given credentials"""
    try:
        response = requests.post(f'{BASE_URL}/login', json={'email': email, 'password': password})
        print(f"Login for {email}:")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.text}")
        print()
        return response
    except Exception as e:
        print(f"Error testing login for {email}: {e}")
        return None

def test_health():
    """Test if the server is responding"""
    try:
        response = requests.get(f'{BASE_URL}/health')
        print(f"Health check:")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.text}")
        print()
        return response
    except Exception as e:
        print(f"Error testing health: {e}")
        return None

def test_registration():
    """Test user registration"""
    try:
        response = requests.post(f'{BASE_URL}/register', json={
            'fullName': 'Test User',
            'email': 'testuser@example.com',
            'password': 'testpass123',
            'role': 'employee'
        })
        print(f"Registration test:")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.text}")
        print()
        return response
    except Exception as e:
        print(f"Error testing registration: {e}")
        return None

def test_admin_check():
    """Test admin check endpoint"""
    try:
        response = requests.get(f'{BASE_URL}/admin/check-exists')
        print(f"Admin check:")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.text}")
        print()
        return response
    except Exception as e:
        print(f"Error testing admin check: {e}")
        return None

if __name__ == "__main__":
    print("Testing TourApp API endpoints...")
    print("="*50)
    
    # Test health endpoint
    test_health()
    
    # Test admin check
    test_admin_check()
    
    # Test registration
    test_registration()
    
    # Test login with existing users
    test_login('ahmad.prenit@gmail.com', 'admin123')
    test_login('testuser@example.com', 'testpass123')