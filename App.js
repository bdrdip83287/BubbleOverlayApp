import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  NativeModules,
  ScrollView
} from 'react-native';

const { OverlayModule } = NativeModules;

export default function App() {

  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    console.log(msg);
    setLogs(prev => [...prev, msg]);
  };

  // ========= APP START =========
  useEffect(() => {
    try {
      addLog("✅ App Started");

      if (!OverlayModule) {
        addLog("❌ OverlayModule NOT FOUND");
      } else {
        addLog("✅ OverlayModule Loaded");
      }

    } catch (e) {
      addLog("🔥 INIT ERROR: " + e.message);
    }
  }, []);

  // ========= START BUBBLE =========
  const startBubble = () => {
    try {
      if (!OverlayModule?.startBubble) {
        addLog("❌ startBubble method missing");
        return;
      }

      OverlayModule.startBubble();
      addLog("🟢 Bubble Started");

    } catch (e) {
      addLog("🔥 startBubble ERROR: " + e.message);
    }
  };

  // ========= STOP BUBBLE =========
  const stopBubble = () => {
    try {
      if (!OverlayModule?.stopBubble) {
        addLog("❌ stopBubble method missing");
        return;
      }

      OverlayModule.stopBubble();
      addLog("🔴 Bubble Stopped");

    } catch (e) {
      addLog("🔥 stopBubble ERROR: " + e.message);
    }
  };

  // ========= GLOBAL ERROR CATCH =========
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    addLog(
      `💀 GLOBAL ERROR: ${error.message} | Fatal: ${isFatal}`
    );
  });

  return (
    <View style={{ flex: 1, paddingTop: 50 }}>

      <Text style={{
        fontSize: 20,
        textAlign: 'center',
        marginBottom: 10
      }}>
        Bubble Overlay Debug Panel
      </Text>

      <Button title="Start Bubble" onPress={startBubble} />
      <Button title="Stop Bubble" onPress={stopBubble} />

      <ScrollView
        style={{
          marginTop: 20,
          backgroundColor: "#000",
          padding: 10
        }}
      >
        {logs.map((l, i) => (
          <Text key={i} style={{ color: "#00ff00" }}>
            {l}
          </Text>
        ))}
      </ScrollView>

    </View>
  );
}