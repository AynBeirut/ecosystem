// Firebase Cloud Messaging Service Worker
// This file must be named firebase-messaging-sw.js and placed in /public.
// FCM SDK checks for this file by default.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U',
  authDomain: 'market-flow-7b074.firebaseapp.com',
  projectId: 'market-flow-7b074',
  storageBucket: 'market-flow-7b074.appspot.com',
  messagingSenderId: '997465465802',
  appId: '1:997465465802:web:3c6789ea41a9458a98e533',
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in foreground)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Grabio Alert';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
