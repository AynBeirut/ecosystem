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
  prefixes: ['grabio://', 'https://grabio.space/track-order', 'https://grabio.space/order'],
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
import GatedAddEditProductScreen from '../screens/owner/GatedAddEditProductScreen';
import InventoryScreen from '../screens/owner/InventoryScreen';
import GatedExpensesScreen from '../screens/owner/GatedExpensesScreen';
import CreateOrderScreen from '../screens/owner/CreateOrderScreen';
import CustomersScreen from '../screens/owner/CustomersScreen';
import GatedPurchasesScreen from '../screens/owner/GatedPurchasesScreen';
import GatedSuppliersScreen from '../screens/owner/GatedSuppliersScreen';
import GatedAccountStatementScreen from '../screens/owner/GatedAccountStatementScreen';
import GatedClientBalancesScreen from '../screens/owner/GatedClientBalancesScreen';
import GatedInvoiceManagerScreen from '../screens/owner/GatedInvoiceManagerScreen';
import GatedSalesCrmScreen from '../screens/owner/GatedSalesCrmScreen';
import GatedCrmMyClientsScreen from '../screens/owner/GatedCrmMyClientsScreen';
import GatedCrmClientDetailScreen from '../screens/crm/GatedCrmClientDetailScreen';
import GatedCrmClientFormScreen from '../screens/crm/GatedCrmClientFormScreen';
import GatedCrmTeamMapScreen from '../screens/crm/GatedCrmTeamMapScreen';
import GatedCrmPerformanceScreen from '../screens/crm/GatedCrmPerformanceScreen';
import GatedCrmStoreAreasScreen from '../screens/crm/GatedCrmStoreAreasScreen';
import GatedCrmTasksScreen from '../screens/crm/GatedCrmTasksScreen';
import GatedCrmVisitRouteFormScreen from '../screens/crm/GatedCrmVisitRouteFormScreen';
import GatedCrmVisitRouteDetailScreen from '../screens/crm/GatedCrmVisitRouteDetailScreen';
import PushNotificationBridge from '../components/PushNotificationBridge';
import SalesLocationGate from '../components/SalesLocationGate';
import { SalesLocationProvider } from '../context/SalesLocationContext';
import { requiresMandatorySalesLocation } from '../lib/salesLocationPolicy';

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

function CrmRepTabs() {
  return (
    <Tab.Navigator screenOptions={{ ...TAB_HEADER, tabBarActiveTintColor: COLORS.primary }}>
      <Tab.Screen
        name="CrmClients"
        component={GatedCrmMyClientsScreen}
        options={{ tabBarLabel: 'Clients', tabBarIcon: () => <Text>📋</Text>, title: 'CRM Clients', headerShown: false }}
      />
      <Tab.Screen
        name="CrmTasks"
        component={GatedCrmTasksScreen}
        options={{ tabBarLabel: 'Tasks', tabBarIcon: () => <Text>✅</Text>, title: 'Tasks & To-do', headerShown: false }}
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
        name="OwnerDashboard"
        component={OwnerDashboardScreen}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: () => <Text>📊</Text>, title: 'Dashboard' }}
      />
      <Tab.Screen
        name="CrmClients"
        component={GatedCrmMyClientsScreen}
        options={{ tabBarLabel: 'CRM', tabBarIcon: () => <Text>📍</Text>, title: 'CRM Clients', headerShown: false }}
      />
      <Tab.Screen
        name="OwnerTab"
        component={OwnerOrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: () => <Text>📋</Text>, title: 'Orders' }}
      />
      <Tab.Screen
        name="OwnerHome"
        component={CreateOrderScreen}
        options={{ tabBarLabel: 'POS', tabBarIcon: () => <Text>🛒</Text>, title: 'Quick Sale', headerShown: true }}
      />
      <Tab.Screen
        name="OwnerCustomers"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: () => <Text>👤</Text>, title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function AppStack() {
  const { user } = useAuth();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="MainTabs"
        component={
          user?.userRole === 'crm_rep'
            ? CrmRepTabs
            : user && ['owner', 'sub_seller', 'sub_manager', 'sub_delivery'].includes(user.userRole)
              ? OwnerTabs
              : CustomerTabs
        }
      />
      <Stack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ headerShown: true, title: 'Store' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: true, title: 'Cart' }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: true, title: 'Checkout' }} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ headerShown: true, title: 'Order Status' }} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ headerShown: true, title: 'My Favorites' }} />
      <Stack.Screen name="OwnerOrders" component={OwnerOrdersScreen} options={{ headerShown: true, title: 'Orders' }} />
      <Stack.Screen name="OwnerProducts" component={OwnerProductsScreen} options={{ headerShown: true, title: 'Products' }} />
      <Stack.Screen name="AddEditProduct" component={GatedAddEditProductScreen} options={{ headerShown: true, title: 'Product' }} />
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ headerShown: true, title: 'Inventory' }} />
      <Stack.Screen name="Expenses" component={GatedExpensesScreen} options={{ headerShown: true, title: 'Expenses' }} />
      <Stack.Screen name="CreateOrder" component={CreateOrderScreen} options={{ headerShown: true, title: 'Create Order' }} />
      <Stack.Screen name="Customers" component={CustomersScreen} options={{ headerShown: true, title: 'Customers' }} />
      <Stack.Screen name="Purchases" component={GatedPurchasesScreen} options={{ headerShown: true, title: 'Purchases' }} />
      <Stack.Screen name="Suppliers" component={GatedSuppliersScreen} options={{ headerShown: true, title: 'Suppliers' }} />
      <Stack.Screen name="AccountStatement" component={GatedAccountStatementScreen} options={{ headerShown: true, title: 'Account Statement' }} />
      <Stack.Screen name="ClientBalances" component={GatedClientBalancesScreen} options={{ headerShown: true, title: 'Client Balances' }} />
      <Stack.Screen name="InvoiceManager" component={GatedInvoiceManagerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SalesCrm" component={GatedSalesCrmScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CrmMyClients" component={GatedCrmMyClientsScreen} options={{ headerShown: true, title: 'CRM Clients' }} />
      <Stack.Screen name="CrmClientDetail" component={GatedCrmClientDetailScreen} options={{ headerShown: true, title: 'Client' }} />
      <Stack.Screen name="CrmClientForm" component={GatedCrmClientFormScreen} options={{ headerShown: true, title: 'CRM Client' }} />
      <Stack.Screen name="CrmTeamMap" component={GatedCrmTeamMapScreen} options={{ headerShown: true, title: 'Map & Pipeline' }} />
      <Stack.Screen name="CrmVisitRouteForm" component={GatedCrmVisitRouteFormScreen} options={{ headerShown: true, title: 'Create Route' }} />
      <Stack.Screen name="CrmVisitRouteDetail" component={GatedCrmVisitRouteDetailScreen} options={{ headerShown: true, title: 'Visit Route' }} />
      <Stack.Screen name="CrmPerformance" component={GatedCrmPerformanceScreen} options={{ headerShown: true, title: 'Performance' }} />
      <Stack.Screen name="CrmStoreAreas" component={GatedCrmStoreAreasScreen} options={{ headerShown: true, title: 'Store Areas' }} />
      <Stack.Screen name="CrmTasks" component={GatedCrmTasksScreen} options={{ headerShown: true, title: 'Tasks & To-do' }} />
    </Stack.Navigator>
  );
}

function AuthenticatedApp() {
  const { user, isGuest } = useAuth();
  const needsSalesLocation = Boolean(user) && !isGuest && requiresMandatorySalesLocation(user);
  const content = (
    <>
      <PushNotificationBridge />
      <AppStack />
    </>
  );
  if (!needsSalesLocation) return content;
  return (
    <SalesLocationProvider>
      <SalesLocationGate>
        {content}
      </SalesLocationGate>
    </SalesLocationProvider>
  );
}

export default function AppNavigator() {
  const { user, loading, isGuest } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer linking={linking}>
      {!user && !isGuest ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      ) : (
        <AuthenticatedApp />
      )}
    </NavigationContainer>
  );
}
