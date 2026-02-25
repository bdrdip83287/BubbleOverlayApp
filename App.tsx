import React from 'react';
import { View, Text, Button, NativeModules, StyleSheet } from 'react-native';

const { OverlayModule } = NativeModules;

export default function App() {

  const startBubble = () => {
    OverlayModule.startBubble();
  };

  const stopBubble = () => {
    OverlayModule.stopBubble();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bubble Overlay App</Text>
      <Button title="Start Bubble" onPress={startBubble} />
      <View style={{ height: 20 }} />
      <Button title="Stop Bubble" onPress={stopBubble} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
  },
});
