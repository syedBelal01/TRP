import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Animated, StatusBar, TouchableOpacity } from 'react-native';
import { Title, Text, Card, Button, TextInput, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';
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
  rejected_by?: string;
}

interface GroupedRequests {
  pending: VisitRequest[];
  hold: VisitRequest[];
  approved: VisitRequest[];
  rejected: VisitRequest[];
}

export default function ManagerDashboard() {
  // Manager Dashboard - Shows requests with priority given to admin actions
  // When admin takes action (approve/reject/hold), the request automatically moves
  // to the appropriate section (approved/rejected/hold) regardless of manager's previous action
  // This ensures managers can see the current status of all requests
  
  // User state
  const [userFullName, setUserFullName] = useState<string>('');
  
  // State variables
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
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdingRequestId, setHoldingRequestId] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<string>('pending');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
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

  useEffect(() => {
    fetchRequests();
    
    // Set up automatic refresh every 3 hours (3 * 60 * 60 * 1000 milliseconds)
    const autoRefreshInterval = setInterval(() => {
      fetchRequests();
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
    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, []);

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





  // Normalize status values to ensure consistency
  const normalizeStatus = (status: string | undefined): string => {
    if (!status) return 'pending';
    
    // Normalize common status variations
    const normalized = status.toLowerCase().trim();
    
    // Handle approved variations
    if (normalized === 'approved' || normalized === 'approve' || normalized === 'approval') return 'approved';
    
    // Handle rejected variations
    if (normalized === 'rejected' || normalized === 'reject' || normalized === 'rejection') return 'rejected';
    
    // Handle on_hold variations
    if (normalized === 'on_hold' || normalized === 'hold' || normalized === 'onhold' || normalized === 'held') return 'on_hold';
    
    // Handle pending variations
    if (normalized === 'pending' || normalized === 'waiting' || normalized === 'wait') return 'pending';
    
    return 'pending'; // Default fallback
  };

  // Group requests by status and sort by submission date
  // IMPORTANT: Admin actions take priority over manager actions
  // When admin approves/rejects/puts on hold, the request moves to the appropriate section
  // regardless of the manager's previous action
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
      
      // PRIORITY RULE: Admin actions override manager actions
      // This ensures that when admin takes action, the request appears in the correct section
      if (adminStatus && adminStatus !== 'pending') {
        // Admin has taken action - use admin status (this overrides manager status)
        if (adminStatus === 'approved') {
          grouped.approved.push(request);
        } else if (adminStatus === 'on_hold') {
          grouped.hold.push(request);
        } else if (adminStatus === 'rejected') {
          grouped.rejected.push(request);
        }
      } else if (managerStatus && managerStatus !== 'pending') {
        // Manager has taken action, admin hasn't acted yet
        if (managerStatus === 'approved') {
          grouped.approved.push(request);
        } else if (managerStatus === 'on_hold') {
          grouped.hold.push(request);
        } else if (managerStatus === 'rejected') {
          grouped.rejected.push(request);
        }
      } else {
        // Both manager and admin status are pending
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



  const fetchRequests = async () => {
    try {
      const response = await fetch('http://192.168.3.251:5000/visit-requests');
              if (response.ok) {
          const data = await response.json();
          
          // Normalize status values to ensure consistency
          const normalizedData = data.map((request: VisitRequest) => ({
            ...request,
            status: normalizeStatus(request.status),
            admin_status: normalizeStatus(request.admin_status)
          }));
          
          setRequests(normalizedData);
        
        const grouped = groupRequestsByStatus(normalizedData);
        setGroupedRequests(grouped);
        
        // Initialize card animations
        Object.keys(cardAnimations).forEach(key => delete cardAnimations[key]);
        normalizedData.forEach((request: VisitRequest) => {
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

  // Get truly pending requests (exclude admin-approved ones)
  const getTrulyPendingCount = () => {
    return groupedRequests.pending.filter(req => 
      !req.admin_status || req.admin_status === 'pending'
    ).length;
  };





  const handleAction = async (requestId: string, action: string) => {
    // Show confirmation modal for rejection
    if (action === 'reject') {
      setRejectingRequestId(requestId);
      setShowRejectModal(true);
      return;
    }
    
    // Show confirmation modal for approval
    if (action === 'approve') {
      setApprovingRequestId(requestId);
      setShowApproveModal(true);
      return;
    }
    
    // Show confirmation modal for hold
    if (action === 'hold') {
      setHoldingRequestId(requestId);
      setShowHoldModal(true);
      return;
    }

    // For other actions, proceed directly
    await performAction(requestId, action);
  };

  const performAction = async (requestId: string, action: string) => {
    try {
              const response = await fetch(`http://192.168.3.251:5000/visit-request/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'on_hold',
          approved_by: userFullName || 'Manager' // Use actual manager name
        })
      });

      if (response.ok) {
        // Update local state immediately
        const newStatus = action === 'reject' ? 'rejected' : action === 'approve' ? 'approved' : action === 'hold' ? 'on_hold' : action;
        
        const updatedRequests = requests.map(req => {
          if (req._id === requestId) {
            const updatedReq = { 
              ...req, 
              status: newStatus,
              approved_by: action === 'approve' ? (userFullName || 'Manager') : undefined,
              rejected_by: action === 'reject' ? (userFullName || 'Manager') : undefined
            };
            return updatedReq;
          }
          return req;
        });
        
        setRequests(updatedRequests);
        

        
        // Re-group and animate
        const grouped = groupRequestsByStatus(updatedRequests);
        setGroupedRequests(grouped);
        
        // Re-animate with new grouping
        animateSectionsAndCards(grouped);
        
        Alert.alert('Success', `Request ${action}d successfully!`);
      } else {
        Alert.alert('Error', 'Failed to update request');
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
    }
  };

  const cancelRejection = () => {
    setShowRejectModal(false);
    setRejectingRequestId(null);
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
          approved_by: userFullName || 'Manager' // Use actual manager name
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
      default: 
        return '#9E9E9E';
    }
  };

  // Removed unused function to satisfy linter

  // Removed unused function to satisfy linter

  // Removed unused function to satisfy linter

  // Helper function to check if editing is allowed
  const canEditRequest = (request: VisitRequest): boolean => {
    // Cannot edit if admin has already acted
    if (request.admin_status && request.admin_status !== 'pending') {
      return false;
    }
    
    // Can edit requests that are pending or on hold
    return request.status === 'pending' || request.status === 'on_hold';
  };

  // Helper function to check if actions are allowed
  const canTakeAction = (request: VisitRequest): boolean => {
    // Manager cannot take action if admin has already acted
    if (request.admin_status && request.admin_status !== 'pending') {
      return false;
    }
    
    // Manager can take action on requests that are pending or on hold
    // On hold requests can be approved or rejected
    return request.status === 'pending' || request.status === 'on_hold';
  };

  // Removed unused function to satisfy linter

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
                    } catch {
                      return 'Invalid Date';
                    }
                  })() 
                  : 'No Date'
                }
              </Text>
            </View>
          </View>

          {/* Approval Info */}
          {request.approved_by && (
            <View style={styles.approvalInfo}>
              <View style={styles.approvalRow}>
                <Text style={styles.approvalLabel}>👨‍💼 Approved by:</Text>
                <Text style={styles.approvalValue}>{request.approved_by}</Text>
              </View>
            </View>
          )}


          {/* Workflow Status Indicator */}
          <View style={styles.workflowIndicator}>
            <Text style={styles.workflowLabel}>Workflow:</Text>
            <Text style={styles.workflowStatus}>
              {request.admin_status && request.admin_status !== 'pending' 
                ? '✅ Complete (Admin acted)'
                : request.status === 'approved' 
                  ? 'Waiting for Admin'
                  : request.status === 'pending'
                    ? 'Waiting for Manager'
                    : '⏸️ On Hold by Manager'
              }
            </Text>
          </View>

                     {/* Action Buttons - Different buttons based on request status */}
           {canTakeAction(request) ? (
             <View style={styles.actionsContainer}>
               {request.status === 'pending' ? (
                 // For pending requests: show all three buttons (Approve, Hold, Reject)
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
               ) : request.status === 'on_hold' ? (
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
                 {request.admin_status === 'approved' ? '✅ Admin approved - no further action needed' :
                  request.admin_status === 'rejected' ? '❌ Admin rejected - no further action needed' :
                  request.admin_status === 'on_hold' ? '⏸️ Admin put on hold - no further action needed' :
                  request.status === 'approved' ? '✅ Request approved - no further action needed' :
                  request.status === 'rejected' ? '❌ Request rejected - no further action needed' :
                  'Action already taken'}
               </Text>
             </View>
           )}

          {/* Edit Button - Only visible when request is pending */}
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
                {request.admin_status === 'approved' ? '✅ Admin approved - editing disabled' :
                 request.admin_status === 'rejected' ? '❌ Admin rejected - editing disabled' :
                 request.admin_status === 'on_hold' ? '⏸️ Admin put on hold - editing disabled' :
                 request.status === 'approved' ? '✅ Request approved - editing disabled' :
                 request.status === 'rejected' ? '❌ Request rejected - editing disabled' :
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

    // Count admin vs manager actions
    const adminActions = requests.filter(req => req.admin_status && req.admin_status !== 'pending').length;
    const managerActions = requests.length - adminActions;

    return (
      <Animated.View 
        key={sectionKey}
        style={[styles.section, createSectionAnimation(sectionKey)]}
      >
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIndicator, { backgroundColor: color }]} />
          <Title style={styles.sectionTitle}>{title}</Title>
          <View style={styles.sectionCountContainer}>
            <Text style={styles.sectionCount}>({requests.length})</Text>
            {(adminActions > 0 || managerActions > 0) && (
              <View style={styles.actionBreakdown}>
                {managerActions > 0 && (
                  <Text style={styles.actionBreakdownText}>
                    👨‍💼 {managerActions}
                  </Text>
                )}
                {adminActions > 0 && (
                  <Text style={styles.actionBreakdownText}>
                    🔐 {adminActions}
                  </Text>
                )}
              </View>
            )}
          </View>
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
          colors={['#2196F3', '#1976D2']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            {/* Back Button */}
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* Centered Title */}
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Manager Dashboard</Text>
              <View style={styles.welcomeRow}>
                <Text style={styles.headerSubtitle}>Welcome, </Text>
                <Text style={styles.welcomeNameText}>{userFullName || 'Manager'}</Text>
              </View>
            </View>
            
            {/* Right spacer to balance the back button */}
            <View style={styles.headerRight} />
          </View>
        </LinearGradient>
      </Animated.View>



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
            {getTrulyPendingCount()}
          </Text>
          <Text style={[
            styles.filterCardLabel,
            activeFilter === 'pending' && styles.filterCardLabelActive
          ]}>
            Pending
          </Text>
          {/* Show admin action indicator if any pending requests have admin actions */}
          {groupedRequests.pending.some(req => req.admin_status && req.admin_status !== 'pending') && (
            <View style={styles.adminActionBadge}>
              <Text style={styles.adminActionBadgeText}>🔐</Text>
            </View>
          )}
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
            {/* Pending Section - Only show truly pending requests */}
            {renderSection('Pending Requests', groupedRequests.pending.filter(req => 
              !req.admin_status || req.admin_status === 'pending'
            ), 'pending', '#FF9800')}
            

            
            {/* Hold Section */}
            {renderSection('On Hold Requests', groupedRequests.hold, 'hold', '#FF9800')}
            
            {/* Approved Section */}
            {renderSection('Approved Requests (Manager + Admin)', groupedRequests.approved, 'approved', '#009c8e')}
            
            {/* Rejected Section */}
            {renderSection('Rejected Requests (Manager + Admin)', groupedRequests.rejected, 'rejected', '#F44336')}
          </>
        ) : (
          // Show filtered requests based on active filter
          // IMPORTANT: Use groupedRequests instead of filteredRequests to respect admin actions
          (() => {
            // When filtering, we need to respect the admin actions and show requests in their correct sections
            // This ensures admin-approved requests don't appear in pending when pending filter is active
            if (activeFilter === 'pending') {
              // Only show truly pending requests (no admin action taken)
              const trulyPending = groupedRequests.pending.filter(req => 
                !req.admin_status || req.admin_status === 'pending'
              );
              return renderSection('Pending Requests', trulyPending, 'pending', '#FF9800');
            } else if (activeFilter === 'on_hold') {
              // Show on-hold requests (manager or admin)
              return renderSection('On Hold Requests', groupedRequests.hold, 'hold', '#FF9800');
            } else if (activeFilter === 'approved') {
              // Show approved requests (manager or admin)
              return renderSection('Approved Requests (Manager + Admin)', groupedRequests.approved, 'approved', '#009c8e');
            } else if (activeFilter === 'rejected') {
              // Show rejected requests (manager or admin)
              return renderSection('Rejected Requests (Manager + Admin)', groupedRequests.rejected, 'rejected', '#F44336');
            }
            return null;
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
          contentContainerStyle={styles.modal}
        >
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
        </Modal>
      </Portal>

      {/* Reject Confirmation Modal */}
      <Portal>
        <Modal
          visible={showRejectModal}
          onDismiss={cancelRejection}
          contentContainerStyle={styles.rejectModal}
        >
          <View style={styles.modalHeader}>
            <Ionicons name="warning" size={32} color="#e74c3c" />
            <Text style={styles.rejectModalTitle}>Confirm Rejection</Text>
          </View>
          
          <Text style={styles.modalMessage}>
            Are you sure you want to reject this request?
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={cancelRejection}
            >
              <Text style={styles.cancelButtonText}>No</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.rejectConfirmButton]}
              onPress={confirmRejection}
            >
              <Text style={styles.rejectButtonText}>Yes, Reject</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>

      {/* Approve Confirmation Modal */}
      <Portal>
        <Modal
          visible={showApproveModal}
          onDismiss={cancelApproval}
          contentContainerStyle={styles.rejectModal}
        >
          <View style={styles.modalHeader}>
            <Ionicons name="checkmark-circle" size={32} color="#009c8e" />
            <Text style={styles.rejectModalTitle}>Confirm Approval</Text>
          </View>
          
          <Text style={styles.modalMessage}>
            Are you sure you want to approve this request?
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={cancelApproval}
            >
              <Text style={styles.cancelButtonText}>No</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#009c8e', borderColor: '#007a6e' }]}
              onPress={confirmApproval}
            >
              <Text style={styles.rejectButtonText}>Yes, Approve</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>

      {/* Hold Confirmation Modal */}
      <Portal>
        <Modal
          visible={showHoldModal}
          onDismiss={cancelHold}
          contentContainerStyle={styles.rejectModal}
        >
          <View style={styles.modalHeader}>
            <Ionicons name="pause-circle" size={32} color="#FF9800" />
            <Text style={styles.rejectModalTitle}>Confirm Hold</Text>
          </View>
          
          <Text style={styles.modalMessage}>
            Are you sure you want to put this request on hold?
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={cancelHold}
            >
              <Text style={styles.cancelButtonText}>No</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#FF9800', borderColor: '#E65100' }]}
              onPress={confirmHold}
            >
              <Text style={styles.rejectButtonText}>Yes, Put on Hold</Text>
            </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    alignItems: 'flex-end',
  },
  headerTextContainer: {
    alignItems: 'flex-end',
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
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  headerTitleSingleLine: {
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
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeNameText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  adminActionBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF9800',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  adminActionBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  adminActionNotification: {
    backgroundColor: '#FFF3E0',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF9800',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },
  adminActionNotificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  adminActionNotificationText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
    flex: 1,
  },
  adminActionRefreshButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adminActionRefreshButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  adminActionButtonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  adminActionCleanupButton: {
    backgroundColor: '#E65100',
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
  sectionCountContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  actionBreakdown: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionBreakdownText: {
    fontSize: 11,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007a6e',
    flex: 1,
  },
  statusChip: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 8,
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
  adminStatusInfo: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 16,
  },
  adminStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminStatusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007a6e',
  },
  adminStatusChip: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  adminApprovalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  adminApprovalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007a6e',
  },
  adminApprovalValue: {
    fontSize: 12,
    color: '#007a6e',
    fontWeight: '500',
  },
  workflowIndicator: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  workflowLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  workflowStatus: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
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
  modalTitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#007a6e',
    fontSize: 20,
    fontWeight: 'bold',
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
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
    color: '#007a6e',
  },

  rejectModal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  rejectModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495e',
    marginTop: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#34495e',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
  },
  cancelButton: {
    backgroundColor: '#ecf0f1',
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },

  cancelButtonText: {
    color: '#34495e',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectConfirmButton: {
    backgroundColor: '#e74c3c',
    borderWidth: 1,
    borderColor: '#c0392b',
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    elevation: 4,
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
  adminActionIndicator: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  adminActionText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },
});
