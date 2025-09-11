import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Animated, StatusBar, TouchableOpacity, Alert } from 'react-native';
import { Title, Text, Card, Chip, ActivityIndicator, Button, Portal, Modal } from 'react-native-paper';
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
  payment_status?: string;
}

interface GroupedRequests {
  pending: VisitRequest[];
  hold: VisitRequest[];
  approved: VisitRequest[];
  rejected: VisitRequest[];
  paid: VisitRequest[];
}

export default function AccountsDashboard() {
  // User state
  const [userFullName, setUserFullName] = useState<string>('');
  
  // State variables
  const [requests, setRequests] = useState<VisitRequest[]>([]);
  const [groupedRequests, setGroupedRequests] = useState<GroupedRequests>({
    pending: [],
    hold: [],
    approved: [],
    rejected: [],
    paid: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('pending');
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [selectedRequestForPayment, setSelectedRequestForPayment] = useState<VisitRequest | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const cardAnimations = useRef<{ [key: string]: Animated.Value }>({}).current;
  const sectionAnimations = useRef({
    pending: new Animated.Value(0),
    hold: new Animated.Value(0),
    approved: new Animated.Value(0),
    rejected: new Animated.Value(0),
    paid: new Animated.Value(0)
  }).current;
  
  const router = useRouter();

  // Filter requests based on active filter
  const getFilteredRequests = () => {
    const filterMap: { [key: string]: string } = {
      'pending': 'pending',
      'on_hold': 'on_hold',
      'approved': 'approved',
      'rejected': 'rejected',
      'paid': 'paid'
    };
    
    const statusToFilter = filterMap[activeFilter];
    if (!statusToFilter) return requests;
    
    return requests.filter(request => {
      const managerStatus = request.status || 'pending';
      const adminStatus = request.admin_status || 'pending';
      const paymentStatus = request.payment_status || 'pending';
      
      // Admin decision overrides everything for filtering
      if (activeFilter === 'paid') {
        return paymentStatus === 'paid';
      } else if (activeFilter === 'approved') {
        // Show approved if Admin approved OR if Manager approved and Admin hasn't acted yet
        return adminStatus === 'approved' || (managerStatus === 'approved' && adminStatus === 'pending');
      } else if (activeFilter === 'rejected') {
        // Show rejected if Admin rejected OR if Manager rejected and Admin hasn't acted yet
        return adminStatus === 'rejected' || (managerStatus === 'rejected' && adminStatus === 'pending');
      } else if (activeFilter === 'on_hold') {
        // Show on hold if Admin on hold OR if Manager on hold and Admin hasn't acted yet
        return adminStatus === 'on_hold' || (managerStatus === 'on_hold' && adminStatus === 'pending');
      } else if (activeFilter === 'pending') {
        // Show pending only if both Manager and Admin are pending
        return managerStatus === 'pending' && adminStatus === 'pending';
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

  // Mark request as paid
  const handleMarkAsPaid = async (request: VisitRequest) => {
    setSelectedRequestForPayment(request);
    setShowPaidModal(true);
  };

  const confirmMarkAsPaid = async () => {
    if (!selectedRequestForPayment) return;
    
    try {
              const response = await fetch(`http://192.168.3.251:5000/visit-request/${selectedRequestForPayment._id}/mark-paid`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          paid_by: 'Accounts Team'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update local state
        setRequests(prevRequests => 
          prevRequests.map(req => 
            req._id === selectedRequestForPayment._id 
              ? { ...req, payment_status: 'paid' }
              : req
          )
        );
        
        // Refresh grouped requests to properly categorize
        const updatedRequests = requests.map(req => 
          req._id === selectedRequestForPayment._id 
            ? { ...req, payment_status: 'paid' }
            : req
        );
        
        const newGrouped = groupRequestsByStatus(updatedRequests);
        setGroupedRequests(newGrouped);
        
        Alert.alert('Success', 'Request marked as paid successfully!');
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to mark request as paid');
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      Alert.alert('Error', 'Failed to mark request as paid');
    } finally {
      setShowPaidModal(false);
      setSelectedRequestForPayment(null);
    }
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
    return () => clearInterval(autoRefreshInterval);
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

  // Group requests by status and sort by submission date
  const groupRequestsByStatus = (requestsList: VisitRequest[]) => {
    const grouped: GroupedRequests = {
      pending: [],
      hold: [],
      approved: [],
      rejected: [],
      paid: []
    };

    requestsList.forEach(request => {
      const managerStatus = request.status || 'pending';
      const adminStatus = request.admin_status || 'pending';
      const paymentStatus = request.payment_status || 'pending';
      
      // Admin decision overrides everything for filtering
      if (paymentStatus === 'paid') {
        // Marked as paid - highest priority
        grouped.paid.push(request);
      } else if (adminStatus === 'approved') {
        // Admin approved - goes to approved section regardless of manager status
        grouped.approved.push(request);
      } else if (adminStatus === 'rejected') {
        // Admin rejected - goes to rejected section regardless of manager status
        grouped.rejected.push(request);
      } else if (adminStatus === 'on_hold') {
        // Admin on hold - goes to hold section regardless of manager status
        grouped.hold.push(request);
      } else if (managerStatus === 'approved') {
        // Manager approved, waiting for admin approval
        grouped.approved.push(request);
      } else if (managerStatus === 'on_hold') {
        // Manager on hold
        grouped.hold.push(request);
      } else if (managerStatus === 'rejected') {
        // Manager rejected
        grouped.rejected.push(request);
      } else {
        // Pending manager approval
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
  };

  const animateSectionsAndCards = (grouped: GroupedRequests) => {
    // Animate sections with staggered timing
    const sectionKeys = ['pending', 'hold', 'approved', 'rejected', 'paid'] as const;
    
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

  const getStatusColor = (request: VisitRequest) => {
    const managerStatus = request.status || 'pending';
    const adminStatus = request.admin_status || 'pending';
    
    // Admin decision overrides everything
    if (adminStatus === 'approved') {
      return '#009c8e'; // Green for approved
    } else if (adminStatus === 'rejected') {
      return '#F44336'; // Red for rejected
    } else if (adminStatus === 'on_hold') {
      return '#FF9800'; // Orange for on hold
    }
    
    // If Admin hasn't acted yet, show Manager's decision color
    if (managerStatus === 'approved') {
      return '#2196F3'; // Blue for manager approved
    } else if (managerStatus === 'on_hold') {
      return '#FF9800'; // Orange for on hold
    } else if (managerStatus === 'rejected') {
      return '#F44336'; // Red for rejected
    } else {
      return '#9E9E9E'; // Gray for pending
    }
  };

  const getStatusText = (request: VisitRequest) => {
    const managerStatus = request.status || 'pending';
    const adminStatus = request.admin_status || 'pending';
    
    // Admin decision overrides everything
    if (adminStatus === 'approved') {
      return '✅ Approved';
    } else if (adminStatus === 'rejected') {
      return '❌ Rejected';
    } else if (adminStatus === 'on_hold') {
      return '⏸️ On Hold';
    }
    
    // If Admin hasn't acted yet, show Manager's decision
    if (managerStatus === 'approved') {
      return '👨‍💼 Manager Approved';
    } else if (managerStatus === 'on_hold') {
      return '⏸️ On Hold';
    } else if (managerStatus === 'rejected') {
      return '❌ Rejected';
    } else {
      return '⏳ Pending';
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
                        { backgroundColor: getStatusColor(request) }
                      ]} />
                      <Text style={styles.statusDotLabel}>M</Text>
                    </View>
                    <View style={styles.statusIndicatorContainer}>
                      <View style={[
                        styles.statusIndicator,
                        { backgroundColor: getStatusColor(request) }
                      ]} />
                      <Text style={styles.statusDotLabel}>A</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Expanded Detailed View */}
              {isExpanded && (
                <Animated.View style={styles.expandedView}>

          {/* Workflow Status Indicator */}
          <View style={styles.workflowIndicator}>
            <Text style={styles.workflowLabel}>Workflow Status:</Text>
            <Text style={styles.workflowStatus}>
              {request.admin_status === 'approved' 
                ? '✅ Ready for Financial Processing'
                : request.admin_status === 'rejected'
                  ? '❌ Rejected'
                  : request.admin_status === 'on_hold'
                    ? '⏸️ On Hold'
                    : request.status === 'approved' && request.admin_status === 'pending'
                      ? 'Waiting for Admin Approval'
                      : request.status === 'pending' && request.admin_status === 'pending'
                        ? 'Waiting for Manager Approval'
                        : request.status === 'on_hold'
                          ? '⏸️ On Hold'
                          : request.status === 'rejected'
                            ? '❌ Rejected'
                            : '⏳ In Progress'
              }
            </Text>
          </View>

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

          {/* Payment Action */}
          {request.admin_status === 'approved' && (
            <View style={styles.paymentAction}>
              {request.payment_status === 'paid' ? (
                <View style={styles.paidStatus}>
                  <Text style={styles.paidLabel}>✅ Paid</Text>
                  <Text style={styles.paidDate}>
                    {request.payment_status === 'paid' ? 'Marked as paid' : ''}
                  </Text>
                </View>
              ) : (
                <Button
                  mode="contained"
                  onPress={() => handleMarkAsPaid(request)}
                  style={styles.markAsPaidButton}
                  buttonColor="#009c8e"
                  labelStyle={styles.markAsPaidButtonLabel}
                >
                  Mark as Paid
                </Button>
              )}
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
          colors={['#9C27B0', '#7B1FA2']}
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
                <Title style={styles.headerTitle}>Accounts Dashboard</Title>
                <View style={styles.welcomeRow}>
                  <Text style={styles.headerSubtitle}>Welcome, </Text>
                  <Text style={styles.welcomeNameText}>{userFullName || 'Accounts'}</Text>
                </View>
              </View>
              

            </View>
            

          </View>
        </LinearGradient>
      </Animated.View>

      

      {/* Statistics Cards */}
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

        <TouchableOpacity
          style={[
            styles.filterCard,
            activeFilter === 'paid' && styles.filterCardActive
          ]}
          onPress={() => setActiveFilter('paid')}
        >
          <Text style={[
            styles.filterCardNumber,
            activeFilter === 'paid' && styles.filterCardNumberActive
          ]}>
            {groupedRequests.paid.length}
          </Text>
          <Text style={[
            styles.filterCardLabel,
            activeFilter === 'paid' && styles.filterCardLabelActive
          ]}>
            Paid
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
        {/* Show filtered requests based on active filter */}
        {(() => {
          const filteredGrouped = {
            pending: activeFilter === 'pending' ? filteredRequests : [],
            hold: activeFilter === 'on_hold' ? filteredRequests : [],
            approved: activeFilter === 'approved' ? filteredRequests : [],
            rejected: activeFilter === 'rejected' ? filteredRequests : [],
            paid: activeFilter === 'paid' ? filteredRequests : []
          };
          
          return (
            <>
              {activeFilter === 'pending' && renderSection('Pending Manager Approval', filteredGrouped.pending, 'pending', '#FF9800')}
              {activeFilter === 'on_hold' && renderSection('On Hold Requests', filteredGrouped.hold, 'hold', '#FF9800')}
              {activeFilter === 'approved' && renderSection('Approved Requests (Ready for Processing)', filteredGrouped.approved, 'approved', '#009c8e')}
              {activeFilter === 'rejected' && renderSection('Rejected Requests', filteredGrouped.rejected, 'rejected', '#F44336')}
              {activeFilter === 'paid' && renderSection('Paid Requests', filteredGrouped.paid, 'paid', '#009c8e')}
            </>
          );
        })()}
        
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

      {/* Mark as Paid Confirmation Modal */}
      <Portal>
        <Modal
          visible={showPaidModal}
          onDismiss={() => setShowPaidModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Title style={styles.modalTitle}>Confirm Payment</Title>
          <Text style={styles.modalMessage}>
            Are you sure you want to mark this request as paid?
          </Text>
          <Text style={styles.modalDetails}>
            Employee: {selectedRequestForPayment?.employeeName}{'\n'}
            Amount: ₹{selectedRequestForPayment?.advance}{'\n'}
            Project: {selectedRequestForPayment?.project}
          </Text>
          
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowPaidModal(false)}
              style={styles.modalButton}
              textColor="#666"
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmMarkAsPaid}
              style={[styles.modalButton, styles.confirmButton]}
              buttonColor="#009c8e"
            >
              Confirm Payment
            </Button>
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
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  forgotPasswordButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  forgotPasswordButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  headerButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minWidth: 140,
  },
  headerButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  backButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 12,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  welcomeNameText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '700',
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
  workflowIndicator: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
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
  statusBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  miniChip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },


  paymentAction: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  paidStatus: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#009c8e',
  },
  paidLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#009c8e',
    marginBottom: 4,
  },
  paidDate: {
    fontSize: 12,
    color: '#666',
  },
  markAsPaidButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  markAsPaidButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    margin: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
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
  statusDotLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 2,
  },
});
