import { registerRootComponent } from 'expo';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';

setBackgroundMessageHandler(getMessaging(), async () => {
  // FCM shows tray notification via payload; handler required on Android.
});

registerRootComponent(App);
