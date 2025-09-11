import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar, useColorScheme } from 'react-native';
import { Title, Text, Button, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PrenitworldLogo from '../components/PrenitworldLogo';

export default function Index() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const gradientColors = isDark ? ['#0b1f1d', '#0f2b27', '#0b1f1d'] : ['#F0F8F0', '#E8F5E8', '#F9FFF8'];

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.container}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#0b1f1d' : '#F0F8F0'} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.appName, { color: isDark ? '#FFFFFF' : '#007a6e' }]}>TRP</Text>
          <Text style={[styles.appTagline, { color: isDark ? '#e0dede' : '#666' }]}>Travel Requisition Portal</Text>
        </View>

        {/* Action Cards */}
        <View style={styles.cardsContainer}>
          <Card style={styles.actionCard} onPress={() => router.push('/login')}>
            <Card.Content style={styles.cardContent}>
              <Ionicons name="log-in" size={36} color="#009c8e" style={styles.cardIcon} />
              <Title style={[styles.cardTitle, { color: isDark ? '#e0dede' : '#007a6e' }]}>Login</Title>
              <Text style={[styles.cardSubtitle, { color: isDark ? '#cfcfcf' : '#666' }]}>Access your dashboard</Text>
            </Card.Content>
          </Card>

          <Card style={styles.actionCard} onPress={() => router.push('/register')}>
            <Card.Content style={styles.cardContent}>
              <Ionicons name="person-add" size={36} color="#009c8e" style={styles.cardIcon} />
              <Title style={[styles.cardTitle, { color: isDark ? '#e0dede' : '#007a6e' }]}>Register</Title>
              <Text style={[styles.cardSubtitle, { color: isDark ? '#cfcfcf' : '#666' }]}>Create a new account</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Info Section */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={[styles.infoTitle, { color: isDark ? '#e0dede' : '#007a6e' }]}>How it works</Title>
            <View style={styles.infoItem}>
              <Ionicons name="person-add" size={20} color="#009c8e" />
              <Text style={[styles.infoText, { color: isDark ? '#d9d9d9' : '#333' }]}>Register with your email and role</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={20} color="#009c8e" />
              <Text style={[styles.infoText, { color: isDark ? '#d9d9d9' : '#333' }]}>Verify your email with OTP</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time" size={20} color="#009c8e" />
              <Text style={[styles.infoText, { color: isDark ? '#d9d9d9' : '#333' }]}>Wait for admin approval</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="log-in" size={20} color="#009c8e" />
              <Text style={[styles.infoText, { color: isDark ? '#d9d9d9' : '#333' }]}>Login and access your dashboard</Text>
            </View>
          </Card.Content>
        </Card>
        {/* Bottom Logo */}
        <View style={styles.bottomLogoContainer}>
          <PrenitworldLogo size="medium" showTagline={false} />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#007a6e',
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: 'center',
  },
  appTagline: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardContent: {
    alignItems: 'center',
    padding: 16,
  },
  cardIcon: {
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  infoCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  bottomLogoContainer: {
    marginTop: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
});
