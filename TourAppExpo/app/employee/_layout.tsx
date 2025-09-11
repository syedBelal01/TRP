import { Stack } from 'expo-router';

export default function EmployeeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="requests" options={{ headerShown: false }} />
    </Stack>
  );
}
