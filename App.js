import { NativeModules } from 'react-native';

const { OverlayModule } = NativeModules;

OverlayModule.startBubble();   // Start bubble
OverlayModule.stopBubble();    // Stop bubble