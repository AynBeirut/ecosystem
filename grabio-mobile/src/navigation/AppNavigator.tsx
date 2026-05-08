import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { RootStackParamList, TabParamList } from '../types';
import { COLORS } from '../theme';

const linking = {
  prefixes: ['grabio://', 'https://grabio.space'],
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

// Screens
import LoginScreen from '../screens/customer/LoginScreen';
import MarketplaceScreen from '../screens/customer/MarketplaceScreen';
import StoreDetailScreen from '../screens/customer/StoreDetailScreen';
import ProductDetailScreen from '../screens/customer/ProductDetailScreen';
import CartScreen from '../screens/customer/CartScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
import OrderTrackingScreen from '../screens/customer/OrderTrackingScreen';
import MyOrdersScreen from '../screens/customer/MyOrdersScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import FavoritesScreen from '../screens/customer/FavoritesScreen';
import OwnerDashboardScreen from '../screens/owner/OwnerDashboardScreen';
import OwnerOrdersScreen from '../screens/owner/OwnerOrdersScreen';
import OwnerProductsScreen from '../screens/owner/OwnerProductsScreen';
import AddEditProductScreen from '../screens/owner/AddEditProductScreen';
import InventoryScreen from '../screens/owner/InventoryScreen';
import ExpensesScreen from '../screens/owner/ExpensesScreen';
import CreateOrderScreen from '../screens/owner/CreateOrderScreen';
import CustomersScreen from '../screens/owner/CustomersScreen';
import PurchasesScreen from '../screens/owner/PurchasesScreen';
import SuppliersScreen from '../screens/owner/SuppliersScreen';
import AccountStatementScreen from '../screens/owner/AccountStatementScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function CustomerTabs() {
  const { itemCount } = useCart();
  return (
    <Tab.Navigator screenOptions={{ ...TAB_HEADER, tabBarActiveTintColor: COLORS.primary }}>
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: () => <Text>🏪</Text>, title: 'Home', headerShown: false }}
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
        options={{ tabBarLabel: 'Track Order', tabBarIcon: () => <Text>📍</Text>, title: 'Track Order' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: () => <Text>👤</Text>, title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function OwnerTabs() {
  return (
    <Tab.Navigator screenOptions={{ ...TAB_HEADER, tabBarActiveTintColor: COLORS.primary }}>
      <Tab.Screen
        name="OwnerHome"
        component={MarketplaceScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: () => <Text>🏪</Text>, title: 'Marketplace', headerShown: false }}
      />
      <Tab.Screen
        name="OwnerTab"
        component={OwnerOrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: () => <Text>📋</Text>, title: 'Orders' }}
      />
      <Tab.Screen
        name="OwnerCustomers"
        component={CustomersScreen}
        options={{ tabBarLabel: 'Customers', tabBarIcon: () => <Text>👥</Text>, title: 'Customers' }}
      />
      <Tab.Screen
        name="OwnerDashboard"
        component={OwnerDashboardScreen}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: () => <Text>📊</Text>, title: 'Dashboard' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading, isGuest } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user && !isGuest ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={user && ['owner', 'sub_seller', 'sub_manager', 'sub_delivery'].includes(user.userRole) ? OwnerTabs : CustomerTabs}
            />
            <Stack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ headerShown: true }} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: true }} />
            <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: true, title: 'Cart' }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: true, title: 'Checkout' }} />
            <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ headerShown: true, title: 'Order Status' }} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ headerShown: true, title: 'My Favorites' }} />
            <Stack.Screen name="OwnerOrders" component={OwnerOrdersScreen} options={{ headerShown: true, title: 'Orders' }} />
            <Stack.Screen name="OwnerProducts" component={OwnerProductsScreen} options={{ headerShown: true, title: 'Products' }} />
            <Stack.Screen name="AddEditProduct" component={AddEditProductScreen} options={{ headerShown: true, title: 'Product' }} />
            <Stack.Screen name="Inventory" component={InventoryScreen} options={{ headerShown: true, title: 'Inventory' }} />
            <Stack.Screen name="Expenses" component={ExpensesScreen} options={{ headerShown: true, title: 'Expenses' }} />
            <Stack.Screen name="CreateOrder" component={CreateOrderScreen} options={{ headerShown: true, title: 'Create Order' }} />
            <Stack.Screen name="Customers" component={CustomersScreen} options={{ headerShown: true, title: 'Customers' }} />
            <Stack.Screen name="Purchases" component={PurchasesScreen} options={{ headerShown: true, title: 'Purchases' }} />
            <Stack.Screen name="Suppliers" component={SuppliersScreen} options={{ headerShown: true, title: 'Suppliers' }} />
            <Stack.Screen name="AccountStatement" component={AccountStatementScreen} options={{ headerShown: true, title: 'Account Statement' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
