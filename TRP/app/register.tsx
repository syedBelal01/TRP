import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, useColorScheme } from 'react-native';
import { Title, Text, TextInput, Button, HelperText, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../config/api';
import PrenitworldLogo from '../components/PrenitworldLogo';

export default function Register() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const gradientColors = isDark ? ['#0b1f1d', '#0f2b27', '#0b1f1d'] : ['#F0F8F0', '#E8F5E8', '#F9FFF8'];
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'employee'
  });
  
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  
  const router = useRouter();

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.fullName.trim()) {
      errors.fullName = 'Full Name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: formData.role
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setShowOtpInput(true);
        Alert.alert('OTP Sent', 'Please check your email for the OTP verification code.');
      } else {
        Alert.alert('Registration Failed', data.msg || 'Failed to register. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerification = async () => {
    if (!otp.trim()) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }
    
    setOtpLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.VERIFY_REGISTRATION_OTP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          otp: otp.trim()
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        Alert.alert(
          'Registration Successful!', 
          `Welcome ${data.fullName || formData.fullName}! Your account is now pending admin approval. You will be notified once approved.`,
          [
            {
              text: 'OK',
              onPress: () => router.push('/')
            }
          ]
        );
      } else {
        Alert.alert('OTP Verification Failed', data.msg || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: formData.role
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        Alert.alert('OTP Resent', 'A new OTP has been sent to your email.');
      } else {
        Alert.alert('Failed to Resend OTP', data.msg || 'Please try again.');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

          {/* Registration Form */}
          <Card style={styles.formCard}>
            <Card.Content style={styles.formContent}>
              {!showOtpInput ? (
                <>
                  <Title style={[styles.formTitle, { color: isDark ? '#e0dede' : '#007a6e' }]}>Registration Details</Title>
                  
                  <TextInput
                    label="Full Name"
                    value={formData.fullName}
                    onChangeText={(text) => setFormData({...formData, fullName: text})}
                    style={[styles.input, isDark && { backgroundColor: '#102522', color: '#FFFFFF' }]}
                    mode="outlined"
                    error={!!formErrors.fullName}
                    placeholder="Enter your full name"
                    left={<TextInput.Icon icon="account" />}
                  />
                  <HelperText type="error" visible={!!formErrors.fullName}>
                    {formErrors.fullName}
                  </HelperText>

                  <TextInput
                    label="Email"
                    value={formData.email}
                    onChangeText={(text) => setFormData({...formData, email: text})}
                    style={[styles.input, isDark && { backgroundColor: '#102522', color: '#FFFFFF' }]}
                    mode="outlined"
                    error={!!formErrors.email}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="email" />}
                  />
                  <HelperText type="error" visible={!!formErrors.email}>
                    {formErrors.email}
                  </HelperText>

                  <TextInput
                    label="Password"
                    value={formData.password}
                    onChangeText={(text) => setFormData({...formData, password: text})}
                    style={[styles.input, isDark && { backgroundColor: '#102522', color: '#FFFFFF' }]}
                    mode="outlined"
                    error={!!formErrors.password}
                    placeholder="Enter your password"
                    secureTextEntry
                    left={<TextInput.Icon icon="lock" />}
                  />
                  <HelperText type="error" visible={!!formErrors.password}>
                    {formErrors.password}
                  </HelperText>

                  <TextInput
                    label="Confirm Password"
                    value={formData.confirmPassword}
                    onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
                    style={[styles.input, isDark && { backgroundColor: '#102522', color: '#FFFFFF' }]}
                    mode="outlined"
                    error={!!formErrors.confirmPassword}
                    placeholder="Confirm your password"
                    secureTextEntry
                    left={<TextInput.Icon icon="lock-check" />}
                  />
                  <HelperText type="error" visible={!!formErrors.confirmPassword}>
                    {formErrors.confirmPassword}
                  </HelperText>

                  <View style={styles.roleContainer}>
                    <Text style={styles.roleLabel}>Select Role:</Text>
                    <View style={styles.roleButtons}>
                      {['employee', 'manager', 'admin', 'accounts'].map((role) => (
                        <Button
                          key={role}
                          mode={formData.role === role ? 'contained' : 'outlined'}
                          onPress={() => setFormData({...formData, role})}
                          style={styles.roleButton}
                          buttonColor={formData.role === role ? '#009c8e' : undefined}
                          textColor={formData.role === role ? '#fff' : '#009c8e'}
                        >
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </Button>
                      ))}
                    </View>
                  </View>

                  <Button
                    mode="contained"
                    onPress={handleRegister}
                    style={styles.submitButton}
                    buttonColor="#009c8e"
                    loading={loading}
                    disabled={loading}
                    labelStyle={styles.submitButtonLabel}
                  >
                    Register
                  </Button>
                </>
              ) : (
                <>
                  <Title style={styles.formTitle}>Verify OTP</Title>
                  <Text style={styles.otpText}>
                    We&apos;ve sent a verification code to {formData.email}
                  </Text>
                  
                  <TextInput
                    label="OTP Code"
                    value={otp}
                    onChangeText={setOtp}
                    style={styles.input}
                    mode="outlined"
                    placeholder="Enter 6-digit OTP"
                    keyboardType="numeric"
                    maxLength={6}
                    left={<TextInput.Icon icon="key" />}
                  />

                  <Button
                    mode="contained"
                    onPress={handleOtpVerification}
                    style={styles.submitButton}
                    buttonColor="#009c8e"
                    loading={otpLoading}
                    disabled={otpLoading}
                    labelStyle={styles.submitButtonLabel}
                  >
                    Verify OTP
                  </Button>

                  <Button
                    mode="outlined"
                    onPress={resendOtp}
                    style={styles.resendButton}
                    textColor="#009c8e"
                    disabled={loading}
                  >
                    Resend OTP
                  </Button>
                </>
              )}

              <Button
                mode="text"
                onPress={() => router.push('/login')}
                style={styles.loginButton}
                textColor="#666"
              >
                Already have an account? Login
              </Button>
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
    paddingTop: 80,
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
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
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  formContent: {
    padding: 18,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007a6e',
    textAlign: 'center',
    marginBottom: 18,
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  roleContainer: {
    marginBottom: 18,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  roleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    minWidth: '45%',
  },
  submitButton: {
    borderRadius: 10,
    paddingVertical: 6,
    marginBottom: 12,
    elevation: 3,
  },
  submitButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendButton: {
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderColor: '#009c8e',
  },
  loginButton: {
    marginTop: 8,
  },
  otpText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  bottomLogoContainer: {
    marginTop: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
});
