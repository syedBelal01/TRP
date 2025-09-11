#!/usr/bin/env python3
"""
Debug script to test endpoints and MongoDB connection
"""
import requests
import json

def test_register():
    """Test the register endpoint"""
    url = "http://localhost:5000/register"
    data = {
        "email": "test@test.com",
        "password": "test123",
        "fullName": "Test User",
        "role": "employee"
    }
    
    try:
        response = requests.post(url, json=data, timeout=10)
        print(f"Register Status Code: {response.status_code}")
        print(f"Register Response: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"Register Error: {e}")
        return False

def test_login():
    """Test the login endpoint"""
    url = "http://localhost:5000/login"
    data = {
        "email": "test@test.com",
        "password": "test123"
    }
    
    try:
        response = requests.post(url, json=data, timeout=10)
        print(f"Login Status Code: {response.status_code}")
        print(f"Login Response: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"Login Error: {e}")
        return False

def test_health():
    """Test if the server is responding"""
    url = "http://localhost:5000/"
    
    try:
        response = requests.get(url, timeout=5)
        print(f"Health Status Code: {response.status_code}")
        print(f"Health Response: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health Error: {e}")
        return False

if __name__ == "__main__":
    print("🔍 Testing Backend Endpoints")
    print("=" * 40)
    
    print("\n1. Testing server health...")
    test_health()
    
    print("\n2. Testing register endpoint...")
    test_register()
    
    print("\n3. Testing login endpoint...")
    test_login()
