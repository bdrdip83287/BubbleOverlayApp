import React, { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  View,
  Text,
  Button,
  NativeModules,
  ScrollView,
  Alert
} from 'react-native';

const { OverlayModule } = NativeModules;

export default function App() {

  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    console.log(msg);
    setLogs(prev => [...prev, msg]);
  };

  // ===== GLOBAL ERROR HANDLER =====
  useEffect(() => {
    const defaultHandler =
      ErrorUtils.getGlobalHandler &&
      ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error, isFatal) => {
      addLog("💀 GLOBAL ERROR: " + error.message);

      Alert.alert(
        "App Crash",
        error.message
      );

      if (defaultHandler) {
        defaultHandler(error, isFatal);
      }
    });
  }, []);

  // ===== APP START =====
  useEffect(() => {

    addLog("✅ App Started");

    if (!OverlayModule) {
      addLog("❌ OverlayModule NULL");
      return;
    }

    addLog("✅ OverlayModule Loaded");

  }, []);

  // ===== START BUBBLE =====
  const startBubble = async () => {
    try {

      addLog("➡️ Start Request");

      if (!OverlayModule?.startBubble) {
        addLog("❌ startBubble missing");
        return;
      }

      await OverlayModule.startBubble();

      addLog("🟢 Bubble Started");

    } catch (e) {
      addLog("🔥 ERROR: " + e.message);
      Alert.alert("Start Error", e.message);
    }
  };
  
  const requestOverlay = async () => {
  try {
    if (Platform.OS === 'android') {
      addLog("Checking overlay permission");
    }
  } catch (e) {
    addLog(e.message);
  }
};

  // ===== STOP =====
  const stopBubble = async () => {
    try {

      await OverlayModule.stopBubble();

      addLog("🔴 Bubble Stopped");

    } catch (e) {
      addLog("🔥 STOP ERROR: " + e.message);
    }
  };

  return (
    <View style={{ flex: 1, paddingTop: 50 }}>

      <Text style={{
        fontSize: 20,
        textAlign: 'center'
      }}>
        Bubble Debug Panel
      </Text>

      <Button title="Start Bubble" onPress={startBubble}/>
      <Button title="Stop Bubble" onPress={stopBubble}/>

      <ScrollView
        style={{
          marginTop: 20,
          backgroundColor: "#000",
          padding: 10
        }}
      >
        {logs.map((l, i) => (
          <Text key={i} style={{color:"#00ff00"}}>
            {l}
          </Text>
        ))}
      </ScrollView>

    </View>
  );
}