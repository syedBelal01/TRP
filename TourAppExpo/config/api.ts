// API Configuration
export const API_BASE_URL = 'http://54.91.37.236';

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: `${API_BASE_URL}/login`,
  VERIFY_LOGIN_OTP: `${API_BASE_URL}/verify-login-otp`,
  VERIFY_REGISTRATION_OTP: `${API_BASE_URL}/verify-registration-otp`,
  REGISTER: `${API_BASE_URL}/register`,
  FORGOT_PASSWORD: `${API_BASE_URL}/public/forgot-password`,
  RESET_PASSWORD_REQUEST: `${API_BASE_URL}/public/verify-otp`,
  RESET_PASSWORD: `${API_BASE_URL}/public/reset-password`,
  
  // User Management
  USER_PROFILE: `${API_BASE_URL}/user/profile`,
  USER_REQUESTS: `${API_BASE_URL}/user/requests`,
  USER_PROFILE_UPDATE: `${API_BASE_URL}/user/profile`,
  
  // Requests
  ADVANCE_REQUEST: `${API_BASE_URL}/advance-request`,
  VISIT_REQUESTS: `${API_BASE_URL}/visit-requests`,
  VISIT_REQUEST: (id: string) => `${API_BASE_URL}/visit-request/${id}`,
  
  // Notifications
  NOTIFICATIONS: (role: string) => `${API_BASE_URL}/notifications/${role}`,
  NOTIFICATION_READ: (id: string) => `${API_BASE_URL}/notifications/${id}/read`,
  NOTIFICATION_UNREAD_COUNT: (role: string) => `${API_BASE_URL}/notifications/${role}/unread-count`,
  NOTIFICATION_MARK_ALL_READ: (role: string) => `${API_BASE_URL}/notifications/${role}/mark-all-read`,
  NOTIFICATION_DELETE: (id: string) => `${API_BASE_URL}/notifications/${id}`,
  NOTIFICATION_CLEANUP: `${API_BASE_URL}/notifications/cleanup`,
  
  // Admin
  ADMIN_CHECK_EXISTS: `${API_BASE_URL}/admin/check-exists`,
  ADMIN_REGISTER: `${API_BASE_URL}/admin/register`,
  ADMIN_PENDING_USERS: `${API_BASE_URL}/admin/pending-users`,
  ADMIN_APPROVE_USER: `${API_BASE_URL}/admin/approve-user`,
  ADMIN_ACTION: `${API_BASE_URL}/admin-action`,
  
  // Accounts
  ACCOUNTS_APPROVED_REQUESTS: `${API_BASE_URL}/accounts/approved-requests`,
  
  // Test
  TEST_NOTIFICATIONS: `${API_BASE_URL}/test-notifications`,
  TEST_EMAIL: `${API_BASE_URL}/test-email`,
  HEALTH: `${API_BASE_URL}/health`,
};
