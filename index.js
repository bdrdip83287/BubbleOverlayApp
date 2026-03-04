/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// ✅ Global error handler
if (!__DEV__) {
  // Production error handling
  const defaultHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('Global error:', error, 'isFatal:', isFatal);
    
    // You can send error to your server here
    
    defaultHandler(error, isFatal);
  });
}

AppRegistry.registerComponent(appName, () => App);