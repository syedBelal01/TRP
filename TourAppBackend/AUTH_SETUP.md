# TourApp Authentication System Setup Guide

## Overview
This guide explains how to set up and use the new authentication system with OTP email verification and admin approval workflow.

## Prerequisites
- Python 3.7+
- MongoDB running locally
- Gmail account with app password
- Required Python packages (see requirements.txt)

## Backend Configuration

### 1. Email Configuration
Update the Gmail settings in `app.py`:

```python
app.config['MAIL_USERNAME'] = 'ahmad.prenit@gmail.com'  # Your Gmail address
app.config['MAIL_PASSWORD'] = 'tevt swyk tpsp gzrr'  # Your Gmail app password
```

**Important**: Replace `ahmad.prenit@gmail.com` with your actual Gmail address.

### 2. Database Collections
The system uses these MongoDB collections:
- `users` - Approved user accounts
- `pending_registrations` - Users pending admin approval
- `otps` - Login OTPs
- `user_tokens` - JWT tokens for sessions

### 3. Backend Testing
Run the test script to verify endpoints:

```bash
cd TourAppBackend
python test_auth.py
```

## Frontend Setup

### 1. Dependencies
Ensure these packages are installed:
```bash
npm install @react-native-async-storage/async-storage
```

### 2. New Screens
- `app/index.tsx` - Welcome screen with login/register options
- `app/login.tsx` - Login screen with OTP verification
- `app/register.tsx` - Registration screen with OTP verification

### 3. Context Providers
- `contexts/AuthContext.tsx` - Authentication state management

## Authentication Flow

### 1. User Registration
1. User fills registration form (Full Name, Email, Password, Role)
2. System validates input and checks for existing users
3. Admin restriction: Only one admin account allowed
4. OTP sent to user's email
5. User verifies OTP
6. Account status: "Pending Admin Approval"

### 2. Admin Approval
1. Admin views pending users in admin dashboard
2. Admin can approve or reject each user
3. Approved users are moved to `users` collection
4. Rejected users are removed from pending list
5. Email notifications sent to users

### 3. User Login
1. User enters email and password
2. System checks if account is approved
3. If approved: OTP sent to email
4. If pending: Error message shown
5. User verifies OTP
6. JWT token generated and stored
7. User redirected to role-specific dashboard

## API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /verify-registration-otp` - Verify registration OTP
- `POST /login` - User login
- `POST /verify-login-otp` - Verify login OTP
- `POST /logout` - User logout

### Admin Management
- `GET /admin/pending-users` - Get pending users
- `POST /admin/approve-user` - Approve/reject user

### User Profile
- `GET /user/profile` - Get user profile

## Security Features

### 1. Password Security
- Passwords hashed using bcrypt
- Minimum 6 characters required

### 2. OTP Security
- 6-digit numeric OTPs
- 5-minute expiration
- Email-based delivery

### 3. JWT Authentication
- 24-hour token expiration
- Multiple session support
- Secure token storage

### 4. Admin Restrictions
- Single admin account enforcement
- Role-based access control
- Admin approval required for all non-admin users

## Testing Scenarios

### 1. Registration Flow
1. Test registration with valid data
2. Test duplicate email handling
3. Test admin account restriction
4. Test OTP verification
5. Test admin approval workflow

### 2. Login Flow
1. Test login with pending account (should fail)
2. Test login with approved account
3. Test OTP verification
4. Test role-based redirection

### 3. Admin Functions
1. Test pending users listing
2. Test user approval
3. Test user rejection
4. Test email notifications

## Troubleshooting

### Common Issues

#### 1. Email Not Sending
- Check Gmail app password
- Verify Gmail address in config
- Check network connectivity
- Review SMTP settings

#### 2. OTP Verification Fails
- Check OTP expiration (5 minutes)
- Verify OTP format (6 digits)
- Check database connection

#### 3. Admin Approval Issues
- Verify admin role in database
- Check JWT token validity
- Review pending users collection

#### 4. Frontend Navigation Issues
- Verify route configuration in `_layout.tsx`
- Check authentication state
- Review role-based routing logic

### Debug Steps
1. Check backend logs for errors
2. Verify database collections exist
3. Test API endpoints with Postman/curl
4. Check frontend console for errors
5. Verify email configuration

## Production Considerations

### 1. Security
- Use environment variables for sensitive data
- Implement rate limiting
- Add request validation
- Use HTTPS in production

### 2. Email
- Use production email service (SendGrid, AWS SES)
- Implement email templates
- Add email delivery tracking

### 3. Monitoring
- Add logging for authentication events
- Monitor failed login attempts
- Track OTP delivery success rates

## Support
For issues or questions:
1. Check this documentation
2. Review error logs
3. Test with provided test scripts
4. Verify configuration settings
