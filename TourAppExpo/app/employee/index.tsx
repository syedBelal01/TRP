import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Title, Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function EmployeeEntryScreen() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to employee dashboard
    const timer = setTimeout(() => {
      router.replace('/employee/dashboard');
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Title style={styles.title}>Employee Portal</Title>
      <Text style={styles.subtitle}>Redirecting to dashboard...</Text>
      <ActivityIndicator size="large" color="#009c8e" style={styles.loader} />
      <Text style={styles.message}>
        You will be automatically redirected to the employee dashboard.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5fdf6',
    padding: 24,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '700',
    color: '#2e4d34',
  },
  subtitle: {
    marginBottom: 24,
    textAlign: 'center',
    fontSize: 18,
    color: '#4a6741',
  },
  loader: {
    marginBottom: 24,
  },
  message: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    maxWidth: 300,
  },
});
