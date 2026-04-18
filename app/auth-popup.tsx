import React from "react";
import { View, Text, StyleSheet } from "react-native";

// OAuth popup not used with custom JWT auth
export default function AuthPopupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Autenticação não disponível</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  text: {
    fontSize: 16,
    color: "#fff",
  },
});
