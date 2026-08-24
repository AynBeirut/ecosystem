import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { COLORS, RADIUS } from '../theme';

GoogleSignin.configure({
  webClientId: '997465465802-biu0r3k8ff880560gvgd8tao71361bp4.apps.googleusercontent.com',
});

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }
    setLoading(true);
    try {
      await auth().signInWithEmailAndPassword(email.trim(), password);
    } catch (err: unknown) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signOut();
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error('No ID token from Google');
      const credential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(credential);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google sign-in failed', err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Grabio Invoice</Text>
        <Text style={styles.subtitle}>Invoices, estimates & CRM</Text>
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={googleLoading}>
          <Text style={styles.googleText}>{googleLoading ? 'Google…' : 'Continue with Google'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 32, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  subtitle: { textAlign: 'center', color: COLORS.textSecondary, marginBottom: 24 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 14, marginBottom: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  googleBtn: { marginTop: 16, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 14, alignItems: 'center', backgroundColor: COLORS.surface },
  googleText: { color: COLORS.textPrimary, fontWeight: '600' },
});
