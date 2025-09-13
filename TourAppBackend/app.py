from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from passlib.hash import bcrypt
import datetime
import os
from bson import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import random
import string
from db import test_connection
from flasgger import Swagger, swag_from

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['MONGO_URI'] = 'mongodb+srv://tourapp_user:Prenit9091@cluster0.ohen7ao.mongodb.net/tourapp?retryWrites=true&w=majority&appName=Cluster0'
app.config['JWT_SECRET_KEY'] = 'your-jwt-secret-key-here'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(hours=24)

# Development mode flag
DEVELOPMENT_MODE = True  # Set to False in production

# Email configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'contactnitin.k@gmail.com'  # TODO: Update with your Gmail
app.config['MAIL_PASSWORD'] = 'alne vbwh niaj sedo'  # Your Gmail app password

CORS(app)
jwt = JWTManager(app)
mongo = PyMongo(app)

# Swagger configuration
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": 'apispec',
            "route": '/apispec.json',
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/swagger"
}

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "TourApp API",
        "description": "Travel Requisition Portal API Documentation",
        "version": "1.0.0",
        "contact": {
            "name": "TourApp Support",
            "email": "support@tourapp.com"
        }
    },
    "host": "54.91.37.236",
    "basePath": "/",
    "schemes": ["http"],
    "consumes": ["application/json"],
    "produces": ["application/json"],
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\""
        }
    }
}

swagger = Swagger(app, config=swagger_config, template=swagger_template)

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for load balancer and monitoring
    ---
    tags:
      - System
    responses:
      200:
        description: Service is healthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: healthy
            database:
              type: string
              example: connected
            timestamp:
              type: string
              example: "2025-09-11T12:22:57.378194"
      503:
        description: Service is unhealthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: unhealthy
            database:
              type: string
              example: disconnected
            error:
              type: string
              example: "Connection failed"
            timestamp:
              type: string
              example: "2025-09-11T12:22:57.378194"
    """
    try:
        # Test database connection
        mongo.db.users.find_one()
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'timestamp': datetime.datetime.now().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'database': 'disconnected',
            'error': str(e),
            'timestamp': datetime.datetime.now().isoformat()
        }), 503

# Helper function to create notifications
def create_notification(recipient_role, message, notification_type, request_id=None, request_data=None, from_role=None, from_user=None, action=None):
    """Create a notification in the database"""
    notification = {
        'recipient_role': recipient_role,
        'message': message,
        'notification_type': notification_type,
        'request_id': request_id,
        'request_data': request_data,
        'from_role': from_role,
        'from_user': from_user,
        'action': action,  # Store the action for proper status display
        'status': 'unread',
        'created_at': datetime.datetime.now(),
        'viewed_at': None,
        'expires_at': None  # Will be set when notification is viewed
    }
    
    result = mongo.db.notifications.insert_one(notification)
    return str(result.inserted_id)

# Helper function to store user tokens
def store_user_token(user_id, token, device_info=None):
    """Store a new token for a user, allowing multiple sessions"""
    token_data = {
        'user_id': user_id,
        'token': token,
        'created_at': datetime.datetime.now(),
        'last_used': datetime.datetime.now(),
        'device_info': device_info or 'Unknown Device',
        'is_active': True
    }
    
    result = mongo.db.user_tokens.insert_one(token_data)
    return str(result.inserted_id)

# Helper function to deactivate user tokens
def deactivate_user_tokens(user_id):
    """Deactivate all tokens for a user (for logout)"""
    mongo.db.user_tokens.update_many(
        {'user_id': user_id, 'is_active': True},
        {'$set': {'is_active': False, 'deactivated_at': datetime.datetime.now()}}
    )

# Email sending function
def send_otp_email(email, otp, purpose="verification"):
    """Send OTP email using Gmail SMTP"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = app.config['MAIL_USERNAME']
        msg['To'] = email
        msg['Subject'] = f'OTP for {purpose.title()} - TourApp'
        
        # Email body
        body = f"""
        <html>
        <body>
            <h2>TourApp {purpose.title()} OTP</h2>
            <p>Your OTP for {purpose} is:</p>
            <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">{otp}</h1>
            <p>This OTP will expire in 5 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <br>
            <p>Best regards,<br>TourApp Team</p>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        # Connect to Gmail SMTP
        server = smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT'])
        server.starttls()
        server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
        
        # Send email
        text = msg.as_string()
        server.sendmail(app.config['MAIL_USERNAME'], email, text)
        server.quit()
        
        print(f"✅ OTP email sent successfully to {email}")
        print(f"🔐 Development: OTP for {email} is {otp}")
        return True, None
        
    except Exception as e:
        print(f"❌ Failed to send OTP email to {email}: {e}")
        return False, str(e)

# Helper function to create employee submission notifications
def create_employee_submission_notifications(request_id, employee_name, site_city, project):
    """Create notifications when employee submits a request"""
    request_data = {
        'employeeName': employee_name,
        'siteCity': site_city,
        'project': project
    }
    
    # Notify Manager
    create_notification(
        recipient_role='manager',
        message=f'New request submitted by {employee_name} for {project} in {site_city}',
        notification_type='request_submitted',
        request_id=request_id,
        request_data=request_data,
        from_role='employee',
        from_user=employee_name,
        action='submitted'
    )
    
    # Notify Admin
    create_notification(
        recipient_role='admin',
        message=f'New request submitted by {employee_name} for {project} in {site_city}',
        notification_type='request_submitted',
        request_id=request_id,
        request_data=request_data,
        from_role='employee',
        from_user=employee_name,
        action='submitted'
    )
    
    # Notify Accounts
    create_notification(
        recipient_role='accounts',
        message=f'New request submitted by {employee_name} for {project} in {site_city}',
        notification_type='request_submitted',
        request_id=request_id,
        request_data=request_data,
        from_role='employee',
        from_user=employee_name,
        action='submitted'
    )

# Helper function to create manager action notifications
def create_manager_action_notifications(request_id, action, employee_name, project, site_city, manager_name):
    """Create notifications when manager takes action"""
    request_data = {
        'employeeName': employee_name,
        'siteCity': site_city,
        'project': project
    }
    
    action_text = action.replace('_', ' ')
    
    # Notify Employee
    create_notification(
        recipient_role='employee',
        message=f'Your request for {project} has been {action_text} by Manager {manager_name}',
        notification_type='manager_action',
        request_id=request_id,
        request_data=request_data,
        from_role='manager',
        from_user=manager_name,
        action=action
    )
    
    # Notify Admin
    create_notification(
        recipient_role='admin',
        message=f'Manager {manager_name} {action_text} the request by {employee_name} for {project}',
        notification_type='manager_action',
        request_id=request_id,
        request_data=request_data,
        from_role='manager',
        from_user=manager_name,
        action=action
    )
    
    # Notify Accounts
    create_notification(
        recipient_role='accounts',
        message=f'Manager {manager_name} {action_text} the request by {employee_name} for {project}',
        notification_type='manager_action',
        request_id=request_id,
        request_data=request_data,
        from_role='manager',
        from_user=manager_name,
        action=action
    )

# Helper function to create admin action notifications
def create_admin_action_notifications(request_id, action, employee_name, project, site_city, admin_name):
    """Create notifications when admin takes action"""
    request_data = {
        'employeeName': employee_name,
        'siteCity': site_city,
        'project': project
    }
    
    action_text = action.replace('_', ' ')
    
    # Notify Employee
    create_notification(
        recipient_role='employee',
        message=f'Your request for {project} has been {action_text} by Admin {admin_name}',
        notification_type='admin_action',
        request_id=request_id,
        request_data=request_data,
        from_role='admin',
        from_user=admin_name,
        action=action
    )
    
    # Notify Manager
    create_notification(
        recipient_role='manager',
        message=f'Request by {employee_name} for {project} has been {action_text} by Admin {admin_name}',
        notification_type='admin_action',
        request_id=request_id,
        request_data=request_data,
        from_role='admin',
        from_user=admin_name,
        action=action
    )
    
    # Notify Accounts
    create_notification(
        recipient_role='accounts',
        message=f'Request by {employee_name} for {project} has been {action_text} by Admin {admin_name}',
        notification_type='admin_action',
        request_id=request_id,
        request_data=request_data,
        from_role='admin',
        from_user=admin_name,
        action=action
    )

# Cleanup expired notifications (run this periodically)
def cleanup_expired_notifications():
    """Remove notifications that are older than 24 hours from viewed_at"""
    cutoff_time = datetime.datetime.now() - datetime.timedelta(hours=24)
    
    # Find notifications that have been viewed and are expired
    expired_notifications = mongo.db.notifications.find({
        'viewed_at': {'$ne': None},
        'expires_at': {'$lt': datetime.datetime.now()}
    })
    
    expired_count = 0
    for notification in expired_notifications:
        mongo.db.notifications.delete_one({'_id': notification['_id']})
        expired_count += 1
    
    if expired_count > 0:
        print(f"Cleaned up {expired_count} expired notifications")
    
    return expired_count

# Database migration function
def migrate_database():
    """Migrate existing data to new structure if needed"""
    try:
        print("Starting database migration...")
        
        # Check if notifications collection exists and has the new structure
        notifications_count = mongo.db.notifications.count_documents({})
        print(f"Found {notifications_count} existing notifications")
        
        # If notifications exist, check if they need migration
        if notifications_count > 0:
            # Check if any notifications need the new fields
            notifications_needing_migration = mongo.db.notifications.find({
                '$or': [
                    {'status': {'$exists': False}},
                    {'viewed_at': {'$exists': False}},
                    {'expires_at': {'$exists': False}}
                ]
            })
            
            migration_count = 0
            for notification in notifications_needing_migration:
                # Add missing fields
                update_data = {}
                if 'status' not in notification:
                    update_data['status'] = 'unread' if not notification.get('is_read', False) else 'read'
                if 'viewed_at' not in notification:
                    update_data['viewed_at'] = None
                if 'expires_at' not in notification:
                    update_data['expires_at'] = None
                
                if update_data:
                    mongo.db.notifications.update_one(
                        {'_id': notification['_id']},
                        {'$set': update_data}
                    )
                    migration_count += 1
            
            if migration_count > 0:
                print(f"Migrated {migration_count} notifications")
        
        print("Database migration completed successfully")
        
    except Exception as e:
        print(f"Error during migration: {e}")


# ------------------- APIs -------------------

# User registration endpoint
@app.route('/register', methods=['POST'])
def register():
    """Register a new user with OTP verification and admin approval workflow"""
    try:
        data = request.get_json()
        
        # Extract user data
        email = data.get('email')
        password = data.get('password')
        full_name = data.get('fullName')
        role = data.get('role')
        
        # Validate required fields
        if not all([email, password, full_name, role]):
            return jsonify({'msg': 'All fields are required'}), 400
        
        # Validate role
        if role not in ['employee', 'manager', 'admin', 'accounts']:
            return jsonify({'msg': 'Invalid role'}), 400
        
        # Check if user already exists
        existing_user = mongo.db.users.find_one({'email': email})
        if existing_user:
            return jsonify({'msg': 'User already exists'}), 400
        
        # Check admin restriction - only one admin allowed (unless in development mode)
        if role == 'admin' and not DEVELOPMENT_MODE:
            admin_count = mongo.db.users.count_documents({'role': 'admin'})
            if admin_count > 0:
                return jsonify({'msg': 'Admin account already exists. Only one admin is allowed.'}), 400
        
        # Generate OTP
        otp = ''.join(random.choices(string.digits, k=6))
        otp_expiry = datetime.datetime.now() + datetime.timedelta(minutes=5)
        
        # Print OTP for development/testing
        print(f"🔐 Generated OTP for {email}: {otp}")
        
        # Store pending registration with OTP
        pending_registration = {
            'email': email,
            'password': bcrypt.hash(password),
            'fullName': full_name,
            'role': role,
            'otp': otp,
            'otp_expiry': datetime.datetime.now() + datetime.timedelta(minutes=5),
            'created_at': datetime.datetime.now(),
            'status': 'pending_approval'  # New field for approval status
        }
        
        # Remove any existing pending registration for this email
        mongo.db.pending_registrations.delete_one({'email': email})
        
        # Insert pending registration
        mongo.db.pending_registrations.insert_one(pending_registration)
        
        # For development mode: Admin users can be created directly without OTP
        if DEVELOPMENT_MODE and role == 'admin':
            # Create admin user directly in development mode
            user_data = {
                'email': email,
                'password': bcrypt.hash(password),
                'fullName': full_name,
                'role': role,
                'is_approved': True,
                'created_at': datetime.datetime.now(),
                'approved_at': datetime.datetime.now(),
                'approved_by': 'Development Mode (Auto-approved)'
            }
            
            # Insert into users collection
            mongo.db.users.insert_one(user_data)
            
            return jsonify({
                'msg': 'Admin account created successfully in development mode! You can now login.',
                'email': email,
                'role': role,
                'status': 'approved',
                'development_mode': True
            })
        
        # Normal OTP flow for production or non-admin users
        # Send OTP email
        success, error = send_otp_email(email, otp, "registration")
        if not success:
            # Clean up pending registration
            mongo.db.pending_registrations.delete_one({'email': email})
            return jsonify({'msg': 'Failed to send OTP email', 'error': error}), 500
        
        return jsonify({
            'msg': 'OTP sent to your email. Please verify to complete registration.',
            'email': email,
            'role': role
        })
        
    except Exception as e:
        return jsonify({'msg': 'Registration error', 'error': str(e)}), 500


@app.route('/verify-registration-otp', methods=['POST'])
def verify_registration_otp():
    """Verify OTP and complete registration (pending admin approval)"""
    try:
        data = request.get_json()
        email = data.get('email')
        otp = data.get('otp')

        if not email or not otp:
            return jsonify({'msg': 'Email and OTP are required'}), 400

        # Find pending registration
        pending = mongo.db.pending_registrations.find_one({'email': email})
        if not pending:
            return jsonify({'msg': 'No pending registration found for this email'}), 400

        # Check if OTP is expired
        if datetime.datetime.now() > pending['otp_expiry']:
            mongo.db.pending_registrations.delete_one({'email': email})
            return jsonify({'msg': 'OTP expired. Please register again.'}), 400

        # Verify OTP
        if pending.get('otp') != otp:
            return jsonify({'msg': 'Invalid OTP'}), 400

        # Check if this is an Admin user - Admin users are auto-approved
        if pending['role'] == 'admin':
            # Move admin user directly to users collection (auto-approved)
            user_data = {
                'email': pending['email'],
                'password': pending['password'],
                'fullName': pending['fullName'],
                'role': pending['role'],
                'is_approved': True,  # Admin users are auto-approved
                'created_at': pending['created_at'],
                'approved_at': datetime.datetime.now(),
                'approved_by': 'System (Auto-approved)'
            }
            
            # Insert into users collection
            mongo.db.users.insert_one(user_data)
            
            # Remove from pending registrations
            mongo.db.pending_registrations.delete_one({'email': email})
            
            return jsonify({
                'msg': 'Admin account created successfully! You can now login.',
                'email': email,
                'role': pending['role'],
                'status': 'approved'
            })
        else:
            # For non-admin users, keep in pending registrations for admin approval
            mongo.db.pending_registrations.update_one(
                {'email': email},
                {'$set': {'otp_verified': True, 'otp_verified_at': datetime.datetime.now()}}
            )

            return jsonify({
                'msg': f'OTP verified successfully! Your {pending["role"]} account is now pending admin approval.',
                'email': email,
                'role': pending['role'],
                'status': 'pending_approval'
            })

    except Exception as e:
        return jsonify({'msg': 'OTP verification error', 'error': str(e)}), 500


# Login endpoint
@app.route('/login', methods=['POST'])
def login():
    """User login without OTP verification"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'msg': 'Email and password are required'}), 400
        
        # Find user by email
        user = mongo.db.users.find_one({'email': email})
        if not user:
            return jsonify({'msg': 'Invalid email or password'}), 401
        
        # Check if user is approved (admin users are auto-approved)
        if user.get('role') != 'admin' and not user.get('is_approved', False):
            return jsonify({'msg': 'Your account is pending admin approval. Please wait for approval before logging in.'}), 403
        
        # Verify password
        if not bcrypt.verify(password, user['password']):
            return jsonify({'msg': 'Invalid email or password'}), 401
        
        # All users (including admin) login directly without OTP verification
        # Generate JWT token for user
        token = create_access_token(identity=str(user['_id']))
        
        return jsonify({
            'msg': 'Login successful!',
            'email': email,
            'user_id': str(user['_id']),
            'role': user['role'],
            'fullName': user.get('fullName', 'User'),
            'token': token,
            'skip_otp': True  # Frontend flag to skip OTP screen
        })
        
    except Exception as e:
        return jsonify({'msg': 'Login error', 'error': str(e)}), 500

# OTP verification endpoint for login
@app.route('/verify-login-otp', methods=['POST'])
def verify_login_otp():
    """Verify OTP and complete login"""
    try:
        data = request.get_json()
        email = data.get('email')
        otp = data.get('otp')
        
        if not email or not otp:
            return jsonify({'msg': 'Email and OTP are required'}), 400
        
        # Find stored OTP
        stored_otp = mongo.db.otps.find_one({'email': email})
        if not stored_otp:
            return jsonify({'msg': 'OTP not found or expired'}), 400
        
        # Check if OTP is expired
        if datetime.datetime.now() > stored_otp['expiry']:
            mongo.db.otps.delete_one({'email': email})
            return jsonify({'msg': 'OTP expired'}), 400
        
        # Verify OTP
        if stored_otp['otp'] != otp:
            return jsonify({'msg': 'Invalid OTP'}), 400
        
        # Find user
        user = mongo.db.users.find_one({'email': email})
        if not user:
            return jsonify({'msg': 'User not found'}), 404
        
        # Generate JWT token
        token = create_access_token(
            identity=str(user['_id']),
            additional_claims={
                'role': user['role'],
                'email': user['email'],
                'fullName': user.get('fullName', 'User')
            }
        )
        
        # Store the token in user_tokens collection (allows multiple sessions)
        store_user_token(str(user['_id']), token, 'Mobile App')
        
        # Clean up OTP
        mongo.db.otps.delete_one({'email': email})
        
        return jsonify({
            'msg': 'Login successful',
            'access_token': token,
            'role': user['role'],
            'fullName': user.get('fullName', 'User'),
            'email': user['email']
        })
        
    except Exception as e:
        return jsonify({'msg': 'OTP verification error', 'error': str(e)}), 500

# Logout endpoint
@app.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user by deactivating their tokens"""
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        # Deactivate all tokens for this user
        deactivate_user_tokens(user_id)
        
        return jsonify({'msg': 'Logout successful'})
        
    except Exception as e:
        return jsonify({'msg': 'Logout error', 'error': str(e)}), 500

# Admin endpoints for user management
@app.route('/admin/pending-users', methods=['GET'])
@jwt_required()
def get_pending_users():
    """Get all pending user registrations for admin approval"""
    try:
        # Get current user from JWT
        current_user_id = get_jwt_identity()
        current_user = mongo.db.users.find_one({'_id': ObjectId(current_user_id)})
        
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'msg': 'Admin access required'}), 403
        
        # Get all pending registrations
        pending_users = list(mongo.db.pending_registrations.find({
            'otp_verified': True,
            'status': 'pending_approval'
        }).sort('created_at', -1))
        
        # Convert ObjectId to string for JSON serialization
        for user in pending_users:
            user['_id'] = str(user['_id'])
            user['created_at'] = user['created_at'].isoformat()
            if 'otp_verified_at' in user:
                user['otp_verified_at'] = user['otp_verified_at'].isoformat()
        
        return jsonify({
            'pending_users': pending_users,
            'count': len(pending_users)
        })
        
    except Exception as e:
        return jsonify({'msg': 'Error fetching pending users', 'error': str(e)}), 500

@app.route('/admin/approve-user', methods=['POST'])
@jwt_required()
def approve_user():
    """Approve a pending user registration"""
    try:
        # Get current user from JWT
        current_user_id = get_jwt_identity()
        current_user = mongo.db.users.find_one({'_id': ObjectId(current_user_id)})
        
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'msg': 'Admin access required'}), 403
        
        data = request.get_json()
        email = data.get('email')
        action = data.get('action')  # 'approve' or 'reject'
        
        if not email or action not in ['approve', 'reject']:
            return jsonify({'msg': 'Email and action are required'}), 400
        
        # Find pending registration
        pending_user = mongo.db.pending_registrations.find_one({'email': email})
        if not pending_user:
            return jsonify({'msg': 'Pending user not found'}), 404
        
        if action == 'approve':
            # Create approved user account
            user_data = {
                'email': pending_user['email'],
                'password': pending_user['password'],
                'fullName': pending_user['fullName'],
                'role': pending_user['role'],
                'created_at': pending_user['created_at'],
                'approved_at': datetime.datetime.now(),
                'approved_by': str(current_user['_id']),
                'is_approved': True
            }
            
            # Insert approved user
            result = mongo.db.users.insert_one(user_data)
            user_id = str(result.inserted_id)
            
            # Remove from pending registrations
            mongo.db.pending_registrations.delete_one({'email': email})
            
            # Send approval notification email
            try:
                send_otp_email(email, "APPROVED", "account_approval")
            except:
                pass  # Don't fail if email fails
            
            return jsonify({
                'msg': f'User {pending_user["fullName"]} approved successfully',
                'user_id': user_id,
                'email': email
            })
            
        else:  # reject
            # Remove from pending registrations
            mongo.db.pending_registrations.delete_one({'email': email})
            
            # Send rejection notification email
            try:
                send_otp_email(email, "REJECTED", "account_rejection")
            except:
                pass  # Don't fail if email fails
            
            return jsonify({
                'msg': f'User {pending_user["fullName"]} rejected',
                'email': email
            })
        
    except Exception as e:
        return jsonify({'msg': 'Error processing user approval', 'error': str(e)}), 500


@app.route('/forgot-password', methods=['GET'])
@jwt_required()
def forgot_password():
    """
    Get masked email for password reset
    ---
    responses:
      200:
        description: Masked email returned
      401:
        description: Unauthorized
      404:
        description: User not found
    """
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        return jsonify({'msg': 'User not found.'}), 404
    
    email = user.get('email', '')
    if not email:
        return jsonify({'msg': 'Email not found for user.'}), 404
    
    # Mask the email: first 3 letters + @gmail.com
    masked_email = email[:3] + '@gmail.com'
    
    return jsonify({
        'masked_email': masked_email,
        'full_email': email  # For internal use
    })


@app.route('/reset-password-request', methods=['POST'])
@jwt_required()
def reset_password_request():
    """
    Request OTP for password reset
    ---
    responses:
      200:
        description: OTP sent to email
      401:
        description: Unauthorized
      500:
        description: Failed to send OTP
    """
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        return jsonify({'msg': 'User not found.'}), 404
    
    email = user.get('email', '')
    if not email:
        return jsonify({'msg': 'Email not found for user.'}), 404

    otp = str(random.randint(100000, 999999))
    
    # Store OTP with expiration (5 minutes)
    mongo.db.password_resets.update_one(
        {'email': email},
        {'$set': {
            'otp': otp, 
            'created_at': datetime.datetime.now(),
            'expires_at': datetime.datetime.now() + datetime.timedelta(minutes=5)
        }},
        upsert=True
    )

    success, error = send_otp_email(email, otp, "password reset")
    if success:
        return jsonify({'msg': 'OTP sent to your registered email.'})
    else:
        return jsonify({'msg': 'Failed to send OTP.', 'error': error}), 500


@app.route('/reset-password', methods=['POST'])
@jwt_required()
def reset_password():
    """
    Reset password using OTP
    ---
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - otp
            - new_password
          properties:
            otp:
              type: string
            new_password:
              type: string
    responses:
      200:
        description: Password reset successful
      400:
        description: Invalid OTP or expired OTP
      401:
        description: Unauthorized
    """
    user_id = get_jwt_identity()
    user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        return jsonify({'msg': 'User not found.'}), 404
    
    email = user.get('email', '')
    if not email:
        return jsonify({'msg': 'Email not found for user.'}), 404

    data = request.get_json()
    otp = data.get('otp')
    new_password = data.get('new_password')

    if not otp or not new_password:
        return jsonify({'msg': 'OTP and new password are required.'}), 400

    # Check if OTP exists and is not expired
    record = mongo.db.password_resets.find_one({'email': email})
    if not record:
        return jsonify({'msg': 'No password reset request found. Please request OTP first.'}), 400
    
    if record.get('otp') != otp:
        return jsonify({'msg': 'Invalid OTP.'}), 400
    
    # Check if OTP is expired
    if 'expires_at' in record and datetime.datetime.now() > record['expires_at']:
        # Clean up expired OTP
        mongo.db.password_resets.delete_one({'email': email})
        return jsonify({'msg': 'OTP has expired. Please request a new one.'}), 400

    # Hash the new password and update user
    hashed_password = bcrypt.hash(new_password)
    mongo.db.users.update_one(
        {'email': email},
        {'$set': {'password': hashed_password}}
    )
    
    # Clean up the used OTP
    mongo.db.password_resets.delete_one({'email': email})
    
    return jsonify({'msg': 'Password reset successful.'})

# User profile endpoint
@app.route('/user/profile', methods=['GET'])
@jwt_required()
def get_user_profile():
    """Get current user's profile information"""
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        # Find user in database
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'msg': 'User not found'}), 404
        
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'fullName': user.get('fullName', 'User'),
                'role': user['role'],
                'created_at': user.get('created_at', ''),
                'is_approved': user.get('is_approved', False),
                'approved_at': user.get('approved_at', ''),
                'approved_by': user.get('approved_by', '')
            }
        })
        
    except Exception as e:
        return jsonify({'msg': 'Error fetching profile', 'error': str(e)}), 500


# Advance request endpoint
@app.route('/advance-request', methods=['POST'])
def submit_advance_request():
    """Submit a new advance request"""
    try:
        data = request.get_json()
        
        # Extract request data
        employee_name = data.get('employeeName')
        site_city = data.get('siteCity')
        project = data.get('project')
        reason = data.get('reason')
        duration = data.get('duration')
        advance = data.get('advance')
        date_of_journey = data.get('dateOfJourney')
        
        # Validate required fields
        if not all([employee_name, site_city, project, reason, duration, advance, date_of_journey]):
            return jsonify({'msg': 'All fields are required'}), 400
        
        # Create request document
        request_data = {
            'employeeName': employee_name,
            'siteCity': site_city,
            'project': project,
            'reason': reason,
            'duration': int(duration),
            'advance': float(advance),
            'dateOfJourney': date_of_journey,
            'status': 'pending',  # Manager approval status
            'admin_status': 'pending',  # Admin approval status
            'submittedAt': datetime.datetime.now(),
            'approved_by': None,
            'approved_by_admin': None
        }
        
        # Insert into database
        result = mongo.db.advance_requests.insert_one(request_data)
        request_id = str(result.inserted_id)
        
        # Create notifications for submission
        create_employee_submission_notifications(request_id, employee_name, site_city, project)
        
        return jsonify({
            'msg': 'Request submitted successfully',
            'request_id': request_id
        })
        
    except Exception as e:
        return jsonify({'msg': 'Error submitting request', 'error': str(e)}), 500



# Get user's advance requests history
@app.route('/user/requests', methods=['GET'])
@jwt_required()
def get_user_requests():
    """Get current user's advance requests history"""
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        # Find user in database
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'msg': 'User not found'}), 404
        
        # Get user's requests
        requests = list(mongo.db.advance_requests.find({
            'employeeName': user.get('fullName', 'User')
        }).sort('submittedAt', -1))
        
        # Convert ObjectId to string for JSON serialization
        for req in requests:
            req['_id'] = str(req['_id'])
            if req.get('submittedAt'):
                req['submittedAt'] = req['submittedAt'].isoformat()
            if req.get('updatedAt'):
                req['updatedAt'] = req['updatedAt'].isoformat()
        
        return jsonify(requests)
        
    except Exception as e:
        return jsonify({'msg': 'Error fetching requests', 'error': str(e)}), 500


@app.route('/advance-request/<request_id>', methods=['DELETE'])
@jwt_required()
def delete_advance_request(request_id):
    """Delete an advance request (only if status is pending)"""
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        # Find user in database
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'msg': 'User not found'}), 404
        
        # Find the request
        request_obj = mongo.db.advance_requests.find_one({'_id': ObjectId(request_id)})
        if not request_obj:
            return jsonify({'msg': 'Request not found'}), 404
        
        # Check if user owns this request
        if request_obj.get('employeeName') != user.get('fullName'):
            return jsonify({'msg': 'Unauthorized to delete this request'}), 403
        
        # Check if request can be deleted (only admin actions prevent deletion)
        if request_obj.get('admin_status') and request_obj.get('admin_status') != 'pending':
            return jsonify({'msg': 'Cannot delete request that has been processed by admin'}), 400
        
        # Delete the request
        result = mongo.db.advance_requests.delete_one({'_id': ObjectId(request_id)})
        
        if result.deleted_count == 1:
            return jsonify({'msg': 'Request deleted successfully'})
        else:
            return jsonify({'msg': 'Failed to delete request'}), 500
            
    except Exception as e:
        return jsonify({'msg': 'Error deleting request', 'error': str(e)}), 500


# Update user profile endpoint
@app.route('/user/profile', methods=['PUT'])
def update_user_profile():
    """
    Update user profile
    ---
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            fullName:
              type: string
            department:
              type: string
    responses:
      200:
        description: Profile updated successfully
      400:
        description: Invalid data
    """
    data = request.get_json()
    # TODO: Extract user ID from JWT token and update profile
    return jsonify({'msg': 'Profile updated successfully'})


@app.route('/test-email', methods=['POST'])
def test_email():
    """
    Test email functionality
    ---
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
          properties:
            email:
              type: string
    responses:
      200:
        description: Test email sent
      500:
        description: Failed to send test email
    """
    data = request.get_json()
    test_email = data.get('email')
    
    if not test_email:
        return jsonify({'msg': 'Email is required'}), 400
    
    test_otp = '123456'
    success, error = send_otp_email(test_email, test_otp)
    
    if success:
        return jsonify({'msg': 'Test email sent successfully', 'otp': test_otp})
    else:
        return jsonify({'msg': 'Failed to send test email', 'error': error}), 500

# Secure registration for Manager/Admin
@app.route('/admin/check-exists', methods=['GET'])
def check_admin_exists():
    """
    Check if an admin already exists in the system
    ---
    responses:
      200:
        description: Admin existence check result
        schema:
          type: object
          properties:
            exists:
              type: boolean
              description: Whether an admin exists
    """
    admin_exists = mongo.db.users.find_one({'role': 'admin'}) is not None
    return jsonify({'exists': admin_exists})

# Get all visit requests
@app.route('/visit-requests', methods=['GET'])
def get_visit_requests():
    """Get all visit requests"""
    try:
        requests = list(mongo.db.advance_requests.find().sort('submittedAt', -1))
        
        # Convert ObjectId to string for JSON serialization
        for req in requests:
            req['_id'] = str(req['_id'])
            if req.get('submittedAt'):
                req['submittedAt'] = req['submittedAt'].isoformat()
            if req.get('updatedAt'):
                req['updatedAt'] = req['updatedAt'].isoformat()
            
            # Determine the display status for categorization
            if req.get('admin_status') == 'rejected':
                req['display_status'] = 'rejected'
            elif req.get('admin_status') == 'on_hold':
                req['display_status'] = 'on_hold'
            elif req.get('admin_status') == 'approved':
                req['display_status'] = 'approved'
            elif req.get('status') == 'rejected':
                req['display_status'] = 'rejected'
            elif req.get('status') == 'on_hold':
                req['display_status'] = 'on_hold'
            elif req.get('status') == 'approved':
                req['display_status'] = 'approved'
            else:
                req['display_status'] = 'pending'
        
        return jsonify(requests)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Update visit request
@app.route('/visit-request/<request_id>', methods=['PATCH', 'PUT'])
def update_visit_request(request_id):
    """Update a visit request (for manager/admin actions)"""
    try:
        data = request.get_json()
        
        # Find existing request
        existing_request = mongo.db.advance_requests.find_one({'_id': ObjectId(request_id)})
        if not existing_request:
            return jsonify({'error': 'Request not found'}), 404
        
        # Prepare update data
        update_data = {}
        
        # Handle manager actions
        if 'status' in data:
            update_data['status'] = data['status']
            if data['status'] in ['approved', 'rejected', 'on_hold']:
                update_data['approved_by'] = data.get('approved_by', 'Manager')
                update_data['updatedAt'] = datetime.datetime.now()
                
                # Create notifications for manager action
                create_manager_action_notifications(
                    request_id, 
                    data['status'], 
                    existing_request.get('employeeName'), 
                    existing_request.get('project'), 
                    existing_request.get('siteCity'), 
                    data.get('approved_by', 'Manager')
                )
        
        # Handle admin actions
        if 'admin_status' in data:
            update_data['admin_status'] = data['admin_status']
            if data['admin_status'] in ['approved', 'rejected', 'on_hold']:
                update_data['approved_by_admin'] = data.get('approved_by_admin', 'Admin')
                update_data['updatedAt'] = datetime.datetime.now()
                
                # Create notifications for admin action
                create_admin_action_notifications(
                    request_id, 
                    data['admin_status'], 
                    existing_request.get('employeeName'), 
                    existing_request.get('project'), 
                    existing_request.get('siteCity'), 
                    data.get('approved_by_admin', 'Admin')
                )
        
        # Handle manager edits (advance, duration, managerComment)
        if any(field in data for field in ['advance', 'duration', 'managerComment']):
            # Track that manager has edited the request
            update_data['edited_by_manager'] = True
            update_data['manager_edit_timestamp'] = datetime.datetime.now()
            update_data['manager_edit_by'] = data.get('approved_by', 'Manager')
            
            # Track what changed for detailed comparison
            changes = {}
            if 'advance' in data and existing_request.get('advance') != data['advance']:
                changes['advance'] = {
                    'from': existing_request.get('advance', 0),
                    'to': data['advance']
                }
            if 'duration' in data and existing_request.get('duration') != data['duration']:
                changes['duration'] = {
                    'from': existing_request.get('duration', 0),
                    'to': data['duration']
                }
            
            if changes:
                update_data['manager_edit_changes'] = changes
            
            # Create notification for admin about manager edit
            create_notification(
                recipient_role='admin',
                message=f'Request edited by Manager {data.get("approved_by", "Manager")}',
                notification_type='manager_edit',
                request_id=request_id,
                request_data={
                    'employeeName': existing_request.get('employeeName'),
                    'siteCity': existing_request.get('siteCity'),
                    'project': existing_request.get('project')
                },
                from_role='manager',
                from_user=data.get('approved_by', 'Manager'),
                action='edited'
            )
        
        # Handle other fields
        for field in ['advance', 'duration', 'managerComment', 'adminComment']:
            if field in data:
                update_data[field] = data[field]
        
        # Update the request
        if update_data:
            mongo.db.advance_requests.update_one(
                {'_id': ObjectId(request_id)},
                {'$set': update_data}
            )
        
        return jsonify({'message': 'Request updated successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Admin action endpoint with confirmation requirements
@app.route('/admin-action/<request_id>', methods=['POST'])
def admin_action_with_confirmation(request_id):
    """Admin action endpoint that requires confirmation and handles rejection reasons"""
    try:
        data = request.get_json()
        action = data.get('action')
        confirmation = data.get('confirmation')
        rejection_reason = data.get('rejection_reason')
        
        # Find existing request
        existing_request = mongo.db.advance_requests.find_one({'_id': ObjectId(request_id)})
        if not existing_request:
            return jsonify({'error': 'Request not found'}), 404
        
        # Validate confirmation
        if not confirmation:
            return jsonify({'error': 'Confirmation required for all actions'}), 400
        
        # Prepare update data
        update_data = {
            'admin_status': action,
            'approved_by_admin': data.get('admin_name', 'Admin'),
            'updatedAt': datetime.datetime.now()
        }
        
        # Add rejection reason if rejecting
        if action == 'reject':
            update_data['admin_rejection_reason'] = rejection_reason
        
        # Update the request
        mongo.db.advance_requests.update_one(
            {'_id': ObjectId(request_id)},
            {'$set': update_data}
        )
        
        # Create notifications for admin action
        create_admin_action_notifications(
            request_id, 
            action, 
            existing_request.get('employeeName'), 
            existing_request.get('project'), 
            existing_request.get('siteCity'), 
            data.get('admin_name', 'Admin')
        )
        
        return jsonify({'message': f'Request {action} successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Mark visit request as paid
@app.route('/visit-request/<request_id>/mark-paid', methods=['PATCH'])
def mark_visit_request_as_paid(request_id):
    """Mark a visit request as paid by accounts team. Only requires admin approval."""
    try:
        data = request.get_json()
        
        # Find existing request
        existing_request = mongo.db.advance_requests.find_one({'_id': ObjectId(request_id)})
        if not existing_request:
            return jsonify({'error': 'Request not found'}), 404
        
        # Check if request is approved by admin (admin approval is the main decision)
        if existing_request.get('admin_status') != 'approved':
            return jsonify({'error': 'Request must be approved by admin before marking as paid'}), 400
        
        # Check if already marked as paid
        if existing_request.get('payment_status') == 'paid':
            return jsonify({'error': 'Request is already marked as paid'}), 400
        
        # Prepare update data
        update_data = {
            'payment_status': data.get('payment_status', 'paid'),
            'paid_at': datetime.datetime.now(),
            'paid_by': data.get('paid_by', 'Accounts Team'),
            'updatedAt': datetime.datetime.now()
        }
        
        # Update the request
        mongo.db.advance_requests.update_one(
            {'_id': ObjectId(request_id)},
            {'$set': update_data}
        )
        
        # Create notification for payment completion
        create_notification(
            recipient_role='employee',
            message=f'Your request for {existing_request.get("project")} has been marked as paid',
            notification_type='payment_completed',
            request_id=request_id,
            request_data={
                'employeeName': existing_request.get('employeeName'),
                'siteCity': existing_request.get('siteCity'),
                'project': existing_request.get('project'),
                'advance': existing_request.get('advance')
            },
            from_role='accounts',
            from_user=data.get('paid_by', 'Accounts Team'),
            action='paid'
        )
        
        # Also notify manager and admin
        create_notification(
            recipient_role='manager',
            message=f'Request for {existing_request.get("project")} by {existing_request.get("employeeName")} has been marked as paid',
            notification_type='payment_completed',
            request_id=request_id,
            request_data={
                'employeeName': existing_request.get('employeeName'),
                'siteCity': existing_request.get('siteCity'),
                'project': existing_request.get('project'),
                'advance': existing_request.get('advance')
            },
            from_role='accounts',
            from_user=data.get('paid_by', 'Accounts Team'),
            action='paid'
        )
        
        create_notification(
            recipient_role='admin',
            message=f'Request for {existing_request.get("project")} by {existing_request.get("employeeName")} has been marked as paid',
            notification_type='payment_completed',
            request_id=request_id,
            request_data={
                'employeeName': existing_request.get('employeeName'),
                'siteCity': existing_request.get('siteCity'),
                'project': existing_request.get('project'),
                'advance': existing_request.get('advance')
            },
            from_role='accounts',
            from_user=data.get('paid_by', 'Accounts Team'),
            action='paid'
        )
        
        return jsonify({
            'message': 'Request marked as paid successfully', 
            'request_id': request_id,
            'payment_status': 'paid',
            'paid_at': update_data['paid_at'].isoformat(),
            'paid_by': update_data['paid_by']
        }), 200
        
    except Exception as e:
        print(f"Error marking request as paid: {e}")
        return jsonify({'error': 'Failed to mark request as paid'}), 500

# Notification endpoints
@app.route('/notifications/<role>', methods=['GET'])
def get_notifications(role):
    """Get all notifications for a specific role"""
    try:
        # Clean up expired notifications first
        cleanup_expired_notifications()
        
        # Get user info from query parameters for filtering
        user_name = request.args.get('user_name')
        user_id = request.args.get('user_id')
        
        # Build query based on role and user
        query = {'recipient_role': role}
        
        # For employees, filter by their name or user ID
        if role == 'employee' and user_name:
            query['$or'] = [
                {'request_data.employeeName': user_name},
                {'from_user': user_name},
                {'message': {'$regex': user_name, '$options': 'i'}}
            ]
        
        # For managers, filter by their team or actions they took
        elif role == 'manager' and user_name:
            query['$or'] = [
                {'from_user': user_name},
                {'message': {'$regex': user_name, '$options': 'i'}},
                {'request_data.employeeName': {'$exists': True}}  # Show all team requests
            ]
        
        # For admins, show all notifications (they need to see everything)
        elif role == 'admin':
            pass  # No additional filtering needed
        
        # For accounts, show only approved/rejected requests
        elif role == 'accounts':
            query['$or'] = [
                {'action': 'approved'},
                {'action': 'rejected'},
                {'notification_type': {'$in': ['manager_action', 'admin_action']}}
            ]
        
        # Get notifications for the role, sorted by creation time (newest first)
        notifications = list(mongo.db.notifications.find(query).sort('created_at', -1))
        
        # Convert ObjectId to string for JSON serialization
        for notification in notifications:
            notification['_id'] = str(notification['_id'])
            notification['created_at'] = notification['created_at'].isoformat()
            if notification['viewed_at']:
                notification['viewed_at'] = notification['viewed_at'].isoformat()
            if notification['expires_at']:
                notification['expires_at'] = notification['expires_at'].isoformat()
        
        return jsonify(notifications)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notifications/<notification_id>/read', methods=['PATCH'])
def mark_notification_read(notification_id):
    """Mark a notification as read and set expiry timer"""
    try:
        # Find the notification
        notification = mongo.db.notifications.find_one({'_id': ObjectId(notification_id)})
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404
        
        # Update the notification - expires after 12 hours
        current_time = datetime.datetime.now()
        expiry_time = current_time + datetime.timedelta(hours=12)
        
        mongo.db.notifications.update_one(
            {'_id': ObjectId(notification_id)},
            {
                '$set': {
                    'status': 'read',
                    'viewed_at': current_time,
                    'expires_at': expiry_time
                }
            }
        )
        
        return jsonify({'message': 'Notification marked as read'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notifications/<role>/unread-count', methods=['GET'])
def get_unread_count(role):
    """Get unread notification count for a specific role"""
    try:
        # Clean up expired notifications first
        cleanup_expired_notifications()
        
        # Get user info from query parameters for filtering
        user_name = request.args.get('user_name')
        
        # Build query based on role and user
        query = {
            'recipient_role': role,
            'status': 'unread'
        }
        
        # For employees, filter by their name
        if role == 'employee' and user_name:
            query['$or'] = [
                {'request_data.employeeName': user_name},
                {'from_user': user_name},
                {'message': {'$regex': user_name, '$options': 'i'}}
            ]
        
        # For managers, filter by their team or actions they took
        elif role == 'manager' and user_name:
            query['$or'] = [
                {'from_user': user_name},
                {'message': {'$regex': user_name, '$options': 'i'}},
                {'request_data.employeeName': {'$exists': True}}  # Show all team requests
            ]
        
        # For admins, show all notifications (they need to see everything)
        elif role == 'admin':
            pass  # No additional filtering needed
        
        # For accounts, show only approved/rejected requests
        elif role == 'accounts':
            query['$or'] = [
                {'action': 'approved'},
                {'action': 'rejected'},
                {'notification_type': {'$in': ['manager_action', 'admin_action']}}
            ]
        
        count = mongo.db.notifications.count_documents(query)
        
        return jsonify({'unread_count': count})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notifications/<role>/mark-all-read', methods=['PATCH'])
def mark_all_notifications_read(role):
    """Mark all notifications as read for a specific role"""
    try:
        # Mark all notifications as read - expires after 12 hours
        current_time = datetime.datetime.now()
        expiry_time = current_time + datetime.timedelta(hours=12)
        
        result = mongo.db.notifications.update_many(
            {
                'recipient_role': role,
                'status': 'unread'
            },
            {
                '$set': {
                    'status': 'read',
                    'viewed_at': current_time,
                    'expires_at': expiry_time
                }
            }
        )
        
        return jsonify({
            'message': f'Marked {result.modified_count} notifications as read'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notifications/<notification_id>', methods=['DELETE'])
def delete_notification(notification_id):
    """Delete a specific notification"""
    try:
        result = mongo.db.notifications.delete_one({'_id': ObjectId(notification_id)})
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Notification not found'}), 404
        
        return jsonify({'message': 'Notification deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notifications/cleanup', methods=['POST'])
def manual_cleanup():
    """Manually trigger cleanup of expired notifications"""
    try:
        expired_count = cleanup_expired_notifications()
        return jsonify({
            'message': f'Cleanup completed. Removed {expired_count} expired notifications.'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Test notification endpoint
@app.route('/test-notifications', methods=['POST'])
def test_notifications():
    """Create test notifications for all roles and actions"""
    try:
        # Test data
        test_request_id = 'test-123'
        test_employee_name = 'Test Employee'
        test_manager_name = 'Test Manager'
        test_admin_name = 'Test Admin'
        
        # Test employee submission notifications
        create_employee_submission_notifications(
            test_request_id, 
            test_employee_name,
            'Test City',
            'Test Project'
        )
        
        # Test manager action notifications
        create_manager_action_notifications(
            test_request_id,
            'approved',
            test_employee_name,
            'Test Project',
            'Test City',
            test_manager_name
        )
        
        # Test admin action notifications
        create_admin_action_notifications(
            test_request_id,
            'approved',
            test_employee_name,
            'Test Project',
            'Test City',
            test_admin_name
        )
        
        return jsonify({
            'msg': 'Test notifications created successfully',
            'details': 'Created notifications for Employee → Manager/Admin/Accounts, Manager → Employee/Admin, Admin → Employee/Manager/Accounts'
        })
        
    except Exception as e:
        return jsonify({'msg': 'Error creating test notifications', 'error': str(e)}), 500

# Delete visit request
@app.route('/visit-request/<request_id>', methods=['DELETE'])
def delete_visit_request(request_id):
    """
    Delete a visit request
    ---
    parameters:
      - in: path
        name: request_id
        required: true
        schema:
          type: string
    responses:
      200:
        description: Request deleted successfully
      404:
        description: Request not found
    """
    try:
        # Try to find by _id first (convert string to ObjectId), then by employeeId if not found
        try:
            # Convert string ID to ObjectId if it looks like a valid ObjectId
            if len(request_id) == 24:  # MongoDB ObjectId is 24 characters
                object_id = ObjectId(request_id)
                result = mongo.db.advance_requests.delete_one({'_id': object_id})
            else:
                result = mongo.db.advance_requests.delete_one({'_id': request_id})
        except:
            # If ObjectId conversion fails, try as string
            result = mongo.db.advance_requests.delete_one({'_id': request_id})
        
        # If not found by _id, try by employeeId
        if result.deleted_count == 0:
            result = mongo.db.advance_requests.delete_one({'employeeId': request_id})
        
        if result.deleted_count == 0:
            return jsonify({'msg': 'Request not found'}), 404
        
        return jsonify({'msg': 'Request deleted successfully'})
    except Exception as e:
        return jsonify({'msg': 'Error deleting request', 'error': str(e)}), 500

# Get approved requests for Accounts
@app.route('/accounts/approved-requests', methods=['GET'])
def get_approved_requests():
    """
    Get only approved requests for Accounts role
    ---
    responses:
      200:
        description: List of approved requests
    """
    try:
        # Only return requests approved by both Manager and Admin
        approved_requests = list(mongo.db.advance_requests.find(
            {'status': 'approved', 'admin_status': 'approved'}
        ))
        # Convert ObjectId to string for JSON serialization
        for req in approved_requests:
            if '_id' in req:
                req['_id'] = str(req['_id'])
        return jsonify(approved_requests)
    except Exception as e:
        return jsonify({'msg': 'Error fetching approved requests', 'error': str(e)}), 500

# Products API for Admin
@app.route('/products', methods=['GET', 'POST'])
def products():
    """
    GET: Get all products
    POST: Add new product (Admin only)
    ---
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required:
            - name
            - price
          properties:
            name:
              type: string
            price:
              type: number
            discount:
              type: number
            description:
              type: string
            category:
              type: string
    responses:
      200:
        description: List of products or product added successfully
    """
    if request.method == 'GET':
        try:
            products = list(mongo.db.products.find({}, {'_id': 0}))
            return jsonify(products)
        except Exception as e:
            return jsonify({'msg': 'Error fetching products', 'error': str(e)}), 500
    
    elif request.method == 'POST':
        data = request.get_json()
        name = data.get('name')
        price = data.get('price')
        discount = data.get('discount', 0)
        description = data.get('description', '')
        category = data.get('category', 'General')
        
        if not name or not price:
            return jsonify({'msg': 'Product name and price are required'}), 400
        
        try:
            product_id = mongo.db.products.insert_one({
                'name': name,
                'price': price,
                'discount': discount,
                'description': description,
                'category': category,
                'createdAt': datetime.datetime.now()
            }).inserted_id
            
            return jsonify({'msg': 'Product added successfully', 'productId': str(product_id)})
        except Exception as e:
            return jsonify({'msg': 'Error adding product', 'error': str(e)}), 500


# Public Forgot Password Endpoints (No Authentication Required)
@app.route('/public/forgot-password', methods=['POST'])
def public_forgot_password():
    """
    Public endpoint to check if email exists and send OTP for password reset
    ---
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - action
          properties:
            email:
              type: string
            action:
              type: string
              enum: [check_email, send_otp]
    responses:
      200:
        description: Email exists and OTP sent
      400:
        description: Invalid request
      404:
        description: Email not found
      500:
        description: Server error
    """
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        action = data.get('action')
        
        if not email or not action:
            return jsonify({'msg': 'Email and action are required'}), 400
        
        if action not in ['check_email', 'send_otp']:
            return jsonify({'msg': 'Invalid action. Use check_email or send_otp'}), 400
        
        # Check if email exists in database
        user = mongo.db.users.find_one({'email': email})
        if not user:
            return jsonify({'msg': 'Email not found', 'email_exists': False}), 404
        
        if action == 'check_email':
            return jsonify({
                'msg': 'Email found',
                'email_exists': True,
                'email': email
            })
        
        elif action == 'send_otp':
            # Generate OTP
            otp = str(random.randint(100000, 999999))
            
            # Store OTP with expiration (5 minutes)
            mongo.db.password_resets.update_one(
                {'email': email},
                {'$set': {
                    'otp': otp, 
                    'created_at': datetime.datetime.now(),
                    'expires_at': datetime.datetime.now() + datetime.timedelta(minutes=5)
                }},
                upsert=True
            )
            
            # Send OTP email
            success, error = send_otp_email(email, otp, "password reset")
            if success:
                return jsonify({
                    'msg': 'OTP sent to your registered email.',
                    'email_exists': True
                })
            else:
                return jsonify({'msg': 'Failed to send OTP.', 'error': error}), 500
                
    except Exception as e:
        return jsonify({'msg': 'Server error', 'error': str(e)}), 500


@app.route('/public/verify-otp', methods=['POST'])
def public_verify_otp():
    """
    Public endpoint to verify OTP for password reset
    ---
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - otp
          properties:
            email:
              type: string
            otp:
              type: string
    responses:
      200:
        description: OTP verified successfully
      400:
        description: Invalid OTP or expired OTP
      404:
        description: Email not found
      500:
        description: Server error
    """
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        otp = data.get('otp')
        
        if not email or not otp:
            return jsonify({'msg': 'Email and OTP are required'}), 400
        
        # Check if email exists
        user = mongo.db.users.find_one({'email': email})
        if not user:
            return jsonify({'msg': 'Email not found'}), 404
        
        # Check if OTP exists and is not expired
        record = mongo.db.password_resets.find_one({'email': email})
        if not record:
            return jsonify({'msg': 'No password reset request found. Please request OTP first.'}), 400
        
        if record.get('otp') != otp:
            return jsonify({'msg': 'Invalid OTP.'}), 400
        
        # Check if OTP is expired
        if 'expires_at' in record and datetime.datetime.now() > record['expires_at']:
            # Clean up expired OTP
            mongo.db.password_resets.delete_one({'email': email})
            return jsonify({'msg': 'OTP has expired. Please request a new one.'}), 400
        
        return jsonify({
            'msg': 'OTP verified successfully',
            'otp_valid': True,
            'email': email
        })
        
    except Exception as e:
        return jsonify({'msg': 'Server error', 'error': str(e)}), 500


@app.route('/public/reset-password', methods=['POST'])
def public_reset_password():
    """
    Public endpoint to reset password using verified OTP
    ---
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - otp
            - new_password
          properties:
            email:
              type: string
            otp:
              type: string
            new_password:
              type: string
    responses:
      200:
        description: Password reset successful
      400:
        description: Invalid OTP or expired OTP
      404:
        description: Email not found
      500:
        description: Server error
    """
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        otp = data.get('otp')
        new_password = data.get('new_password')
        
        if not email or not otp or not new_password:
            return jsonify({'msg': 'Email, OTP, and new password are required'}), 400
        
        if len(new_password) < 6:
            return jsonify({'msg': 'Password must be at least 6 characters long'}), 400
        
        # Check if email exists
        user = mongo.db.users.find_one({'email': email})
        if not user:
            return jsonify({'msg': 'Email not found'}), 404
        
        # Check if OTP exists and is not expired
        record = mongo.db.password_resets.find_one({'email': email})
        if not record:
            return jsonify({'msg': 'No password reset request found. Please request OTP first.'}), 400
        
        if record.get('otp') != otp:
            return jsonify({'msg': 'Invalid OTP.'}), 400
        
        # Check if OTP is expired
        if 'expires_at' in record and datetime.datetime.now() > record['expires_at']:
            # Clean up expired OTP
            mongo.db.password_resets.delete_one({'email': email})
            return jsonify({'msg': 'OTP has expired. Please request a new one.'}), 400
        
        # Hash the new password and update user
        hashed_password = bcrypt.hash(new_password)
        mongo.db.users.update_one(
            {'email': email},
            {'$set': {'password': hashed_password}}
        )
        
        # Clean up the used OTP
        mongo.db.password_resets.delete_one({'email': email})
        
        return jsonify({'msg': 'Password reset successful. You can now log in with your new password.'})
        
    except Exception as e:
        return jsonify({'msg': 'Server error', 'error': str(e)}), 500


# Create sample data for testing
def create_sample_data():
    """Create sample advance requests for testing"""
    if mongo.db.advance_requests.count_documents({}) == 0:
        sample_requests = [
            {
                'employeeName': 'John Doe',
                'siteCity': 'New York',
                'project': 'Client Meeting',
                'reason': 'Annual client review and contract renewal',
                'duration': 3,
                'advance': 1500,
                'status': 'pending',
                'admin_status': 'pending',
                'submittedAt': datetime.datetime.now(),
                'employeeId': 'EMP001'
            },
            {
                'employeeName': 'Jane Smith',
                'siteCity': 'Los Angeles',
                'project': 'Site Inspection',
                'reason': 'Construction site safety audit',
                'duration': 2,
                'advance': 800,
                'status': 'pending',
                'admin_status': 'pending',
                'submittedAt': datetime.datetime.now(),
                'employeeId': 'EMP002'
            },
            {
                'employeeName': 'Mike Johnson',
                'siteCity': 'Chicago',
                'project': 'Training Workshop',
                'reason': 'Employee skill development program',
                'duration': 4,
                'advance': 2000,
                'status': 'pending',
                'admin_status': 'pending',
                'submittedAt': datetime.datetime.now(),
                'employeeId': 'EMP003'
            }
        ]
        mongo.db.advance_requests.insert_many(sample_requests)
        print("Sample data created successfully!")

def migrate_user_data():
    """Migrate existing users to use fullName field"""
    try:
        # Find users with old full_name field and update them
        users_to_update = mongo.db.users.find({'full_name': {'$exists': True}})
        for user in users_to_update:
            mongo.db.users.update_one(
                {'_id': user['_id']},
                {'$set': {'fullName': user['full_name']}, '$unset': {'full_name': ''}}
            )
        print(f"Migrated {len(list(users_to_update))} users to use fullName field")
    except Exception as e:
        print(f"Error during migration: {e}")



# ------------------- Run -------------------
if __name__ == '__main__':
    try:
        # Run database migration
        migrate_database()
        
        # Set up periodic cleanup of expired notifications
        import threading
        import time
        
        def periodic_cleanup():
            """Run cleanup every hour"""
            while True:
                try:
                    time.sleep(3600)  # 1 hour
                    cleanup_expired_notifications()
                except Exception as e:
                    print(f"Error in periodic cleanup: {e}")
        
        # Start cleanup thread
        cleanup_thread = threading.Thread(target=periodic_cleanup, daemon=True)
        cleanup_thread.start()
        
        print("🚀 TourApp Backend starting...")
        print("📧 Email notifications enabled")
        print("🔔 Notification system with 24-hour expiry enabled")
        print("🔄 Periodic cleanup of expired notifications enabled")
        
        # Test MongoDB Atlas connection
        print("\n🔗 Testing MongoDB Atlas connection...")
        if test_connection():
            print("✅ MongoDB Atlas connection successful!")
        else:
            print("❌ MongoDB Atlas connection failed!")
            import sys
            sys.exit(1)
        
        app.run(host='0.0.0.0', port=5000, debug=True)
        
    except Exception as e:
        print(f"❌ Failed to start backend: {e}")
        import traceback
        traceback.print_exc()

