import React, { useEffect } from 'react';
import { View, Text, Button, NativeModules } from 'react-native';

const { OverlayModule } = NativeModules;

export default function App() {

  useEffect(() => {
    console.log("App Started");
  }, []);

  const startBubble = () => {
    if (OverlayModule?.startBubble) {
      OverlayModule.startBubble();
    }
  };

  const stopBubble = () => {
    if (OverlayModule?.stopBubble) {
      OverlayModule.stopBubble();
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <Text>Bubble Overlay App</Text>

      <Button title="Start Bubble" onPress={startBubble} />

      <Button title="Stop Bubble" onPress={stopBubble} />
    </View>
  );
}