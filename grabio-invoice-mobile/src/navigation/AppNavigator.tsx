import React from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../hooks/useEntitlements';
import LoginScreen from '../screens/LoginScreen';
import MenuScreen from '../screens/MenuScreen';
import InvoicesListScreen from '../screens/invoices/InvoicesListScreen';
import InvoiceEditorScreen from '../screens/invoices/InvoiceEditorScreen';
import InvoicePreviewScreen from '../screens/invoices/InvoicePreviewScreen';
import EstimatesListScreen from '../screens/estimates/EstimatesListScreen';
import EstimateEditorScreen from '../screens/estimates/EstimateEditorScreen';
import ReceiptsListScreen from '../screens/receipts/ReceiptsListScreen';
import ReceiptEditorScreen from '../screens/receipts/ReceiptEditorScreen';
import ClientsListScreen from '../screens/clients/ClientsListScreen';
import ClientEditorScreen from '../screens/clients/ClientEditorScreen';
import ProductsListScreen from '../screens/products/ProductsListScreen';
import ProductEditorScreen from '../screens/products/ProductEditorScreen';
import CrmMyClientsScreen from '../screens/crm/CrmMyClientsScreen';
import CrmClientDetailScreen from '../screens/crm/CrmClientDetailScreen';
import type { MainTabParamList, RootStackParamList } from '../types';
import { COLORS } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AccessDenied({ message }: { message: string }) {
  return (
    <View style={styles.denied}>
      <Text style={styles.deniedTitle}>No access</Text>
      <Text style={styles.deniedText}>{message}</Text>
    </View>
  );
}

function tabIcon(label: string) {
  return () => <Text style={styles.tabIcon}>{label}</Text>;
}

function OwnerTabs() {
  const { canInvoice, canCrm } = useEntitlements();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      {canInvoice ? <Tab.Screen name="Invoices" component={InvoicesListScreen} options={{ tabBarIcon: tabIcon('INV') }} /> : null}
      <Tab.Screen name="Clients" component={ClientsListScreen} options={{ tabBarIcon: tabIcon('CLI') }} />
      {canInvoice ? <Tab.Screen name="Products" component={ProductsListScreen} options={{ tabBarIcon: tabIcon('PRD') }} /> : null}
      {canCrm ? <Tab.Screen name="Crm" component={CrmMyClientsScreen} options={{ title: 'CRM', tabBarIcon: tabIcon('CRM') }} /> : null}
      <Tab.Screen name="Menu" component={MenuScreen} options={{ title: 'Settings', tabBarIcon: tabIcon('SET') }} />
    </Tab.Navigator>
  );
}

function CrmRepTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: COLORS.primary }}>
      <Tab.Screen name="Crm" component={CrmMyClientsScreen} options={{ title: 'My clients', tabBarIcon: tabIcon('CRM') }} />
      <Tab.Screen name="Clients" component={ClientsListScreen} options={{ title: 'Directory', tabBarIcon: tabIcon('CLI') }} />
      <Tab.Screen name="Menu" component={MenuScreen} options={{ title: 'Settings', tabBarIcon: tabIcon('SET') }} />
    </Tab.Navigator>
  );
}

function MainTabsRouter() {
  const { user } = useAuth();
  const { loading, canInvoice, canCrm } = useEntitlements();

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  if (user?.userRole === 'crm_rep') {
    if (!canCrm) return <AccessDenied message="CRM is not enabled for this store." />;
    return <CrmRepTabs />;
  }

  if (!user?.storeId) return <AccessDenied message="Sign in with a store owner or staff account." />;
  if (!canInvoice && !canCrm) return <AccessDenied message="Invoice Manager or CRM module required." />;

  return <OwnerTabs />;
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true, headerTintColor: COLORS.primary }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabsRouter} options={{ headerShown: false }} />
            <Stack.Screen name="InvoiceEditor" component={InvoiceEditorScreen} options={{ title: 'Invoice' }} />
            <Stack.Screen name="InvoicePreview" component={InvoicePreviewScreen} options={{ title: 'Preview' }} />
            <Stack.Screen name="EstimatesList" component={EstimatesListScreen} options={{ title: 'Estimates' }} />
            <Stack.Screen name="EstimateEditor" component={EstimateEditorScreen} options={{ title: 'Estimate' }} />
            <Stack.Screen name="ReceiptsList" component={ReceiptsListScreen} options={{ title: 'Receipts' }} />
            <Stack.Screen name="ReceiptEditor" component={ReceiptEditorScreen} options={{ title: 'Receipt' }} />
            <Stack.Screen name="ClientEditor" component={ClientEditorScreen} options={{ title: 'Client' }} />
            <Stack.Screen name="ProductEditor" component={ProductEditorScreen} options={{ title: 'Product' }} />
            <Stack.Screen name="CrmClientDetail" component={CrmClientDetailScreen} options={{ title: 'Client detail' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  denied: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: COLORS.background },
  deniedTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  deniedText: { marginTop: 8, textAlign: 'center', color: COLORS.textSecondary },
  tabIcon: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
});
