import React from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import ExpensesListScreen from '../screens/expenses/ExpensesListScreen';
import ExpenseEditorScreen from '../screens/expenses/ExpenseEditorScreen';
import PurchasesListScreen from '../screens/purchases/PurchasesListScreen';
import PurchaseEditorScreen from '../screens/purchases/PurchaseEditorScreen';
import TasksScreen from '../screens/tasks/TasksScreen';
import ServiceTasksListScreen from '../screens/serviceTasks/ServiceTasksListScreen';
import ServiceTaskEditorScreen from '../screens/serviceTasks/ServiceTaskEditorScreen';
import ClientPlansListScreen from '../screens/clientPlans/ClientPlansListScreen';
import ClientPlanEditorScreen from '../screens/clientPlans/ClientPlanEditorScreen';
import InvoiceTemplateScreen from '../screens/settings/InvoiceTemplateScreen';
import InvoiceDocumentSettingsScreen from '../screens/settings/InvoiceDocumentSettingsScreen';
import InvoiceHeaderScreen from '../screens/settings/InvoiceHeaderScreen';
import type { MainTabParamList, RootStackParamList } from '../types';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { COLORS } from '../theme';

function FinanceNotificationsGate() {
  usePushNotifications();
  return null;
}

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

function tabIcon(emoji: string) {
  return () => <Text style={styles.tabIcon}>{emoji}</Text>;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const pad = Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: pad,
          height: 56 + pad,
        },
      }}
    >
      <Tab.Screen name="Invoices" component={InvoicesListScreen} options={{ title: 'Invoice', tabBarIcon: tabIcon('📄') }} />
      <Tab.Screen name="Expenses" component={ExpensesListScreen} options={{ title: 'Expense', tabBarIcon: tabIcon('💸') }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: 'Tasks', tabBarIcon: tabIcon('✅') }} />
      <Tab.Screen name="Menu" component={MenuScreen} options={{ title: 'Settings', tabBarIcon: tabIcon('⚙️') }} />
    </Tab.Navigator>
  );
}

function MainTabsRouter() {
  const { user } = useAuth();
  const { loading, canInvoice } = useEntitlements();
  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  if (!user?.storeId) return <AccessDenied message="Sign in with a store owner or staff account." />;
  if (!canInvoice) return <AccessDenied message="Invoice Manager module is not enabled for this store." />;
  return <MainTabs />;
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;
  }

  return (
    <NavigationContainer>
      <>
      {user ? <FinanceNotificationsGate /> : null}
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerTintColor: COLORS.primary,
          headerStyle: { backgroundColor: COLORS.surface },
          headerTitleStyle: { fontWeight: '700', color: COLORS.textPrimary },
          headerStatusBarHeight: insets.top,
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabsRouter} options={{ headerShown: false }} />
            <Stack.Screen name="InvoiceEditor" component={InvoiceEditorScreen} options={{ title: 'Invoice' }} />
            <Stack.Screen name="InvoicePreview" component={InvoicePreviewScreen} options={{ title: 'Preview' }} />
            <Stack.Screen name="InvoiceTemplate" component={InvoiceTemplateScreen} options={{ headerShown: false, title: 'Invoice template' }} />
            <Stack.Screen name="InvoiceTemplateSettings" component={InvoiceTemplateScreen} options={{ headerShown: false, title: 'Invoice template' }} />
            <Stack.Screen name="InvoiceDocumentSettings" component={InvoiceDocumentSettingsScreen} options={{ title: 'Invoice template settings' }} />
            <Stack.Screen name="InvoiceHeaderSettings" component={InvoiceHeaderScreen} options={{ title: 'Invoice header' }} />
            <Stack.Screen name="EstimatesList" component={EstimatesListScreen} options={{ title: 'Estimates' }} />
            <Stack.Screen name="EstimateEditor" component={EstimateEditorScreen} options={{ title: 'Estimate' }} />
            <Stack.Screen name="ReceiptsList" component={ReceiptsListScreen} options={{ title: 'Receipts' }} />
            <Stack.Screen name="ReceiptEditor" component={ReceiptEditorScreen} options={{ title: 'Receipt' }} />
            <Stack.Screen name="PurchasesList" component={PurchasesListScreen} options={{ title: 'Purchases' }} />
            <Stack.Screen name="PurchaseEditor" component={PurchaseEditorScreen} options={{ title: 'Purchase order' }} />
            <Stack.Screen name="ExpenseEditor" component={ExpenseEditorScreen} options={{ title: 'Expense' }} />
            <Stack.Screen name="ClientsList" component={ClientsListScreen} options={{ title: 'Clients' }} />
            <Stack.Screen name="ClientEditor" component={ClientEditorScreen} options={{ title: 'Client' }} />
            <Stack.Screen name="ProductsList" component={ProductsListScreen} options={{ title: 'Products' }} />
            <Stack.Screen name="ProductEditor" component={ProductEditorScreen} options={{ title: 'Product' }} />
            <Stack.Screen name="TeamTodos" component={TasksScreen} options={{ title: 'Team to-do' }} />
            <Stack.Screen name="ServiceTasksList" component={ServiceTasksListScreen} options={{ title: 'Service tasks' }} />
            <Stack.Screen name="ServiceTaskEditor" component={ServiceTaskEditorScreen} options={{ title: 'Service task' }} />
            <Stack.Screen name="ClientPlansList" component={ClientPlansListScreen} options={{ title: 'Client plans' }} />
            <Stack.Screen name="ClientPlanEditor" component={ClientPlanEditorScreen} options={{ title: 'Client plan' }} />
          </>
        )}
      </Stack.Navigator>
      </>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  deniedTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  deniedText: { marginTop: 8, color: COLORS.textSecondary, textAlign: 'center' },
  tabIcon: { fontSize: 16 },
});
