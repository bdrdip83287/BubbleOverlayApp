import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';

export default function App() {

  const startBubble = () => {
    console.log("Bubble Start Clicked");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Bubble Overlay App Running ✅
      </Text>

      <Button
        title="Start Bubble"
        onPress={startBubble}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  text: {
    fontSize: 18,
    marginBottom: 20
  }
});