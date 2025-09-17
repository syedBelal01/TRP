import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Title, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function TestScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Title style={styles.title}>🧪 Test Screen</Title>
      <Title style={styles.subtitle}>Navigation is working!</Title>
      
      <Button 
        mode="contained" 
        onPress={() => router.replace('/')}
        style={styles.button}
        buttonColor="#009c8e"
      >
        Go Back to Home
      </Button>
      
      <Button 
        mode="outlined" 
        onPress={() => router.push('/manager-dashboard')}
        style={styles.button}
      >
        Go to Manager Dashboard
      </Button>
      
      <Button 
        mode="outlined" 
        onPress={() => router.push('/admin-dashboard')}
        style={styles.button}
      >
        Go to Admin Dashboard
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FFF8',
    padding: 20,
    paddingTop: 100,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007a6e',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    marginBottom: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
    minWidth: 200,
  },
});
