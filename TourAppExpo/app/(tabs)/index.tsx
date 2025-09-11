import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Title, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  const handleRolePress = (role: string) => {

    if (role === 'employee') {
      
      router.push('/employee/dashboard');
    } else if (role === 'manager') {
      
      router.push('/manager-dashboard');
    } else if (role === 'admin') {
      
      router.push('/admin-dashboard');
    } else if (role === 'accounts') {
      
      router.push('/accounts-dashboard');
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
      bounces={true}
      keyboardShouldPersistTaps="handled"
    >
      <Title style={styles.title}>Welcome Tour-App</Title>
      <Title style={styles.subtitle}>Select your role to continue</Title>
      
      <View style={styles.cardsContainer}>
        <TouchableOpacity onPress={() => handleRolePress('employee')}>
          <Card style={styles.roleCard}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.roleTitle}>👤 Employee</Title>
              <Title style={styles.roleDescription}>
                Submit advance requests and manage your visits
              </Title>
            </Card.Content>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleRolePress('manager')}>
          <Card style={styles.roleCard}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.roleTitle}>👨‍💼 Manager</Title>
              <Title style={styles.roleDescription}>
                Review and approve employee requests
              </Title>
            </Card.Content>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleRolePress('admin')}>
          <Card style={styles.roleCard}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.roleTitle}>🔐 Admin</Title>
              <Title style={styles.roleDescription}>
                Full system access and product management
              </Title>
            </Card.Content>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleRolePress('accounts')}>
          <Card style={styles.roleCard}>
            <Card.Content style={styles.cardContent}>
              <Title style={styles.roleTitle}>💰 Accounts</Title>
              <Title style={styles.roleDescription}>
                View approved requests for financial processing
              </Title>
            </Card.Content>
          </Card>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FFF8',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
    flexGrow: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007a6e',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  cardsContainer: {
    gap: 20,
    marginBottom: 40,
  },
  roleCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    borderLeftWidth: 6,
    borderLeftColor: '#009c8e',
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 12,
    textAlign: 'center',
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
