import { Stack } from "expo-router"
import { View } from "react-native"
import { BottomBar } from "@/shared/layout"
import { colors } from "@/shared/theme"

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack screenOptions={{ headerShown: false }} />
      <BottomBar />
    </View>
  )
}
