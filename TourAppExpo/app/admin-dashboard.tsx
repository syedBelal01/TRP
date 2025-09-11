import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Animated, StatusBar, TouchableOpacity } from 'react-native';
import { Title, Text, Card, Chip, Button, TextInput, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';



interface VisitRequest {
  _id: string;
  employeeName: string;
  siteCity: string;
  project: string;
  reason: string;
  duration: number;
  advance: number;
  dateOfJourney?: string;
  status: string;
  admin_status: string;
  submittedAt: string;
  approved_by?: string;
  approved_by_admin?: string;
  edited_by_manager?: boolean;
  manager_edit_by?: string;
  manager_edit_timestamp?: string;
  manager_edit_changes?: {
    advance?: { from: number; to: number };
    duration?: { from: number; to: number };
  };
}

interface GroupedRequests {
  pending: VisitRequest[];
  hold: VisitRequest[];
  approved: VisitRequest[];
  rejected: VisitRequest[];
}

export default function AdminDashboard() {
  // State for requests and UI
  const [requests, setRequests] = useState<VisitRequest[]>([]);
  const [groupedRequests, setGroupedRequests] = useState<GroupedRequests>({
    pending: [],
    hold: [],
    approved: [],
    rejected: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VisitRequest | null>(null);
  const [editAdvance, setEditAdvance] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editComment, setEditComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdingRequestId, setHoldingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('pending');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showPendingUsersModal, setShowPendingUsersModal] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [token, setToken] = useState<string>(''); // Temporary token for API calls
  const [userFullName, setUserFullName] = useState<string>(''); // User's full name
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(new Set()); // Track users being processed
  

  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const cardAnimations = useRef<{ [key: string]: Animated.Value }>({}).current;
  const sectionAnimations = useRef({
    pending: new Animated.Value(0),
    hold: new Animated.Value(0),
    approved: new Animated.Value(0),
    rejected: new Animated.Value(0)
  }).current;
  
  const router = useRouter();


  // Filter requests based on active filter
  const getFilteredRequests = () => {
    const filterMap: { [key: string]: string } = {
      'pending': 'pending',
      'on_hold': 'on_hold',
      'approved': 'approved',
      'rejected': 'rejected'
    };
    
    const statusToFilter = filterMap[activeFilter];
    if (!statusToFilter) return requests;
    
    return requests.filter(request => {
      if (activeFilter === 'pending') {
        return request.admin_status === 'pending';
      } else if (activeFilter === 'on_hold') {
        return request.admin_status === 'on_hold';
      } else if (activeFilter === 'rejected') {
        return request.admin_status === 'rejected';
      } else if (activeFilter === 'approved') {
        return request.admin_status === 'approved';
      }
      return true;
    });
  };

  const filteredRequests = getFilteredRequests();

  // Toggle card expansion
  const toggleCardExpansion = (requestId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

    // Fetch pending users for admin approval
  const fetchPendingUsers = useCallback(async () => {
    if (!token) {
      return;
    }

    try {

      const response = await fetch(API_ENDPOINTS.ADMIN_PENDING_USERS, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });


      
      if (response.ok) {
        const data = await response.json();

        setPendingUsers(data.pending_users || []);
        setPendingUsersCount(data.count || 0);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch pending users:', errorData);
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
    }
  }, [token]);

  // Fetch requests from API
  const fetchRequests = useCallback(async () => {
    try {
      const response = await fetch('http://192.168.3.251:5000/visit-requests');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
        
        const grouped = groupRequestsByStatus(data);
        setGroupedRequests(grouped);
        
        // Initialize card animations
        Object.keys(cardAnimations).forEach(key => delete cardAnimations[key]);
        data.forEach((request: VisitRequest) => {
          cardAnimations[request._id] = new Animated.Value(0);
        });
        
        // Animate sections and cards
        animateSectionsAndCards(grouped);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle user approval/rejection
  const handleUserApproval = async (email: string, action: 'approve' | 'reject') => {
    try {
      // Set loading state for this user
      setProcessingUsers(prev => new Set(prev).add(email));
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
      });

      const fetchPromise = fetch(API_ENDPOINTS.ADMIN_APPROVE_USER, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          action: action
        }),
      });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

      if (response.ok) {
        const data = await response.json();
        
        // Immediately update local state for better UX
        const updatedPendingUsers = pendingUsers.filter(user => user.email !== email);
        setPendingUsers(updatedPendingUsers);
        setPendingUsersCount(updatedPendingUsers.length);
        
        // Clear loading state
        setProcessingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(email);
          return newSet;
        });
        
        // Show success message immediately
        Alert.alert(
          'Success',
          data.msg || `User ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Refresh pending users list in background (non-blocking)
                setTimeout(() => {
                  fetchPendingUsers();
                }, 100);
              }
            }
          ]
        );
      } else {
        const errorData = await response.json();
        // Clear loading state on error
        setProcessingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(email);
          return newSet;
        });
        Alert.alert('Error', errorData.msg || `Failed to ${action} user`);
      }
    } catch (error) {
      console.error('Error handling user approval:', error);
      // Clear loading state on error
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(email);
        return newSet;
      });
      
      // Handle timeout specifically
      if (error instanceof Error && error.message === 'Request timeout') {
        Alert.alert('Timeout Error', 'The request took too long. Please check your connection and try again.');
      } else {
        Alert.alert('Error', 'Network error. Please try again.');
      }
    }
  };

  // Download feature removed

  useEffect(() => {
    // Load token and user info from AsyncStorage
    const loadUserInfo = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedFullName = await AsyncStorage.getItem('userFullName');
        
        if (storedToken) {
          setToken(storedToken);
        }
        
        if (storedFullName) {
          setUserFullName(storedFullName);
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    };

    loadUserInfo();
    fetchRequests();
    
    // Set up automatic refresh every 3 hours (3 * 60 * 60 * 1000 milliseconds)
    const autoRefreshInterval = setInterval(() => {

      fetchRequests();
      fetchPendingUsers();

    }, 3 * 60 * 60 * 1000); // 3 hours
    

    

    
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
    
    // Cleanup interval on unmount
    return () => clearInterval(autoRefreshInterval);
  }, [fetchRequests, fetchPendingUsers, fadeAnim, slideAnim]);
  
  // Fetch pending users when token is available
  useEffect(() => {
    if (token) {
      fetchPendingUsers();
    }
  }, [token]);



  // Group requests by admin_status and sort by submission date
  const groupRequestsByStatus = (requestsList: VisitRequest[]) => {
    const grouped: GroupedRequests = {
      pending: [],
      hold: [],
      approved: [],
      rejected: []
    };

    requestsList.forEach(request => {
      const managerStatus = request.status || 'pending';
      const adminStatus = request.admin_status || 'pending';
      
      // A request is approved when admin approves it
      if (adminStatus === 'approved') {
        grouped.approved.push(request);
      } else if (adminStatus === 'on_hold') {
        grouped.hold.push(request);
      } else if (adminStatus === 'rejected') {
        // Rejected requests go to rejected section
        grouped.rejected.push(request);
      } else {
        grouped.pending.push(request);
      }
    });

    // Sort each group by submission date (newest first)
    Object.keys(grouped).forEach(key => {
      grouped[key as keyof GroupedRequests].sort((a, b) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
    });

    return grouped;
  };

  const animateSectionsAndCards = (grouped: GroupedRequests) => {
    // Animate sections with staggered timing
    const sectionKeys = ['pending', 'hold', 'approved', 'rejected'] as const;
    
    sectionKeys.forEach((sectionKey, sectionIndex) => {
      const sectionDelay = sectionIndex * 200;
      
      // Animate section
      Animated.timing(sectionAnimations[sectionKey], {
        toValue: 1,
        duration: 600,
        delay: sectionDelay,
        useNativeDriver: true,
      }).start();
      
      // Animate cards in section
      const sectionCards = grouped[sectionKey];
      sectionCards.forEach((card, cardIndex) => {
        const cardDelay = sectionDelay + (cardIndex * 100);
        const cardAnim = cardAnimations[card._id];
        
        if (cardAnim) {
          Animated.spring(cardAnim, {
            toValue: 1,
            tension: 50,
            friction: 8,
            delay: cardDelay,
            useNativeDriver: true,
          }).start();
        }
      });
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const handleAction = async (requestId: string, action: 'approve' | 'hold' | 'reject') => {
    if (action === 'reject') {
      // Show confirmation modal for rejection
      setRejectingRequestId(requestId);
      setShowRejectModal(true);
      return;
    }

    if (action === 'approve') {
      // Show confirmation modal for approval
      setApprovingRequestId(requestId);
      setShowApproveModal(true);
      return;
    }

    if (action === 'hold') {
      // Show confirmation modal for hold
      setHoldingRequestId(requestId);
      setShowHoldModal(true);
      return;
    }

    // For other actions, proceed directly
    await performAction(requestId, action);
  };

  const performAction = async (requestId: string, action: 'approve' | 'hold' | 'reject') => {
    try {
      // Use the new admin action endpoint with confirmation requirements
      const response = await fetch(`http://192.168.3.251:5000/admin-action/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action === 'reject' ? 'rejected' : action === 'approve' ? 'approved' : 'on_hold',
          confirmation: true,
          rejection_reason: action === 'reject' ? rejectionReason : undefined,
          admin_name: userFullName || 'Admin' // Use actual admin name
        })
      });

      if (response.ok) {
        // Update local state immediately
        const updatedRequests = requests.map(req => 
          req._id === requestId 
            ? { ...req, admin_status: action === 'reject' ? 'rejected' : action === 'approve' ? 'approved' : 'on_hold' }
            : req
        );
        
        setRequests(updatedRequests);
        

        
        // Re-group and animate
        const grouped = groupRequestsByStatus(updatedRequests);
        setGroupedRequests(grouped);
        
        // Re-animate with new grouping
        animateSectionsAndCards(grouped);
        
        Alert.alert('Success', `Request ${action}d successfully!`);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to update request');
      }
    } catch (error) {
      console.error('Error updating request:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const confirmRejection = async () => {
    if (rejectingRequestId) {
      await performAction(rejectingRequestId, 'reject');
      setShowRejectModal(false);
      setRejectingRequestId(null);
      setRejectionReason('');
    }
  };

  const cancelRejection = () => {
    setShowRejectModal(false);
    setRejectingRequestId(null);
    setRejectionReason('');
  };

  const confirmApproval = async () => {
    if (approvingRequestId) {
      await performAction(approvingRequestId, 'approve');
      setShowApproveModal(false);
      setApprovingRequestId(null);
    }
  };

  const cancelApproval = () => {
    setShowApproveModal(false);
    setApprovingRequestId(null);
  };

  const confirmHold = async () => {
    if (holdingRequestId) {
      await performAction(holdingRequestId, 'hold');
      setShowHoldModal(false);
      setHoldingRequestId(null);
    }
  };

  const cancelHold = () => {
    setShowHoldModal(false);
    setHoldingRequestId(null);
  };

  const openEditModal = (request: VisitRequest) => {
    setSelectedRequest(request);
    setEditAdvance('');
    setEditDuration('');
    setEditComment('');
    setEditModalVisible(true);
  };

  const handleEdit = async () => {
    if (!selectedRequest) return;
    
    try {
      // Smart edit logic: preserve unchanged fields with original values
      const updatedAdvance = editAdvance.trim() !== '' ? parseFloat(editAdvance) : selectedRequest.advance;
      const updatedDuration = editDuration.trim() !== '' ? parseInt(editDuration) : selectedRequest.duration;
      
      const response = await fetch(`http://192.168.3.251:5000/visit-request/${selectedRequest._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          advance: updatedAdvance,
          duration: updatedDuration,
          adminComment: editComment,
        })
      });

      if (response.ok) {
        // Update local state immediately
        const updatedRequests = requests.map(req => 
          req._id === selectedRequest._id 
            ? { 
                ...req, 
                advance: updatedAdvance,
                duration: updatedDuration
              }
            : req
        );
        
        setRequests(updatedRequests);
        
        // Re-group and animate
        const grouped = groupRequestsByStatus(updatedRequests);
        setGroupedRequests(grouped);
        
        // Re-animate with new grouping
        animateSectionsAndCards(grouped);
        
        setEditModalVisible(false);
        Alert.alert('Success', 'Request updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to update request');
      }
    } catch (error) {
      console.error('Error updating request:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#009c8e';
      case 'rejected': return '#F44336';
      case 'on_hold': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  // Helper function to check if editing is allowed
  const canEditRequest = (request: VisitRequest): boolean => {
    // Can edit requests that are pending admin review or on hold
    return request.admin_status === 'pending' || request.admin_status === 'on_hold';
  };

  // Helper function to check if actions are allowed
  const canTakeAction = (request: VisitRequest): boolean => {
    // Admin can take action on requests that are pending admin review or on hold
    // On hold requests can be approved or rejected
    return request.admin_status === 'pending' || request.admin_status === 'on_hold';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '✅ Approved';
      case 'on_hold': return '⏸️ On Hold';
      case 'rejected': return '❌ Rejected';
      default: return '⏳ Pending';
    }
  };

  const createCardAnimation = (requestId: string) => ({
    opacity: cardAnimations[requestId] || 1,
    transform: [
      {
        scale: cardAnimations[requestId]?.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }) || 1,
      },
      {
        translateY: cardAnimations[requestId]?.interpolate({
          inputRange: [0, 1],
          outputRange: [30, 0],
        }) || 0,
      },
    ],
  });

  const createSectionAnimation = (sectionKey: keyof typeof sectionAnimations) => ({
    opacity: sectionAnimations[sectionKey],
    transform: [
      {
        translateY: sectionAnimations[sectionKey].interpolate({
          inputRange: [0, 1],
          outputRange: [50, 0],
        }),
      },
    ],
  });

  const renderRequestCard = (request: VisitRequest, index: number) => {
    const isExpanded = expandedCards.has(request._id);
    
    return (
      <Animated.View
        key={request._id}
        style={[styles.requestCard, createCardAnimation(request._id)]}
      >
        <TouchableOpacity 
          style={styles.cardTouchable}
          onPress={() => toggleCardExpansion(request._id)}
          activeOpacity={0.7}
        >
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              {/* Default Collapsed View */}
              <View style={styles.collapsedView}>
                <View style={styles.collapsedHeader}>
                  <Text style={styles.employeeName}>{request.employeeName}</Text>
                  <Text style={styles.siteCityText}>{request.siteCity}</Text>
                  <Text style={styles.projectText}>{request.project}</Text>
                  <View style={styles.dualStatusContainer}>
                    <View style={styles.statusIndicatorContainer}>
                      <View style={[
                        styles.statusIndicator,
                        { backgroundColor: getStatusColor(request.status) }
                      ]} />
                      <Text style={styles.statusLabel}>Mgr</Text>
                    </View>
                    <View style={styles.statusIndicatorContainer}>
                      <View style={[
                        styles.statusIndicator,
                        { backgroundColor: getStatusColor(request.admin_status) }
                      ]} />
                      <Text style={styles.statusLabel}>Adm</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Expanded Detailed View */}
              {isExpanded && (
                <Animated.View style={styles.expandedView}>

          {/* Request Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Site/City:</Text>
              <Text style={styles.detailValue}>{request.siteCity}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Project:</Text>
              <Text style={styles.detailValue}>{request.project}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reason:</Text>
              <Text style={styles.detailValue}>{request.reason}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailValue}>{request.duration} days</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Advance:</Text>
              <Text style={styles.detailValue}>₹{request.advance}</Text>
            </View>
            
            {request.dateOfJourney && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date of Journey:</Text>
                <Text style={styles.detailValue}>{request.dateOfJourney}</Text>
              </View>
            )}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Submitted on:</Text>
              <Text style={styles.detailValue}>
                {request.submittedAt ? 
                  (() => {
                    try {
                      // Handle different date formats
                      let date;
                      if (typeof request.submittedAt === 'string') {
                        // Try parsing as ISO string first
                        date = new Date(request.submittedAt);
                        if (isNaN(date.getTime())) {
                          // Try parsing as timestamp
                          const timestamp = Date.parse(request.submittedAt);
                          if (!isNaN(timestamp)) {
                            date = new Date(timestamp);
                          }
                        }
                      } else {
                        date = new Date(request.submittedAt);
                      }
                      
                      if (isNaN(date.getTime())) {
                        return 'Invalid Date';
                      }
                      
                      return date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });
                    } catch (error) {
                      return 'Invalid Date';
                    }
                  })() 
                  : 'No Date'
                }
              </Text>
            </View>
          </View>

          {/* Approval Info */}
          <View style={styles.approvalInfo}>
            {request.approved_by && (
              <View style={styles.approvalRow}>
                <Text style={styles.approvalLabel}>👨‍💼 Manager:</Text>
                <Text style={styles.approvalValue}>{request.approved_by}</Text>
              </View>
            )}
            {request.approved_by_admin && (
              <View style={styles.approvalRow}>
                <Text style={styles.approvalLabel}>🔐 Admin:</Text>
                <Text style={styles.approvalValue}>{request.approved_by_admin}</Text>
              </View>
            )}
          </View>

          {/* Manager Edit Indicator */}
          {request.edited_by_manager && (
            <View style={styles.managerEditInfo}>
              <Text style={styles.managerEditText}>
                ✏️ Request edited by Manager {request.manager_edit_by || 'Manager'}
              </Text>
              {request.manager_edit_timestamp && (
                <Text style={styles.managerEditTimestamp}>
                  Edited on: {new Date(request.manager_edit_timestamp).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              )}
              {request.manager_edit_changes && (
                <View style={styles.changesContainer}>
                  <Text style={styles.changesTitle}>Changes made:</Text>
                  {request.manager_edit_changes.advance && (
                    <Text style={styles.changeText}>
                      Amount: {request.manager_edit_changes.advance.from} → {request.manager_edit_changes.advance.to}
                    </Text>
                  )}
                  {request.manager_edit_changes.duration && (
                    <Text style={styles.changeText}>
                      Duration: {request.manager_edit_changes.duration.from} → {request.manager_edit_changes.duration.to}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

                     {/* Action Buttons - Different buttons based on admin status */}
           {canTakeAction(request) ? (
             <View style={styles.actionsContainer}>
               {request.admin_status === 'pending' ? (
                 // For pending admin review: show all three buttons (Approve, Hold, Reject)
                 <>
                   <Button
                     mode="contained"
                     onPress={() => handleAction(request._id, 'approve')}
                     style={[styles.actionButton, styles.approveButton]}
                     buttonColor="#009c8e"
                     labelStyle={styles.actionButtonLabel}
                   >
                     ✅ Approve
                   </Button>
                   
                   <Button
                     mode="contained"
                     onPress={() => handleAction(request._id, 'hold')}
                     style={[styles.actionButton, styles.holdButton]}
                     buttonColor="#FF9800"
                     labelStyle={styles.actionButtonLabel}
                   >
                     ⏸️ Hold
                   </Button>
                   
                   <Button
                     mode="contained"
                     onPress={() => handleAction(request._id, 'reject')}
                     style={[styles.actionButton, styles.rejectButton]}
                     buttonColor="#F44336"
                     labelStyle={styles.actionButtonLabel}
                   >
                     ❌ Reject
                   </Button>
                 </>
               ) : request.admin_status === 'on_hold' ? (
                 // For on-hold requests: show only Approve and Reject buttons
                 <>
                   <Button
                     mode="contained"
                     onPress={() => handleAction(request._id, 'approve')}
                     style={[styles.actionButton, styles.approveButton]}
                     buttonColor="#009c8e"
                     labelStyle={styles.actionButtonLabel}
                   >
                     ✅ Approve
                   </Button>
                   
                   <Button
                     mode="contained"
                     onPress={() => handleAction(request._id, 'reject')}
                     style={[styles.actionButton, styles.rejectButton]}
                     buttonColor="#F44336"
                     labelStyle={styles.actionButtonLabel}
                   >
                     ❌ Reject
                   </Button>
                 </>
               ) : null}
             </View>
           ) : (
             <View style={styles.statusMessageContainer}>
               <Text style={styles.statusMessage}>
                 {request.admin_status === 'approved' ? '✅ Request approved - no further action needed' :
                  request.admin_status === 'rejected' ? '❌ Request rejected - no further action needed' :
                  'Action already taken'}
               </Text>
             </View>
           )}

          {/* Edit Button - Only visible when request is pending admin approval */}
          {canEditRequest(request) ? (
            <Button
              mode="outlined"
              onPress={() => openEditModal(request)}
              style={styles.editButton}
              textColor="#2196F3"
              labelStyle={styles.editButtonLabel}
            >
              ✏️ Edit Details
            </Button>
          ) : (
            <View style={styles.statusMessageContainer}>
              <Text style={styles.statusMessage}>
                {request.admin_status === 'approved' ? '✅ Request approved - editing disabled' :
                 request.admin_status === 'rejected' ? '❌ Request rejected - editing disabled' :
                 request.admin_status === 'on_hold' ? '⏸️ Request on hold - editing disabled' :
                 'Editing not available'}
              </Text>
            </View>
          )}
                </Animated.View>
              )}
            </Card.Content>
          </Card>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSection = (title: string, requests: VisitRequest[], sectionKey: keyof typeof sectionAnimations, color: string) => {
    if (requests.length === 0) return null;

    return (
      <Animated.View 
        key={sectionKey}
        style={[styles.section, createSectionAnimation(sectionKey)]}
      >
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIndicator, { backgroundColor: color }]} />
          <Title style={styles.sectionTitle}>{title}</Title>
          <Text style={styles.sectionCount}>({requests.length})</Text>
        </View>
        
        {/* Color Legend */}
        <View style={styles.colorLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#009c8e' }]} />
            <Text style={styles.legendText}>Approved</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
            <Text style={styles.legendText}>Rejected</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.legendText}>On Hold</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9E9E9E' }]} />
            <Text style={styles.legendText}>No Action</Text>
          </View>
        </View>
        
        <View style={styles.cardsContainer}>
          {requests.map((request, index) => renderRequestCard(request, index))}
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#F0F8F0', '#E8F5E8', '#F9FFF8']} style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0F8F0" />
        <ActivityIndicator size="large" color="#009c8e" />
        <Text style={styles.loadingText}>Loading requests...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#F0F8F0', '#E8F5E8', '#F9FFF8']}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F0F8F0" />
      
      {/* Enhanced Header */}
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
          colors={['#FF5722', '#E64A19']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            {/* First row: Back button, Heading, Bell icon */}
            <View style={styles.headerRow}>
              <TouchableOpacity 
                onPress={() => router.back()} 
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.headerTitleContainer}>
                <Title style={styles.headerTitle} numberOfLines={1}>Admin Dashboard</Title>
              </View>
              

            </View>
            
            {/* Second row removed: Download feature was removed */}
            
            {/* Third row: User info */}
            <View style={styles.userInfoRow}>
              <View style={styles.userInfo}>
                <View style={styles.welcomeRow}>
                  <Text style={styles.welcomeText}>Welcome, </Text>
                  <Text style={styles.welcomeNameText}>{userFullName || 'Admin'}</Text>
                </View>
              </View>
            </View>
          </View>
           

          </LinearGradient>
        </Animated.View>

      {/* Admin Approval Section */}
      <View style={styles.adminApprovalSection}>
        <View style={styles.adminApprovalHeader}>
          <View style={styles.adminApprovalTextContainer}>
            <Title style={styles.adminApprovalTitle}>Pending User Approvals</Title>
            <Text style={styles.adminApprovalSubtitle}>
              Review and approve new user registrations
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.viewPendingUsersIconButton}
            onPress={() => setShowPendingUsersModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.iconButtonContainer}>
              <Ionicons name="people" size={20} color="#009c8e" />
              {pendingUsersCount > 0 && (
                <View style={styles.pendingUsersBadge}>
                  <Text style={styles.pendingUsersBadgeText}>
                    {pendingUsersCount > 99 ? '99+' : pendingUsersCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pending Users Modal */}
      <Portal>
        <Modal
          visible={showPendingUsersModal}
          onDismiss={() => setShowPendingUsersModal(false)}
          contentContainerStyle={styles.modalContentContainer}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.pendingUsersModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="people" size={28} color="#007a6e" style={styles.modalTitleIcon} />
                <Title style={styles.modalTitle}>Pending User Approvals</Title>
                <Text style={styles.modalSubtitle}>
                  {pendingUsersCount} user{pendingUsersCount !== 1 ? 's' : ''} waiting for approval
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPendingUsersModal(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {pendingUsers.length === 0 ? (
              <View style={styles.noPendingUsers}>
                <Ionicons name="checkmark-circle" size={64} color="#009c8e" style={styles.noPendingUsersIcon} />
                <Text style={styles.noPendingUsersTitle}>All Caught Up!</Text>
                <Text style={styles.noPendingUsersText}>No pending users to approve at the moment.</Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.pendingUsersList}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pendingUsersListContent}
              >
                {pendingUsers.map((user, index) => (
                  <View key={user._id} style={styles.pendingUserCard}>
                    {/* User Avatar and Info */}
                    <View style={styles.pendingUserHeader}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {user.fullName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.pendingUserInfo}>
                        <Text style={styles.pendingUserName}>{user.fullName}</Text>
                        <Text style={styles.pendingUserEmail}>{user.email}</Text>
                      </View>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{user.role.toUpperCase()}</Text>
                      </View>
                    </View>
                    
                    {/* Additional User Details */}
                    <View style={styles.userDetails}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar" size={16} color="#666" />
                        <Text style={styles.detailText}>
                          Registered: {new Date(user.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </Text>
                      </View>
                      {user.otp_verified && (
                        <View style={styles.detailItem}>
                          <Ionicons name="checkmark-circle" size={16} color="#009c8e" />
                          <Text style={styles.detailText}>OTP Verified</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.pendingUserActions}>
                      <TouchableOpacity
                        style={[
                          styles.pendingUserActionButton, 
                          styles.pendingUserApproveButton,
                          processingUsers.has(user.email) && styles.processingButton
                        ]}
                        onPress={() => handleUserApproval(user.email, 'approve')}
                        activeOpacity={0.8}
                        disabled={processingUsers.has(user.email)}
                      >
                        {processingUsers.has(user.email) ? (
                          <ActivityIndicator size="small" color="#fff" style={styles.actionButtonIcon} />
                        ) : (
                          <Ionicons name="checkmark" size={18} color="#fff" style={styles.actionButtonIcon} />
                        )}
                        <Text style={styles.pendingUserApproveButtonText}>
                          {processingUsers.has(user.email) ? 'Processing...' : 'Approve'}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.pendingUserActionButton, 
                          styles.pendingUserRejectButton,
                          processingUsers.has(user.email) && styles.processingButton
                        ]}
                        onPress={() => handleUserApproval(user.email, 'reject')}
                        activeOpacity={0.8}
                        disabled={processingUsers.has(user.email)}
                      >
                        {processingUsers.has(user.email) ? (
                          <ActivityIndicator size="small" color="#fff" style={styles.actionButtonIcon} />
                        ) : (
                          <Ionicons name="close" size={18} color="#fff" style={styles.actionButtonIcon} />
                        )}
                        <Text style={styles.pendingUserRejectButtonText}>
                          {processingUsers.has(user.email) ? 'Processing...' : 'Reject'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Statistics Cards */}
   

      {/* Filter Cards */}
      <View style={styles.filterContainer}>
        

        <TouchableOpacity
          style={[
            styles.filterCard,
            activeFilter === 'pending' && styles.filterCardActive
          ]}
          onPress={() => setActiveFilter('pending')}
        >
          <Text style={[
            styles.filterCardNumber,
            activeFilter === 'pending' && styles.filterCardNumberActive
          ]}>
            {groupedRequests.pending.length}
          </Text>
          <Text style={[
            styles.filterCardLabel,
            activeFilter === 'pending' && styles.filterCardLabelActive
          ]}>
            Pending 
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterCard,
            activeFilter === 'on_hold' && styles.filterCardActive
          ]}
          onPress={() => setActiveFilter('on_hold')}
        >
          <Text style={[
            styles.filterCardNumber,
            activeFilter === 'on_hold' && styles.filterCardNumberActive
          ]}>
            {groupedRequests.hold.length}
          </Text>
          <Text style={[
            styles.filterCardLabel,
            activeFilter === 'on_hold' && styles.filterCardLabelActive
          ]}>
            On Hold
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterCard,
            activeFilter === 'approved' && styles.filterCardActive
          ]}
          onPress={() => setActiveFilter('approved')}
        >
          <Text style={[
            styles.filterCardNumber,
            activeFilter === 'approved' && styles.filterCardNumberActive
          ]}>
            {groupedRequests.approved.length}
          </Text>
          <Text style={[
            styles.filterCardLabel,
            activeFilter === 'approved' && styles.filterCardLabelActive
          ]}>
            Approved 
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterCard,
            activeFilter === 'rejected' && styles.filterCardActive
          ]}
          onPress={() => setActiveFilter('rejected')}
        >
          <Text style={[
            styles.filterCardNumber,
            activeFilter === 'rejected' && styles.filterCardNumberActive
          ]}>
            {groupedRequests.rejected.length}
          </Text>
          <Text style={[
            styles.filterCardLabel,
            activeFilter === 'rejected' && styles.filterCardLabelActive
          ]}>
            Rejected
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests Sections */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#009c8e']} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Filtered Requests Display */}
        {activeFilter === 'total' ? (
          <>
            {/* Pending Section */}
            {renderSection('Pending Requests', groupedRequests.pending, 'pending', '#FF9800')}
            
            {/* Hold Section */}
            {renderSection('On Hold Requests', groupedRequests.hold, 'hold', '#FF9800')}
            
            {/* Approved Section */}
            {renderSection('Approved Requests', groupedRequests.approved, 'approved', '#009c8e')}
            
            {/* Rejected Section */}
            {renderSection('Rejected Requests', groupedRequests.rejected, 'rejected', '#F44336')}
          </>
        ) : (
          // Show filtered requests based on active filter
          (() => {
            const filteredGrouped = {
              pending: activeFilter === 'pending' ? filteredRequests : [],
              hold: activeFilter === 'on_hold' ? filteredRequests : [],
              approved: activeFilter === 'approved' ? filteredRequests : [],
              rejected: activeFilter === 'rejected' ? filteredRequests : []
            };
            
            return (
              <>
                {activeFilter === 'pending' && renderSection('Pending Requests', filteredGrouped.pending, 'pending', '#FF9800')}
                {activeFilter === 'on_hold' && renderSection('On Hold Requests', filteredGrouped.hold, 'hold', '#FF9800')}
                {activeFilter === 'approved' && renderSection('Approved Requests', filteredGrouped.approved, 'approved', '#009c8e')}
                {activeFilter === 'rejected' && renderSection('Rejected Requests', filteredGrouped.rejected, 'rejected', '#F44336')}
              </>
            );
          })()
        )}
        
        {/* Empty State */}
        {requests.length === 0 && (
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <Text style={styles.emptyStateIcon}>📋</Text>
            <Title style={styles.emptyStateTitle}>No Requests Found</Title>
            <Text style={styles.emptyStateText}>
              There are no advance requests to display at the moment.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
        >
          <View style={styles.modal}>
            <Title style={styles.modalTitle}>Edit Request Details</Title>
            
            <TextInput
              label="Advance Amount"
              value={editAdvance}
              onChangeText={setEditAdvance}
              style={styles.modalInput}
              keyboardType="numeric"
              mode="outlined"
              outlineColor="#009c8e"
              activeOutlineColor="#007a6e"
              returnKeyType="next"
              blurOnSubmit={false}
            />
            
            <TextInput
              label="Duration (days)"
              value={editDuration}
              onChangeText={setEditDuration}
              style={styles.modalInput}
              keyboardType="numeric"
              mode="outlined"
              outlineColor="#009c8e"
              activeOutlineColor="#007a6e"
              returnKeyType="next"
              blurOnSubmit={false}
            />
            
            <TextInput
              label="Admin Comment"
              value={editComment}
              onChangeText={setEditComment}
              style={styles.modalInput}
              multiline
              numberOfLines={3}
              mode="outlined"
              outlineColor="#009c8e"
              activeOutlineColor="#007a6e"
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={handleEdit}
            />
            
            <View style={styles.modalActions}>
              <Button 
                mode="outlined" 
                onPress={() => setEditModalVisible(false)}
                style={styles.modalButton}
                textColor="#666"
              >
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={handleEdit}
                style={styles.modalButton}
                buttonColor="#009c8e"
                labelStyle={styles.modalButtonLabel}
              >
                Save Changes
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Rejection Confirmation Modal */}
      <Portal>
        <Modal
          visible={showRejectModal}
          onDismiss={() => setShowRejectModal(false)}
        >
          <View style={styles.rejectModal}>
            <Title style={styles.rejectModalTitle}>Confirm Rejection</Title>
            <Text style={styles.rejectModalMessage}>
              Are you sure you want to reject this request?
            </Text>
            
            <TextInput
              label="Rejection Reason (Optional)"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              style={styles.rejectReasonInput}
              multiline
              numberOfLines={3}
              mode="outlined"
              outlineColor="#F44336"
              activeOutlineColor="#D32F2F"
              placeholder="Please provide a reason for rejection (optional)..."
              onSubmitEditing={confirmRejection}
              returnKeyType="done"
              blurOnSubmit={true}
            />
            
            <View style={styles.rejectModalButtons}>
              <Button
                mode="outlined"
                onPress={cancelRejection}
                style={styles.rejectModalButton}
                textColor="#666"
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={confirmRejection}
                style={[styles.rejectModalButton, styles.rejectConfirmButton]}
                buttonColor="#F44336"
            >
              Yes, Reject
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>

      {/* Approval Confirmation Modal */}
      <Portal>
        <Modal
          visible={showApproveModal}
          onDismiss={() => setShowApproveModal(false)}
        >
          <View style={styles.rejectModal}>
            <Title style={styles.rejectModalTitle}>Confirm Approval</Title>
            <Text style={styles.rejectModalMessage}>
              Are you sure you want to approve this request?
            </Text>
            <View style={styles.rejectModalButtons}>
              <Button
                mode="outlined"
                onPress={cancelApproval}
                style={styles.rejectModalButton}
                textColor="#666"
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={confirmApproval}
                style={[styles.rejectModalButton, { backgroundColor: '#009c8e' }]}
                buttonColor="#009c8e"
              >
                Yes, Approve
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Hold Confirmation Modal */}
      <Portal>
        <Modal
          visible={showHoldModal}
          onDismiss={() => setShowHoldModal(false)}
        >
          <View style={styles.rejectModal}>
            <Title style={styles.rejectModalTitle}>Confirm Hold</Title>
            <Text style={styles.rejectModalMessage}>
              Are you sure you want to put this request on hold?
            </Text>
            <View style={styles.rejectModalButtons}>
              <Button
                mode="outlined"
                onPress={cancelHold}
                style={styles.rejectModalButton}
                textColor="#666"
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={confirmHold}
                style={[styles.rejectModalButton, { backgroundColor: '#FF9800' }]}
                buttonColor="#FF9800"
              >
                Yes, Put on Hold
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingTop: StatusBar.currentHeight || 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  headerGradient: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 20,
    paddingHorizontal: 20,
  },
  userInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 0,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  userInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '400',
  },
  welcomeNameText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  forgotPasswordButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  forgotPasswordButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    flex: 1,
    minHeight: 80,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flex: 1,
    minHeight: 70,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterCardActive: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
    elevation: 8,
  },
  filterCardNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  filterCardNumberActive: {
    color: '#2196F3',
  },
  filterCardLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  filterCardLabelActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  sectionIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007a6e',
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  colorLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  cardsContainer: {
    gap: 16,
  },
  requestCard: {
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    marginBottom: 16,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007a6e',
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusChip: {
    borderWidth: 2,
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 11,
  },
  detailsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    color: '#007a6e',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  approvalInfo: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  approvalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  approvalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007a6e',
  },
  approvalValue: {
    fontSize: 12,
    color: '#007a6e',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  approveButton: {
    backgroundColor: '#009c8e',
  },
  holdButton: {
    backgroundColor: '#FF9800',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  editButton: {
    borderRadius: 12,
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  editButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  modal: {
    backgroundColor: '#fff',
    padding: 24,
    margin: 20,
    borderRadius: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },

  modalInput: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  statusMessageContainer: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
     statusMessage: {
     fontSize: 12,
     color: '#666',
     fontWeight: '500',
     textAlign: 'center',
   },
   autoRefreshIndicator: {
     backgroundColor: 'rgba(255, 255, 255, 0.2)',
     borderRadius: 12,
     paddingHorizontal: 16,
     paddingVertical: 8,
     marginTop: 12,
     alignSelf: 'center',
   },
   autoRefreshText: {
     fontSize: 12,
     color: 'rgba(255, 255, 255, 0.9)',
     fontWeight: '500',
     textAlign: 'center',
   },
   rejectModal: {
     backgroundColor: '#fff',
     padding: 24,
     margin: 20,
     borderRadius: 16,
     elevation: 8,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.2,
     shadowRadius: 8,
   },
   rejectModalTitle: {
     fontSize: 20,
     fontWeight: 'bold',
     marginBottom: 16,
     textAlign: 'center',
     color: '#F44336',
   },
   rejectModalMessage: {
     fontSize: 16,
     marginBottom: 24,
     textAlign: 'center',
     color: '#666',
     lineHeight: 22,
   },
   rejectModalButtons: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     gap: 12,
   },
   rejectModalButton: {
     flex: 1,
     borderRadius: 8,
   },
   rejectConfirmButton: {
     elevation: 4,
   },
   managerEditInfo: {
     backgroundColor: '#E8F5E8',
     borderRadius: 12,
     padding: 12,
     marginTop: 16,
     alignItems: 'center',
   },
   managerEditText: {
     fontSize: 12,
     fontWeight: '600',
     color: '#007a6e',
     textAlign: 'center',
   },
   managerEditTimestamp: {
     fontSize: 10,
     color: '#666',
     marginTop: 4,
   },
   changesContainer: {
     marginTop: 8,
     paddingHorizontal: 10,
     paddingVertical: 8,
     backgroundColor: '#F0F8F0',
     borderRadius: 10,
     borderWidth: 1,
     borderColor: '#007a6e',
   },
   changesTitle: {
     fontSize: 12,
     fontWeight: '600',
     color: '#007a6e',
     marginBottom: 4,
     textAlign: 'center',
   },
   changeText: {
     fontSize: 11,
     color: '#007a6e',
     marginBottom: 2,
   },
   rejectReasonInput: {
     marginBottom: 16,
     backgroundColor: '#fff',
     borderRadius: 12,
   },
   cardTouchable: {
    width: '100%',
  },
  collapsedView: {
    paddingVertical: 8,
  },
  collapsedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  statusIndicatorContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  siteCityText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  projectText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  expandIndicator: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  expandText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  expandedView: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
    marginTop: 8,
  },
  statusChipContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dualStatusContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 2,
  },
  adminApprovalSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 0,
    padding: 12,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  adminApprovalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 4,
    textAlign: 'left',
  },
  adminApprovalSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'left',
    marginBottom: 0,
    lineHeight: 16,
  },
  adminApprovalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminApprovalTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  viewPendingUsersIconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F0F8F0',
    borderWidth: 1,
    borderColor: '#E8F5E8',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconButtonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  pendingUsersBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F44336',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pendingUsersBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  modalContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingUsersModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  modalTitleIcon: {
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  closeButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noPendingUsers: {
    padding: 40,
    alignItems: 'center',
  },
  noPendingUsersIcon: {
    marginBottom: 16,
  },
  noPendingUsersTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 8,
    textAlign: 'center',
  },
  noPendingUsersText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  pendingUsersList: {
    padding: 20,
  },
  pendingUsersListContent: {
    paddingBottom: 20,
  },
  pendingUserCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pendingUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  roleBadge: {
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 'auto',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7B1FA2',
  },
  userDetails: {
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  actionButtonIcon: {
    marginRight: 6,
  },
  pendingUserInfo: {
    marginBottom: 16,
  },
  pendingUserName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 4,
  },
  pendingUserEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pendingUserRole: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 14,
    color: '#666',
  },
  roleValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007a6e',
    textTransform: 'capitalize',
  },
  pendingUserDate: {
    fontSize: 12,
    color: '#999',
  },
  pendingUserActions: {
    flexDirection: 'row',
    gap: 12,
  },
  pendingUserActionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  pendingUserApproveButton: {
    backgroundColor: '#009c8e',
  },
  pendingUserApproveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingUserRejectButton: {
    backgroundColor: '#F44336',
  },
  pendingUserRejectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  processingButton: {
    opacity: 0.7,
    backgroundColor: '#9E9E9E',
  },
});
