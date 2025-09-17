import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Title, Text, Button } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EmployeeRequests() {
  const [userFullName, setUserFullName] = useState<string>('');
  const [userRequests, setUserRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadUserInfo();
    fetchUserRequests();
  }, []);

  // Refresh requests when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchUserRequests();
    }, [])
  );

  const loadUserInfo = async () => {
    try {
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (userInfo) {
        const parsed = JSON.parse(userInfo);
        setUserFullName(parsed.fullName || 'Employee');
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  // Fetch user's submitted requests
  const fetchUserRequests = async () => {
    setLoadingRequests(true);
    try {
      // Get the JWT token from AsyncStorage
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert('Error', 'Please login again');
        return;
      }

      const response = await fetch(API_ENDPOINTS.USER_REQUESTS, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserRequests(data);
      } else {
        const errorData = await response.json();
        
        // Fallback: Try to fetch all requests and filter by employee name
        if (response.status === 401 || response.status === 403) {
          const fallbackResponse = await fetch(API_ENDPOINTS.VISIT_REQUESTS);
          if (fallbackResponse.ok) {
            const allRequests = await fallbackResponse.json();
            const userRequests = allRequests.filter((req: any) => 
              req.employeeName === userFullName || req.employeeName === 'Employee'
            );
            setUserRequests(userRequests);
            return;
          }
        }
        
        Alert.alert('Error', errorData.msg || 'Failed to fetch your requests');
      }
    } catch (error) {
      console.error('Error fetching user requests:', error);
      Alert.alert('Error', `Network error: ${error.message}`);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Delete a request (only if status is pending)
  const deleteRequest = async (requestId: string) => {
    try {
      // Get the JWT token from AsyncStorage
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert('Error', 'Please login again');
        return;
      }

      const response = await fetch(`${API_ENDPOINTS.ADVANCE_REQUEST}/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        Alert.alert('Success', 'Request deleted successfully!');
        // Refresh the requests list
        await fetchUserRequests();
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.msg || 'Failed to delete request');
      }
    } catch (error) {
      console.error('Error deleting request:', error);
      Alert.alert('Error', 'Network error. Please check your connection.');
    }
  };

  // Check if request can be deleted
  const canDeleteRequest = (request: any) => {
    // Can only delete if admin hasn't taken action yet
    // Manager actions (approve/reject/hold) should NOT prevent deletion
    const isAdminPending = !request.admin_status || request.admin_status === 'pending';
    
    
    return isAdminPending;
  };

  // Get status color for display
  const getStatusColor = (status: string, adminStatus?: string) => {
    if (adminStatus === 'approved') return '#009c8e';
    if (adminStatus === 'rejected') return '#F44336';
    if (adminStatus === 'on_hold') return '#FF9800';
    if (status === 'pending') return '#2196F3';
    return '#9E9E9E';
  };

  // Get status text for display
  const getStatusText = (status: string, adminStatus?: string) => {
    if (adminStatus === 'approved') return 'Approved';
    if (adminStatus === 'rejected') return 'Rejected';
    if (adminStatus === 'on_hold') return 'On Hold';
    if (status === 'pending') return 'Pending';
    return 'Unknown';
  };

  return (
    <LinearGradient
      colors={['#E8F5E8', '#F1F8E9', '#FFFFFF']}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#E8F5E8" />
      
      {/* Header */}
      <LinearGradient
        colors={['#007a6e', '#009c8e']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Title style={styles.headerTitle}>Submit Form</Title>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.requestsListCard}>
          <Title style={styles.requestsListTitle}>My Submitted Requests</Title>
          
          {loadingRequests ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#009c8e" />
              <Text style={styles.loadingText}>Loading your requests...</Text>
            </View>
          ) : userRequests.length === 0 ? (
            <View style={styles.emptyRequestsContainer}>
              <Text style={styles.emptyRequestsText}>No requests submitted yet</Text>
            </View>
          ) : (
            <ScrollView style={styles.requestsScrollView} showsVerticalScrollIndicator={false}>
              {userRequests.map((request, index) => (
                <View key={request._id || index} style={styles.requestItem}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestProject}>{request.project}</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(request.status, request.admin_status) }
                    ]}>
                      <Text style={styles.statusText}>
                        {getStatusText(request.status, request.admin_status)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.requestDetails}>
                    <Text style={styles.requestDetail}>{request.siteCity}</Text>
                    <Text style={styles.requestDetail}>{request.duration} days</Text>
                    <Text style={styles.requestDetail}>₹{request.advance}</Text>
                    {request.dateOfJourney && (
                      <Text style={styles.requestDetail}>{request.dateOfJourney}</Text>
                    )}
                    <Text style={styles.requestDetail}>{request.reason}</Text>
                    <Text style={styles.requestDetail}>
                      Submitted on: {new Date(request.submittedAt).toLocaleDateString()}
                    </Text>
                  </View>

                  {canDeleteRequest(request) ? (
                    <Button
                      mode="outlined"
                      onPress={() => {
                        Alert.alert(
                          'Delete Request',
                          'Are you sure you want to delete this request?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Delete', 
                              style: 'destructive',
                              onPress: () => deleteRequest(request._id)
                            }
                          ]
                        );
                      }}
                      style={styles.deleteButton}
                      textColor="#F44336"
                      labelStyle={styles.deleteButtonLabel}
                    >
                      🗑️ Delete Request
                    </Button>
                              ) : (
              <View style={styles.cannotDeleteContainer}>
                <Text style={styles.cannotDeleteText}>
                  {request.admin_status && request.admin_status !== 'pending' ? 'Cannot delete: Admin has taken action' :
                   'Cannot delete: Request is being processed'}
                </Text>
              </View>
            )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
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
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  requestsListCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  requestsListTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyRequestsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyRequestsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  requestsScrollView: {
    maxHeight: 500,
  },
  requestItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestProject: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007a6e',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  requestDetails: {
    marginBottom: 12,
  },
  requestDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  deleteButton: {
    marginTop: 8,
    borderColor: '#F44336',
    borderWidth: 1,
  },
  deleteButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cannotDeleteContainer: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    marginTop: 8,
  },
  cannotDeleteText: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
    fontWeight: '500',
  },
});
