import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
export default function Layout() {
  return (
    <PaperProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="employee" options={{ headerShown: false }} />
        <Stack.Screen name="manager-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="admin-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="accounts-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="test-screen" options={{ headerShown: false }} />
      </Stack>
    </PaperProvider>
  );
}
