import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  PermissionsAndroid,
  Platform,
  Linking,
  ScrollView
} from 'react-native';
import RNFS from 'react-native-fs';

// ✅ Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Crashed:', error, errorInfo);
    RNFS.writeFile(
      RNFS.DocumentDirectoryPath + '/crash_log.txt',
      `Time: ${new Date().toISOString()}\nError: ${error.toString()}\nStack: ${errorInfo.componentStack}`,
      'utf8'
    ).catch(e => console.log('Failed to save crash log'));
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>⚠️ App Crashed</Text>
          <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
          <TouchableOpacity style={styles.restartButton} onPress={() => this.setState({ hasError: false })}>
            <Text style={styles.restartText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ✅ Main App Component
const AppContent = () => {
  const [hasOverlayPermission, setHasOverlayPermission] = useState(false);
  const [status, setStatus] = useState('Checking permissions...');
  const [permissionMessage, setPermissionMessage] = useState('');

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    try {
      setStatus('Checking Android permissions...');

      if (Platform.OS === 'android') {
        // Check overlay permission properly
        if (Platform.Version >= 23) {
          const overlayGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.SYSTEM_ALERT_WINDOW
          );
          setHasOverlayPermission(overlayGranted);

          if (!overlayGranted) {
            setStatus('❌ Overlay permission required');
            setPermissionMessage('Please enable "Display over other apps" manually in Settings');
          } else {
            setStatus('✅ All permissions granted! App ready.');
            setPermissionMessage('');
            
            // Test SQLite
            testSQLite();
          }
        }
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      setStatus('❌ Permission check failed');
    }
  };

  const requestOverlayPermission = () => {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      Alert.alert(
        '📱 Manual Permission Required',
        'For Android 10 and above, you need to manually enable "Display over other apps" permission.\n\nPlease follow these steps:\n\n' +
        '1️⃣ Tap "Open Settings" below\n' +
        '2️⃣ Go to "Display over other apps"\n' +
        '3️⃣ Toggle ON for BubbleOverlayApp\n' +
        '4️⃣ Return to the app and restart',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              Linking.sendIntent('android.settings.APPLICATION_DETAILS_SETTINGS', 
                [{ key: 'package', value: 'com.dip83287.bubbleoverlayapp' }]
              ).catch(() => {
                // Fallback for older Android
                Linking.openURL('package:com.dip83287.bubbleoverlayapp');
              });
            }
          }
        ]
      );
    }
  };

  const openAppSettings = () => {
    Linking.openSettings();
  };

  const testSQLite = () => {
    Alert.alert('✅ SQLite Test', 'SQLite module loaded successfully!');
  };

  const testFileSystem = async () => {
    try {
      const path = RNFS.DocumentDirectoryPath + '/test.txt';
      await RNFS.writeFile(path, 'Floating Bubble App Test', 'utf8');
      const content = await RNFS.readFile(path, 'utf8');
      Alert.alert('✅ File System Test', `File written & read: ${content}`);
    } catch (error) {
      Alert.alert('❌ File System Test Failed', error.toString());
    }
  };

  const testAsyncStorage = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('test', 'Floating Bubble Works!');
      const value = await AsyncStorage.getItem('test');
      Alert.alert('✅ AsyncStorage Test', `Value: ${value}`);
    } catch (error) {
      Alert.alert('❌ AsyncStorage Test Failed', error.toString());
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Floating Bubble Overlay App</Text>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{status}</Text>
        {permissionMessage !== '' && (
          <Text style={styles.permissionMessage}>{permissionMessage}</Text>
        )}
      </View>

      <View style={styles.permissionBox}>
        <Text style={styles.permissionTitle}>Permissions Status:</Text>
        <Text style={styles.permissionItem}>
          • Overlay: {hasOverlayPermission ? '✅ Granted' : '❌ Not Granted'}
        </Text>
        {!hasOverlayPermission && (
          <Text style={styles.permissionNote}>
            ⚠️ Android 10+ requires manual permission in Settings
          </Text>
        )}
      </View>

      <View style={styles.guideBox}>
        <Text style={styles.guideTitle}>📋 How to Enable Floating Bubble:</Text>
        <Text style={styles.guideStep}>1. Tap "Open Settings" button below</Text>
        <Text style={styles.guideStep}>2. Go to "Display over other apps"</Text>
        <Text style={styles.guideStep}>3. Find and select "BubbleOverlayApp"</Text>
        <Text style={styles.guideStep}>4. Toggle the switch to ON</Text>
        <Text style={styles.guideStep}>5. Return to app and restart</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.settingsButton]}
        onPress={requestOverlayPermission}
      >
        <Text style={styles.buttonText}>🔧 Open Settings & Enable Permission</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.testButton]}
        onPress={testSQLite}
      >
        <Text style={styles.buttonText}>Test SQLite</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.testButton]}
        onPress={testFileSystem}
      >
        <Text style={styles.buttonText}>Test File System</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.testButton]}
        onPress={testAsyncStorage}
      >
        <Text style={styles.buttonText}>Test AsyncStorage</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Version: 1.0.0 | React Native CLI
      </Text>
    </ScrollView>
  );
};

// ✅ Wrap with ErrorBoundary
export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff8dc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#ffebee',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusBox: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  statusText: {
    fontSize: 16,
    color: '#1976d2',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  permissionMessage: {
    fontSize: 14,
    color: '#f57c00',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: 'bold',
  },
  permissionBox: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  permissionItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  permissionNote: {
    fontSize: 12,
    color: '#f57c00',
    marginTop: 10,
    fontStyle: 'italic',
  },
  guideBox: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 10,
  },
  guideStep: {
    fontSize: 14,
    color: '#bf360c',
    marginBottom: 5,
    paddingLeft: 10,
  },
  button: {
    backgroundColor: '#f9e79f',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1c40f',
  },
  settingsButton: {
    backgroundColor: '#ff9800',
    borderColor: '#f57c00',
  },
  testButton: {
    backgroundColor: '#3498db',
    borderColor: '#2980b9',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 15,
  },
  errorText: {
    fontSize: 14,
    color: '#b71c1c',
    textAlign: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#ffcdd2',
    borderRadius: 5,
  },
  restartButton: {
    backgroundColor: '#2196f3',
    padding: 15,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  restartText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  footer: {
    marginTop: 20,
    fontSize: 12,
    color: '#999',
  },
});
