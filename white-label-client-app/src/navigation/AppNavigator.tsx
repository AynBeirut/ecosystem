import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useCart } from '../context/CartContext';
import { RootStackParamList, TabParamList } from '../types';
import { COLORS } from '../theme';
import { CLIENT_CONFIG } from '../config/clientConfig';

import MarketplaceScreen from '../screens/customer/MarketplaceScreen';
import StoreDetailScreen from '../screens/customer/StoreDetailScreen';
import ProductDetailScreen from '../screens/customer/ProductDetailScreen';
import CartScreen from '../screens/customer/CartScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
import OrderTrackingScreen from '../screens/customer/OrderTrackingScreen';
import MyOrdersScreen from '../screens/customer/MyOrdersScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';

const linking = {
  prefixes: ['grabio://', `https://${CLIENT_CONFIG.deepLinkHost}`],
  config: {
    screens: {
      MainTabs: {
        screens: {
          MyOrders: 'track-order',
        },
      },
      OrderTracking: 'order/:orderId',
    },
  },
};

const TAB_HEADER = {
  headerShown: true,
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function CustomerTabs() {
  const { itemCount } = useCart();
  return (
    <Tab.Navigator screenOptions={{ ...TAB_HEADER, tabBarActiveTintColor: COLORS.primary }}>
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ tabBarLabel: 'Shop', tabBarIcon: () => <Text>🏪</Text>, title: CLIENT_CONFIG.appName, headerShown: false }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarLabel: 'Cart',
          tabBarIcon: () => <Text>🛒</Text>,
          title: 'My Cart',
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
        }}
      />
      <Tab.Screen
        name="MyOrders"
        component={MyOrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: () => <Text>📍</Text>, title: 'Track Order' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: () => <Text>👤</Text>, title: 'Profile', headerShown: false }}
      />
    </Tab.Navigator>
  );
}

/** Customer-only white-label navigator — Firebase backend, single store, guest checkout. */
export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={CustomerTabs} />
        <Stack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ headerShown: true }} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: true }} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: true, title: 'Cart' }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: true, title: 'Checkout' }} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ headerShown: true, title: 'Order Status' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
