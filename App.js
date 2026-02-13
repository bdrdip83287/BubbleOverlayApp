import React from "react";
import { Text, View, StyleSheet } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚀 Hello Dip sarkar !</Text>
      <Text style={styles.subtitle}>Running  Acode 🎉</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a192f",
  },
  title: {
    fontSize: 22,
    color: "#64ffda",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#ccd6f6",
  },
});

