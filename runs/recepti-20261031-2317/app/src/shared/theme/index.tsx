import { Platform, StyleSheet, Text as RNText, type TextProps } from "react-native"

export const fonts = {
  body: Platform.select({ web: '"Segoe UI", Arial, sans-serif', default: undefined }),
}

export const fontSizes = {
  body: 14,
  sidebarTitle: 26,
  pageTitle: 24,
}

export const fontWeights = {
  body: "400",
  active: "600",
} as const

export const lineHeights = {
  body: 20,
  sidebarTitle: 31,
  pageTitle: 29,
}

export const colors = {
  text: "#1f2933",
  background: "#f5f2ec",
  link: "#8a3b12",
  sidebarBackground: "#3d2b1f",
  sidebarText: "#f5f2ec",
  sidebarHover: "#5a4130",
  sidebarActive: "#c8622a",
  buttonBorder: "#c9b8a3",
  buttonBackground: "#fff",
  statusMessage: "#52606d",
  statusError: "#b42318",
}

export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[styles.body, style]} />
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fonts.body,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
})
