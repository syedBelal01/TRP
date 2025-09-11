#!/usr/bin/env python3
"""
Script to check existing users in the database
"""

import requests
import json

BASE_URL = 'http://192.168.3.251:5000'

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

def test_registration(email, fullName, password, role):
    """Test registration with given credentials"""
    try:
        response = requests.post(f'{BASE_URL}/register', json={
            'email': email, 
            'fullName': fullName, 
            'password': password, 
            'role': role
        })
        print(f"Registration for {email} ({role}):")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.text}")
        print()
        return response
    except Exception as e:
        print(f"Error testing registration for {email}: {e}")
        return None

if __name__ == "__main__":
    print("Testing user accounts...")
    print("="*50)
    
    # Test existing admin login
    test_login('admin@example.com', 'admin123')
    test_login('admin2@example.com', 'admin123')
    
    # Test employee registration
    test_registration('employee@example.com', 'Test Employee', 'password123', 'employee')
    
    # Test manager registration
    test_registration('manager@example.com', 'Test Manager', 'password123', 'manager')
