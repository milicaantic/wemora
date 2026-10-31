import { Link } from "expo-router"
import { View, StyleSheet } from "react-native"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"

const LINKS = [
  { href: "/", label: "Recepti" },
  { href: "/kategorije", label: "Kategorije" },
  { href: "/omiljeni", label: "Omiljeni" },
  { href: "/kupovina", label: "Lista za kupovinu" },
]

export function BottomBar() {
  return (
    <View style={styles.container}>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} style={styles.link}>
          <Text style={styles.linkText}>{link.label}</Text>
        </Link>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.sidebarBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 12,
    gap: 8,
    justifyContent: "space-around",
  },
  link: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
    alignItems: "center",
  },
  linkText: {
    color: colors.sidebarText,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
})
