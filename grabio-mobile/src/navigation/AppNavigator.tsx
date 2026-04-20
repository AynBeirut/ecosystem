import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { RootStackParamList, TabParamList } from '../types';

// Screens
import LoginScreen from '../screens/customer/LoginScreen';
import MarketplaceScreen from '../screens/customer/MarketplaceScreen';
import StoreDetailScreen from '../screens/customer/StoreDetailScreen';
import ProductDetailScreen from '../screens/customer/ProductDetailScreen';
import CartScreen from '../screens/customer/CartScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
import OrderTrackingScreen from '../screens/customer/OrderTrackingScreen';
import MyOrdersScreen from '../screens/customer/MyOrdersScreen';
import FavoritesScreen from '../screens/customer/FavoritesScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import OwnerDashboardScreen from '../screens/owner/OwnerDashboardScreen';
import OwnerOrdersScreen from '../screens/owner/OwnerOrdersScreen';
import OwnerProductsScreen from '../screens/owner/OwnerProductsScreen';
import AddEditProductScreen from '../screens/owner/AddEditProductScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function CustomerTabs() {
  const { itemCount } = useCart();
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ tabBarLabel: 'Shop', tabBarIcon: () => <Text>🏪</Text> }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ tabBarLabel: 'Favorites', tabBarIcon: () => <Text>❤️</Text> }}
      />
      <Tab.Screen
        name="MyOrders"
        component={MyOrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: () => <Text>📦</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: () => <Text>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

function OwnerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Marketplace"
        component={OwnerDashboardScreen}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: () => <Text>📊</Text> }}
      />
      <Tab.Screen
        name="OwnerTab"
        component={OwnerOrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: () => <Text>🛒</Text> }}
      />
      <Tab.Screen
        name="Favorites"
        component={OwnerProductsScreen}
        options={{ tabBarLabel: 'Products', tabBarIcon: () => <Text>📋</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: () => <Text>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={user.isStoreOwner ? OwnerTabs : CustomerTabs} />
            <Stack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ headerShown: true }} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: true }} />
            <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: true, title: 'Cart' }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: true, title: 'Checkout' }} />
            <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ headerShown: true, title: 'Order Status' }} />
            <Stack.Screen name="OwnerOrders" component={OwnerOrdersScreen} options={{ headerShown: true, title: 'Orders' }} />
            <Stack.Screen name="OwnerProducts" component={OwnerProductsScreen} options={{ headerShown: true, title: 'Products' }} />
            <Stack.Screen name="AddEditProduct" component={AddEditProductScreen} options={{ headerShown: true, title: 'Product' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
