import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, useColorScheme } from 'react-native';
import { Title, Text, TextInput, Button, HelperText, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PrenitworldLogo from '../components/PrenitworldLogo';

export default function Login() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const gradientColors = isDark ? ['#0b1f1d', '#0f2b27', '#0b1f1d'] : ['#F0F8F0', '#E8F5E8', '#F9FFF8'];
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [userInfo, setUserInfo] = useState<any>(null);
  
  const router = useRouter();

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        }),
      });

      const data = await response.json();

      
      if (response.ok) {
        // Check if OTP verification is needed
                 if (data.skip_otp === true) {
           // No OTP needed - login successful
           // Store token and user info in AsyncStorage
           try {
             await AsyncStorage.setItem('userToken', data.token);
             await AsyncStorage.setItem('userRole', data.role);
             await AsyncStorage.setItem('userFullName', data.fullName);
             await AsyncStorage.setItem('userId', data.user_id);
           } catch (error) {
             console.error('Error storing user data:', error);
           }
           
           Alert.alert(
             'Login Successful!', 
             `Welcome back, ${data.fullName || 'User'}!`,
             [
               {
                 text: 'Continue',
                 onPress: () => {
                   // Redirect based on role
                   switch (data.role) {
                     case 'employee':
                       router.push('/employee/dashboard');
                       break;
                     case 'manager':
                       router.push('/manager-dashboard');
                       break;
                     case 'admin':
                       router.push('/admin-dashboard');
                       break;
                     case 'accounts':
                       router.push('/accounts-dashboard');
                       break;
                     default:
                       router.push('/');
                   }
                 }
               }
             ]
           );
        } else {
          // OTP verification needed (for backward compatibility)
          setUserInfo(data);
          setShowOtpInput(true);
          Alert.alert('OTP Sent', 'Please check your email for the OTP verification code.');
        }
      } else if (response.status === 403) {
        Alert.alert('Account Pending Approval', data.msg || 'Your account is pending admin approval. Please wait for approval before logging in.');
      } else {
        Alert.alert('Login Failed', data.msg || 'Invalid email or password. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
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
      const response = await fetch(API_ENDPOINTS.VERIFY_LOGIN_OTP, {
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
        // Store token and user info (you can use AsyncStorage here)
        Alert.alert(
          'Login Successful!', 
          `Welcome back, ${data.user?.fullName || userInfo?.fullName || 'User'}!`,
          [
            {
              text: 'Continue',
              onPress: () => {
                // Redirect based on role
                switch (data.user?.role || userInfo?.role) {
                  case 'employee':
                    router.push('/employee/dashboard');
                    break;
                  case 'manager':
                    router.push('/manager-dashboard');
                    break;
                  case 'admin':
                    router.push('/admin-dashboard');
                    break;
                  case 'accounts':
                    router.push('/accounts-dashboard');
                    break;
                  default:
                    router.push('/');
                }
              }
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
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Check if OTP verification is needed
        if (data.skip_otp === true) {
          // No OTP needed - login successful
          Alert.alert(
            'Login Successful!', 
            `Welcome back, ${data.fullName || 'User'}!`,
            [
              {
                text: 'Continue',
                onPress: () => {
                  // Redirect based on role
                  switch (data.role) {
                    case 'employee':
                      router.push('/employee/dashboard');
                      break;
                    case 'manager':
                      router.push('/manager-dashboard');
                      break;
                    case 'admin':
                      router.push('/admin-dashboard');
                      break;
                    case 'accounts':
                      router.push('/accounts-dashboard');
                      break;
                    default:
                      router.push('/');
                  }
                }
              }
            ]
          );
        } else {
          // OTP verification needed
          setUserInfo(data);
          Alert.alert('OTP Resent', 'A new OTP has been sent to your email.');
        }
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

          {/* Login Form */}
          <Card style={styles.formCard}>
            <Card.Content style={styles.formContent}>
              {!showOtpInput ? (
                <>
                  <Title style={[styles.formTitle, { color: isDark ? '#e0dede' : '#007a6e' }]}>Login Details</Title>
                  
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

                  <Button
                    mode="contained"
                    onPress={handleLogin}
                    style={styles.submitButton}
                    buttonColor="#009c8e"
                    loading={loading}
                    disabled={loading}
                    labelStyle={styles.submitButtonLabel}
                  >
                    Login
                  </Button>
                </>
              ) : (
                <>
                  <Title style={styles.formTitle}>Verify OTP</Title>
                  <Text style={styles.otpText}>
                    We've sent a verification code to {formData.email}
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
                 onPress={() => router.push('/register')}
                 style={styles.registerButton}
                 textColor="#666"
               >
                 Don't have an account? Register
               </Button>
               
               <Button
                 mode="text"
                 onPress={() => router.push('/forgot-password')}
                 style={styles.forgotPasswordButton}
                 textColor="#666"
               >
                 Forgot Password?
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
  registerButton: {
    marginTop: 8,
  },
  forgotPasswordButton: {
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
