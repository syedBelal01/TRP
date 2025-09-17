import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Animated, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, useColorScheme } from 'react-native';
import { Title, Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

import { API_ENDPOINTS } from '../../config/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EmployeeDashboard() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const gradientColors = isDark ? ['#0b1f1d', '#0f2b27', '#0b1f1d'] : ['#F0F8F0', '#E8F5E8', '#F9FFF8'];
  // User state
  const [userFullName, setUserFullName] = useState<string>('');
  
  // Form state
  const [formData, setFormData] = useState({
    siteCity: '',
    project: '',
    reason: '',
    duration: '',
    advance: '',
    dateOfJourney: ''
  });

  // Format amount with commas
  const formatAmount = (value: string) => {
    // Remove all non-digit characters
    const numericValue = value.replace(/\D/g, '');
    
    if (numericValue === '') return '';
    
    // Convert to number and format with commas
    const number = parseInt(numericValue);
    return number.toLocaleString('en-IN');
  };

  // Handle amount input change
  const handleAmountChange = (text: string) => {
    const formatted = formatAmount(text);
    setFormData({...formData, advance: formatted});
  };
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [submitting, setSubmitting] = useState(false);
  const [existingRequests, setExistingRequests] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // Refs for form inputs
  const projectRef = useRef<TextInput>(null);
  const reasonRef = useRef<TextInput>(null);
  const durationRef = useRef<TextInput>(null);
  const advanceRef = useRef<TextInput>(null);

  
  const router = useRouter();


  const handleBack = () => {
    router.back();
  };

  // Load user's full name from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedFullName = await AsyncStorage.getItem('userFullName');
        if (storedFullName) {
          setUserFullName(storedFullName);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    
    loadUserData();
  }, []);

  React.useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.siteCity.trim()) {
      errors.siteCity = 'Site/City is required';
    }
    if (!formData.project.trim()) {
      errors.project = 'Project is required';
    }
    if (!formData.reason.trim()) {
      errors.reason = 'Reason is required';
    }
    if (!formData.duration.trim()) {
      errors.duration = 'Duration is required';
    } else if (isNaN(Number(formData.duration)) || Number(formData.duration) <= 0) {
      errors.duration = 'Duration must be a positive number';
    }
    
    if (!formData.dateOfJourney.trim()) {
      errors.dateOfJourney = 'Date of Journey is required';
    } else {
      const journeyDate = new Date(formData.dateOfJourney);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (isNaN(journeyDate.getTime())) {
        errors.dateOfJourney = 'Please enter a valid date';
      } else if (journeyDate < today) {
        errors.dateOfJourney = 'Date of Journey cannot be in the past';
      }
    }
    
    // Make advance amount optional but validate if provided
    if (formData.advance.trim()) {
      const numericAmount = parseInt(formData.advance.replace(/,/g, ''));
      if (isNaN(numericAmount) || numericAmount < 0) {
        errors.advance = 'Advance amount must be a positive number';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check for duplicate requests
  const checkForDuplicates = async () => {
    setCheckingDuplicates(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.USER_REQUESTS}?employeeName=${encodeURIComponent(userFullName || 'Employee')}`);
      if (response.ok) {
        const data = await response.json();
        setExistingRequests(data);
        return data;
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
    } finally {
      setCheckingDuplicates(false);
    }
    return [];
  };

  // Check if current form data matches any existing request
  const isDuplicateRequest = async (existingRequests: any[]) => {
    // Helper to check calendar-day equality
    const isSameDay = (d1: Date, d2: Date) => {
      return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );
    };

    const currentRequest = {
      siteCity: formData.siteCity.trim().toLowerCase(),
      project: formData.project.trim().toLowerCase(),
      reason: formData.reason.trim().toLowerCase(),
      duration: parseInt(formData.duration),
      advance: formData.advance.trim() ? parseInt(formData.advance.replace(/,/g, '')) : 1,
      dateOfJourney: formData.dateOfJourney.trim(),
    };

    // First check against server-provided list (same-day only)
    const serverDuplicate = existingRequests.some(request => {
      // Check if request is still pending or approved (not rejected)
      const isActiveRequest = request.status === 'pending' || 
                             request.status === 'approved' || 
                             request.admin_status === 'pending' || 
                             request.admin_status === 'approved';
      
      if (!isActiveRequest) return false;

      // Check for exact match
      const existingRequest = {
        siteCity: request.siteCity?.toLowerCase() || '',
        project: request.project?.toLowerCase() || '',
        reason: request.reason?.toLowerCase() || '',
        duration: request.duration || 0,
        advance: request.advance || 0,
        dateOfJourney: request.dateOfJourney || '',
      };

      // Must be submitted on the same calendar day
      const submittedAt = request.submittedAt ? new Date(request.submittedAt) : null;
      const sameDay = submittedAt ? isSameDay(submittedAt, new Date()) : false;

      return (
        sameDay &&
        existingRequest.siteCity === currentRequest.siteCity &&
        existingRequest.project === currentRequest.project &&
        existingRequest.reason === currentRequest.reason &&
        existingRequest.duration === currentRequest.duration &&
        existingRequest.advance === currentRequest.advance &&
        existingRequest.dateOfJourney === currentRequest.dateOfJourney
      );
    });

    if (serverDuplicate) return true;

    // Fallback: also check last locally saved successful request (same-day)
    try {
      const lastSavedRaw = await AsyncStorage.getItem('lastEmployeeRequest');
      if (lastSavedRaw) {
        const lastSaved = JSON.parse(lastSavedRaw);
        const sameDayLocal = lastSaved?.submittedAt
          ? isSameDay(new Date(lastSaved.submittedAt), new Date())
          : false;
        if (
          sameDayLocal &&
          lastSaved.siteCity?.toLowerCase() === currentRequest.siteCity &&
          lastSaved.project?.toLowerCase() === currentRequest.project &&
          lastSaved.reason?.toLowerCase() === currentRequest.reason &&
          Number(lastSaved.duration) === currentRequest.duration &&
          Number(lastSaved.advance) === currentRequest.advance &&
          lastSaved.dateOfJourney === currentRequest.dateOfJourney
        ) {
          return true;
        }
      }
    } catch (e) {
      // Ignore local read errors
    }

    return false;
  };


  // Handle date picker
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
      const formattedDate = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      setFormData({...formData, dateOfJourney: formattedDate});
    }
  };

  // Format date for display
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setSubmitting(true);
    
    try {
      // First, check for duplicate requests (same day)
      const existingRequests = await checkForDuplicates();
      const duplicate = await isDuplicateRequest(existingRequests);
      if (duplicate) {
        Alert.alert(
          'Duplicate Request Detected',
          'This request with the same details was already submitted today. Please modify the details or try again tomorrow.',
          [
            { text: 'OK', style: 'default' }
          ]
        );
        setSubmitting(false);
        return;
      }
      
      // Prepare the request data
      const requestData = {
        employeeName: userFullName || 'Employee', // Use actual user name
        siteCity: formData.siteCity.trim(),
        project: formData.project.trim(),
        reason: formData.reason.trim(),
        duration: parseInt(formData.duration),
        advance: formData.advance.trim() ? parseInt(formData.advance.replace(/,/g, '')) : 1,
        dateOfJourney: formData.dateOfJourney.trim(),
      };
      
      const response = await fetch(API_ENDPOINTS.ADVANCE_REQUEST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Reset form
        setFormData({
          siteCity: '',
          project: '',
          reason: '',
          duration: '',
          advance: '',
          dateOfJourney: ''
        });
        setFormErrors({});

        // Save last successful submission locally to help catch duplicates if offline or server check fails
        try {
          await AsyncStorage.setItem(
            'lastEmployeeRequest',
            JSON.stringify({
              siteCity: requestData.siteCity,
              project: requestData.project,
              reason: requestData.reason,
              duration: requestData.duration,
              advance: requestData.advance,
              dateOfJourney: requestData.dateOfJourney,
              submittedAt: new Date().toISOString(),
            })
          );
        } catch (e) {
          // ignore storage errors
        }
        
        Alert.alert('Success', 'Your request has been submitted successfully!');
      } else {
        const errorData = await response.json();

        Alert.alert('Error', errorData.message || errorData.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.container}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0b1f1d' : '#F0F8F0'} />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['#009c8e', '#007a6e']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewRequestsButton}
                onPress={() => router.push('/employee/requests')}
              >
                <Ionicons name="list-outline" size={20} color="#fff" />
                <Text style={styles.viewRequestsButtonText}>View Previous Requests</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.headerTextContainer}>
              <View style={styles.welcomeRow}>
                <Text style={styles.welcomeText}>Welcome </Text>
                <Text style={styles.employeeNameText}>{userFullName || 'Employee'}</Text>
              </View>
              <Title style={styles.headerTitle}>Submit Request</Title>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Form */}
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View 
            style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={[styles.formCard, isDark && styles.formCardDark]}>
              <Title style={[styles.formTitle, isDark && { color: '#e0dede' }]}>Advance Request Form</Title>
              <Text style={[styles.formSubtitle, isDark && { color: '#d0d0d0' }]}>
                Please fill in all the required fields to submit your request
              </Text>
              
                          <TextInput
              label="Site/City"
              value={formData.siteCity}
              onChangeText={(text) => setFormData({...formData, siteCity: text})}
              style={[styles.input, isDark && styles.inputDark]}
              mode="outlined"
              error={!!formErrors.siteCity}
              placeholder="Enter site or city name"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => projectRef.current?.focus()}
            />
              <HelperText type="error" visible={!!formErrors.siteCity}>
                {formErrors.siteCity}
              </HelperText>

              <TextInput
                ref={projectRef}
                label="Project"
                value={formData.project}
                onChangeText={(text) => setFormData({...formData, project: text})}
                style={[styles.input, isDark && styles.inputDark]}
                mode="outlined"
                error={!!formErrors.project}
                placeholder="Enter project name"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => reasonRef.current?.focus()}
              />
              <HelperText type="error" visible={!!formErrors.project}>
                {formErrors.project}
              </HelperText>

              <TextInput
                ref={reasonRef}
                label="Reason"
                value={formData.reason}
                onChangeText={(text) => setFormData({...formData, reason: text})}
                style={[styles.input, isDark && styles.inputDark]}
                mode="outlined"
                error={!!formErrors.reason}
                placeholder="Describe the reason for your request"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => durationRef.current?.focus()}
              />
              <HelperText type="error" visible={!!formErrors.reason}>
                {formErrors.reason}
              </HelperText>

              <TextInput
                ref={durationRef}
                label="Duration (days)"
                value={formData.duration}
                onChangeText={(text) => setFormData({...formData, duration: text})}
                style={[styles.input, isDark && styles.inputDark]}
                mode="outlined"
                keyboardType="numeric"
                error={!!formErrors.duration}
                placeholder="Enter number of days"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => advanceRef.current?.focus()}
              />
              <HelperText type="error" visible={!!formErrors.duration}>
                {formErrors.duration}
              </HelperText>

              <TouchableOpacity
                style={[styles.datePickerButton, formErrors.dateOfJourney && styles.datePickerButtonError]}
                onPress={() => setShowDatePicker(true)}
              >
                <View style={styles.datePickerContent}>
                  <Ionicons name="calendar-outline" size={20} color="#666" style={styles.datePickerIcon} />
                  <View style={styles.datePickerTextContainer}>
                    <Text style={styles.datePickerLabel}>Date of Journey</Text>
                    <Text style={[styles.datePickerValue, !formData.dateOfJourney && styles.datePickerPlaceholder]}>
                      {formData.dateOfJourney ? formatDateForDisplay(formData.dateOfJourney) : 'Select date'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </View>
              </TouchableOpacity>
              <HelperText type="error" visible={!!formErrors.dateOfJourney}>
                {formErrors.dateOfJourney}
              </HelperText>

              <TextInput
                ref={advanceRef}
                label="Advance Amount (₹)"
                value={formData.advance}
                onChangeText={handleAmountChange}
                style={[styles.input, isDark && styles.inputDark]}
                mode="outlined"
                keyboardType="numeric"
                error={!!formErrors.advance}
                placeholder="Enter advance amount"
                returnKeyType="done"
                blurOnSubmit={true}
              />
              <HelperText type="error" visible={!!formErrors.advance}>
                {formErrors.advance}
              </HelperText>

              {/* Duplicate Prevention Notice */}
              <View style={styles.duplicateNotice}>
                <Text style={styles.duplicateNoticeText}>
                  ℹ️ Duplicate requests with the same details are automatically prevented
                </Text>
              </View>

              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.submitButton}
                buttonColor="#009c8e"
                loading={submitting || checkingDuplicates}
                disabled={submitting || checkingDuplicates}
                labelStyle={styles.submitButtonLabel}
              >
                {checkingDuplicates ? 'Checking for Duplicates...' : submitting ? 'Submitting...' : 'Submit Request'}
              </Button>

              
            </View>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  headerGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 12,
  },
  headerTextContainer: {
    alignItems: 'flex-start',
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 12,
  },
  forgotPasswordButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  forgotPasswordButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '300',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    color: '#fff',
    fontSize: 18,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 8,
    flexWrap: 'nowrap',
  },
  welcomeText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  employeeNameText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  content: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formContainer: {
    alignItems: 'center',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 10,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  inputDark: {
    backgroundColor: '#102522',
    color: '#FFFFFF',
  },
  duplicateNotice: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  duplicateNoticeText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'center',
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  viewRequestsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewRequestsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  datePickerButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  formCardDark: {
    backgroundColor: '#0f2220',
  },
  datePickerButtonDark: {
    backgroundColor: '#102522',
    borderColor: '#21413c',
  },
  datePickerButtonError: {
    borderColor: '#F44336',
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  datePickerIcon: {
    marginRight: 12,
  },
  datePickerTextContainer: {
    flex: 1,
  },
  datePickerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  datePickerValue: {
    fontSize: 16,
    color: '#000',
  },
  datePickerPlaceholder: {
    color: '#999',
  },
  datePickerPlaceholderDark: {
    color: '#cfcfcf',
  },
});
