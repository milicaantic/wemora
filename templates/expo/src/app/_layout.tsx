import { Stack } from 'expo-router';

// Zaglavlje je sakriveno: inače ispisuje ime rute, pa prazan ekran ne bi bio prazan.
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
