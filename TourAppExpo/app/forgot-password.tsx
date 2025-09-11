import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, useColorScheme } from 'react-native';
import { Title, Text, TextInput, Button, HelperText, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../config/api';
import PrenitworldLogo from '../components/PrenitworldLogo';

export default function ForgotPassword() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const gradientColors = isDark ? ['#0b1f1d', '#0f2b27', '#0b1f1d'] : ['#F0F8F0', '#E8F5E8', '#F9FFF8'];
  const [step, setStep] = useState<'email' | 'otp' | 'newPassword'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  
  const router = useRouter();

  // Validate email format
  const validateEmail = () => {
    const errors: {[key: string]: string} = {};
    
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check if email exists and send OTP
  const handleCheckEmailAndSendOtp = async () => {
    if (!validateEmail()) return;
    
    setLoading(true);
    try {
      // Check if email exists and send OTP in one request
      const response = await fetch(API_ENDPOINTS.FORGOT_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          action: 'send_otp'
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Please check if the backend is running.');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        throw new Error('Invalid response from server. Please try again later.');
      }
      
      if (response.ok && data.email_exists) {
        // OTP sent successfully
        setStep('otp');
        Alert.alert(
          'OTP Sent Successfully!', 
          'A verification code has been sent to your email address.',
          [{ text: 'OK' }]
        );
      } else if (response.status === 404) {
        // Email does not exist
        Alert.alert(
          'Email Not Found', 
          'This email address is not registered in our system. Please check the email address or register a new account.',
          [
            { text: 'Check Email', style: 'cancel' },
            { 
              text: 'Register Account', 
              onPress: () => router.push('/register')
            }
          ]
        );
      } else if (response.status === 500) {
        // Server error
        Alert.alert(
          'Server Error', 
          'There was a problem with our server. Please try again later or contact support.',
          [{ text: 'OK' }]
        );
      } else {
        // Other errors
        Alert.alert(
          'Error', 
          data?.msg || `Request failed with status: ${response.status}. Please try again.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error checking email/sending OTP:', error);
      
      // Handle specific error types
      if (error.message.includes('non-JSON response')) {
        Alert.alert(
          'Backend Error', 
          'The server is not responding correctly. Please check if the backend is running and try again.',
          [
            { text: 'OK' },
            { 
              text: 'Check Backend', 
              onPress: checkBackendHealth
            }
          ]
        );
      } else if (error.message.includes('Invalid response')) {
        Alert.alert(
          'Server Error', 
          'The server returned an invalid response. Please try again later.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Network Error', 
          'Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('Error', 'Please enter the OTP code');
      return;
    }
    
    if (otp.trim().length < 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP code');
      return;
    }
    
    setOtpLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.RESET_PASSWORD_REQUEST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim()
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response when verifying OTP. Please try again.');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('OTP Verification JSON Parse Error:', parseError);
        throw new Error('Invalid response from server when verifying OTP. Please try again.');
      }
      
      if (response.ok && data.otp_valid) {
        setStep('newPassword');
        Alert.alert('OTP Verified!', 'Please enter your new password.');
      } else if (response.status === 400) {
        Alert.alert('Invalid OTP', data.msg || 'The OTP code is incorrect. Please try again.');
      } else if (response.status === 500) {
        Alert.alert('Server Error', 'There was a problem with our server. Please try again later.');
      } else {
        Alert.alert('Error', data?.msg || `OTP verification failed with status: ${response.status}. Please try again.`);
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      
      // Handle specific error types
      if (error.message.includes('non-JSON response')) {
        Alert.alert(
          'Backend Error', 
          'The server is not responding correctly. Please check if the backend is running and try again.',
          [{ text: 'OK' }]
        );
      } else if (error.message.includes('Invalid response')) {
        Alert.alert(
          'Server Error', 
          'The server returned an invalid response. Please try again later.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Network Error', 
          'Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Validate password form
  const validatePasswordForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters long';
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!validatePasswordForm()) return;
    
    setPasswordLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.RESET_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          new_password: newPassword
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response when resetting password. Please try again.');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Password Reset JSON Parse Error:', parseError);
        throw new Error('Invalid response from server when resetting password. Please try again.');
      }
      
      if (response.ok) {
        Alert.alert(
          'Password Reset Successful!', 
          'Your password has been reset successfully. You can now log in with your new password.',
          [
            {
              text: 'Login Now',
              onPress: () => {
                // Clear form and redirect to login
                setEmail('');
                setOtp('');
                setNewPassword('');
                setConfirmPassword('');
                setStep('email');
                setFormErrors({});
                router.push('/login');
              }
            }
          ]
        );
      } else if (response.status === 400) {
        Alert.alert('Invalid Request', data.msg || 'Please check your OTP and try again.');
      } else if (response.status === 500) {
        Alert.alert('Server Error', 'There was a problem with our server. Please try again later.');
      } else {
        Alert.alert('Error', data?.msg || `Password reset failed with status: ${response.status}. Please try again.`);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      
      // Handle specific error types
      if (error.message.includes('non-JSON response')) {
        Alert.alert(
          'Backend Error', 
          'The server is not responding correctly. Please check if the backend is running and try again.',
          [{ text: 'OK' }]
        );
      } else if (error.message.includes('Invalid response')) {
        Alert.alert(
          'Server Error', 
          'The server returned an invalid response. Please try again later.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Network Error', 
          'Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setOtpLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.FORGOT_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          action: 'send_otp'
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response when resending OTP. Please try again.');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Resend OTP JSON Parse Error:', parseError);
        throw new Error('Invalid response from server when resending OTP. Please try again.');
      }
      
      if (response.ok) {
        Alert.alert('OTP Resent', 'A new verification code has been sent to your email.');
      } else if (response.status === 400) {
        Alert.alert('Invalid Request', data.msg || 'Please check your email and try again.');
      } else if (response.status === 500) {
        Alert.alert('Server Error', 'There was a problem with our server. Please try again later.');
      } else {
        Alert.alert('Error', data?.msg || `Failed to resend OTP with status: ${response.status}. Please try again.`);
      }
    } catch (error) {
      console.error('Error resending OTP:', error);
      
      // Handle specific error types
      if (error.message.includes('non-JSON response')) {
        Alert.alert(
          'Backend Error', 
          'The server is not responding correctly. Please check if the backend is running and try again.',
          [{ text: 'OK' }]
        );
      } else if (error.message.includes('Invalid response')) {
        Alert.alert(
          'Server Error', 
          'The server returned an invalid response. Please try again later.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Network Error', 
          'Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Go back to email step
  const handleBackToEmail = () => {
    setOtp('');
    setStep('email');
    setFormErrors({});
  };

  // Go back to OTP step
  const handleBackToOtp = () => {
    setNewPassword('');
    setConfirmPassword('');
    setStep('otp');
    setFormErrors({});
  };

  // Check backend health
  const checkBackendHealth = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH);
      if (response.ok) {
        Alert.alert(
          'Backend Status', 
          '✅ Backend is running and responding correctly.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Backend Status', 
          `⚠️ Backend is responding but with status: ${response.status}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Backend Status', 
        '❌ Backend is not accessible. Please check if the server is running.',
        [{ text: 'OK' }]
      );
    }
  };

  // Render email input step
  const renderEmailStep = () => (
    <>
      <Title style={[styles.formTitle, { color: isDark ? '#e0dede' : '#007a6e' }]}>Forgot Password</Title>
      <Text style={[styles.descriptionText, { color: isDark ? '#d9d9d9' : '#666' }]}>
        Enter your registered email address to receive a verification code.
      </Text>
      
      <TextInput
        label="Email Address"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, isDark && { backgroundColor: '#102522', color: '#FFFFFF' }]}
        mode="outlined"
        placeholder="Enter your email address"
        keyboardType="email-address"
        autoCapitalize="none"
        error={!!formErrors.email}
        left={<TextInput.Icon icon="email" />}
      />
      <HelperText type="error" visible={!!formErrors.email}>
        {formErrors.email}
      </HelperText>

      <Text style={styles.securityNote}>
        🔒 Security Note: We will only send an OTP if this email is registered in our system.
      </Text>

      <Button
        mode="contained"
        onPress={handleCheckEmailAndSendOtp}
        style={styles.submitButton}
        buttonColor="#009c8e"
        loading={loading}
        disabled={loading}
        labelStyle={styles.submitButtonLabel}
      >
        {loading ? 'Checking Email...' : 'Send Verification Code'}
      </Button>

      <Button
        mode="text"
        onPress={() => router.push('/login')}
        style={styles.backToLoginButton}
        textColor="#666"
      >
        ← Back to Login
      </Button>
    </>
  );

  // Render OTP verification step
  const renderOtpStep = () => (
    <>
      <Title style={styles.formTitle}>Verify OTP</Title>
      <Text style={styles.descriptionText}>
        We've sent a 6-digit verification code to:
      </Text>
      
      <View style={styles.emailDisplay}>
        <Ionicons name="mail" size={20} color="#007a6e" />
        <Text style={styles.emailText}>{email}</Text>
      </View>
      
      <TextInput
        label="OTP Code"
        value={otp}
        onChangeText={setOtp}
        style={[styles.input, isDark && { backgroundColor: '#102522', color: '#FFFFFF' }]}
        mode="outlined"
        placeholder="Enter 6-digit OTP"
        keyboardType="numeric"
        maxLength={6}
        left={<TextInput.Icon icon="key" />}
      />

      <Button
        mode="contained"
        onPress={handleVerifyOtp}
        style={styles.submitButton}
        buttonColor="#009c8e"
        loading={otpLoading}
        disabled={otpLoading || !otp.trim() || otp.trim().length < 6}
        labelStyle={styles.submitButtonLabel}
      >
        {otpLoading ? 'Verifying...' : 'Verify OTP'}
      </Button>

      <Button
        mode="outlined"
        onPress={handleResendOtp}
        style={styles.resendButton}
        textColor="#009c8e"
        disabled={otpLoading}
      >
        Resend OTP
      </Button>

      <Button
        mode="text"
        onPress={handleBackToEmail}
        style={styles.backButton}
        textColor="#666"
      >
        ← Change Email Address
      </Button>
    </>
  );

  // Render new password step
  const renderNewPasswordStep = () => (
    <>
      <Title style={styles.formTitle}>Set New Password</Title>
      <Text style={styles.descriptionText}>
        Create a new password for your account.
      </Text>
      
      <TextInput
        label="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        style={[styles.input, isDark && { backgroundColor: '#102522', color: '#FFFFFF' }]}
        mode="outlined"
        placeholder="Enter new password (min. 6 characters)"
        secureTextEntry
        left={<TextInput.Icon icon="lock" />}
        error={!!formErrors.newPassword}
      />
      <HelperText type="error" visible={!!formErrors.newPassword}>
        {formErrors.newPassword}
      </HelperText>

      <TextInput
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={[styles.input, isDark && { backgroundColor: '#102522', color: '#FFFFFF' }]}
        mode="outlined"
        placeholder="Confirm new password"
        secureTextEntry
        left={<TextInput.Icon icon="lock" />}
        error={!!formErrors.confirmPassword}
      />
      <HelperText type="error" visible={!!formErrors.confirmPassword}>
        {formErrors.confirmPassword}
      </HelperText>

      <Button
        mode="contained"
        onPress={handleResetPassword}
        style={styles.submitButton}
        buttonColor="#009c8e"
        loading={passwordLoading}
        disabled={passwordLoading}
        labelStyle={styles.submitButtonLabel}
      >
        {passwordLoading ? 'Resetting Password...' : 'Reset Password'}
      </Button>

      <Button
        mode="text"
        onPress={handleBackToOtp}
        style={styles.backButton}
        textColor="#666"
      >
        ← Back to OTP
      </Button>
    </>
  );

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.container}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0b1f1d' : '#F0F8F0'} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButtonHeader}
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? '#009c8e' : '#007a6e'} />
            </TouchableOpacity>
            
            {/* App Title + Tagline */}
            <View style={styles.headerCenter}>
              <Text style={[styles.appName, { color: isDark ? '#FFFFFF' : '#007a6e' }]}>TRP</Text>
              <Text style={[styles.appTagline, { color: isDark ? '#e0dede' : '#666' }]}>Travel Requisition Portal</Text>
            </View>
            
            {/* Right spacer to balance the back button */}
            <View style={styles.headerRight} />
          </View>

          {/* Form Card */}
          <Card style={styles.formCard}>
            <Card.Content style={styles.formContent}>
              {step === 'email' && renderEmailStep()}
              {step === 'otp' && renderOtpStep()}
              {step === 'newPassword' && renderNewPasswordStep()}
            </Card.Content>
          </Card>
          {/* Bottom Logo */}
          <View style={styles.bottomLogoContainer}>
            <PrenitworldLogo size="medium" showTagline={false} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  backButtonHeader: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007a6e',
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#007a6e',
    letterSpacing: 1,
    marginBottom: 6,
  },
  appTagline: {
    fontSize: 14,
    color: '#666',
  },
  formCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  formContent: {
    padding: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007a6e',
    textAlign: 'center',
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  securityNote: {
    fontSize: 14,
    color: '#FF9800',
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
  },
  emailDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8F0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E8F5E8',
  },
  emailText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007a6e',
    marginLeft: 12,
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 16,
    elevation: 4,
  },
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderColor: '#009c8e',
  },
  backToLoginButton: {
    marginTop: 8,
  },
  backButton: {
    marginTop: 8,
  },
  bottomLogoContainer: {
    marginTop: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
});
