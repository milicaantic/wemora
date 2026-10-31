import { Stack } from "expo-router"
import { StyleSheet, View } from "react-native"
import { BottomBar } from "@/shared/layout"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <View style={styles.titleBar}>
        <Text role="heading" style={styles.title}>
          Recepti
        </Text>
      </View>
      <Stack screenOptions={{ headerShown: false }} />
      <BottomBar />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleBar: {
    backgroundColor: colors.sidebarBackground,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.buttonBorder,
  },
  title: {
    color: colors.sidebarText,
    fontSize: fontSizes.sidebarTitle,
    lineHeight: lineHeights.sidebarTitle,
    fontWeight: "600",
  },
})
