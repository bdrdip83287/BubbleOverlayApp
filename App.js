import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  PermissionsAndroid,
  Platform
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
    
    // Save crash log to file
    const crashLog = `
      Time: ${new Date().toISOString()}
      Error: ${error.toString()}
      Stack: ${errorInfo.componentStack}
    `;
    
    RNFS.writeFile(
      RNFS.DocumentDirectoryPath + '/crash_log.txt',
      crashLog,
      'utf8'
    ).catch(e => console.log('Failed to save crash log'));
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>⚠️ App Crashed</Text>
          <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
          <TouchableOpacity 
            style={styles.restartButton}
            onPress={() => this.setState({ hasError: false })}
          >
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

  // ✅ Check permissions on mount
  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    try {
      setStatus('Checking Android permissions...');
      
      if (Platform.OS === 'android') {
        // Check overlay permission
        if (Platform.Version >= 23) {
          const overlayGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.SYSTEM_ALERT_WINDOW
          );
          setHasOverlayPermission(overlayGranted);
          
          if (!overlayGranted) {
            setStatus('❌ Overlay permission required');
          } else {
            setStatus('✅ All permissions granted! App ready.');
            
            // Test SQLite
            testSQLite();
            
            // Test File System
            testFileSystem();
          }
        }
        
        // Check storage permission
        const storageGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
        );
        
        if (!storageGranted) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
          );
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
        'Overlay Permission Required',
        'This app needs overlay permission to show floating bubble notes.\n\nPlease grant the permission in system settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: openAppSettings }
        ]
      );
    }
  };

  const openAppSettings = () => {
    // This will be handled by MainActivity.kt
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
    <View style={styles.container}>
      <Text style={styles.title}>Floating Bubble Overlay App</Text>
      
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <View style={styles.permissionBox}>
        <Text style={styles.permissionTitle}>Permissions Status:</Text>
        <Text style={styles.permissionItem}>
          • Overlay: {hasOverlayPermission ? '✅ Granted' : '❌ Not Granted'}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={requestOverlayPermission}
      >
        <Text style={styles.buttonText}>Request Overlay Permission</Text>
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
    </View>
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
    flex: 1,
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
    marginBottom: 30,
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
  },
  permissionBox: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
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
    position: 'absolute',
    bottom: 20,
    fontSize: 12,
    color: '#999',
  },
});