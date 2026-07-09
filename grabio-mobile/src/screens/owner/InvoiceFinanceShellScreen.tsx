import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Text,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAuth } from '@react-native-firebase/auth';
import { RootStackParamList } from '../../types';
import {
  buildShellBootstrapJs,
  invoiceManagerUrl,
  isInvoiceManagerUrl,
  INVOICE_MANAGER_HOME,
} from '../../lib/invoiceApp';
import { API_BASE_URL } from '../../lib/apiBase';
import { COLORS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'InvoiceManager'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

async function fetchFinanceSsoToken(): Promise<string | null> {
  const user = getAuth().currentUser;
  if (!user) return null;
  try {
    const idToken = await user.getIdToken();
    const res = await fetch(`${API_BASE_URL}/finance/sso-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { customToken?: string };
    return data.customToken ?? null;
  } catch {
    return null;
  }
}

type Props = {
  initialPath?: string;
};

/** Full-screen Invoice Manager — same UI as standalone space.grabio.finance app. */
export default function InvoiceFinanceShellScreen({ initialPath }: Props) {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [startUrl, setStartUrl] = useState<string | null>(null);
  const [bootstrapJs, setBootstrapJs] = useState(buildShellBootstrapJs());
  const [error, setError] = useState<string | null>(null);

  const path = initialPath ?? route.params?.path ?? INVOICE_MANAGER_HOME;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await fetchFinanceSsoToken();
      if (cancelled) return;
      setBootstrapJs(buildShellBootstrapJs(token));
      setStartUrl(invoiceManagerUrl(path));
    })().catch(() => {
      if (!cancelled) {
        setBootstrapJs(buildShellBootstrapJs());
        setStartUrl(invoiceManagerUrl(path));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    const onBack = () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      navigation.goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [canGoBack, navigation]);

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  if (!startUrl) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Opening Invoice Manager…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator color="#38B2AC" size="large" />
        </View>
      )}

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <WebView
        ref={webRef}
        source={{ uri: startUrl }}
        style={styles.web}
        injectedJavaScriptBeforeContentLoaded={bootstrapJs}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={onNavChange}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        onError={() => setError('Could not load Invoice Manager. Check your connection.')}
        onShouldStartLoadWithRequest={(req) => {
          const allowed = isInvoiceManagerUrl(req.url);
          if (!allowed) {
            setError('This action opens outside Invoice Manager. Use the in-app menu instead.');
          }
          return allowed;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  web: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: COLORS.textSecondary, fontSize: 14 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 2,
  },
  errorBar: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  errorText: { color: '#b91c1c', fontSize: 12, textAlign: 'center' },
});
