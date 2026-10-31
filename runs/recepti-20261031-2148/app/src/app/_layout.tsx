import { Stack } from "expo-router"
import { View } from "react-native"
import { BottomBar } from "@/shared/layout"

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <BottomBar />
    </View>
  )
}
