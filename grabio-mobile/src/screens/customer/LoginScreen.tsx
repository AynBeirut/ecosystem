import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS } from '../../theme';

type AuthErrorLike = {
  message?: string;
  code?: string;
};

// Configure Google Sign-In (webClientId from Firebase Console > Authentication > Sign-in providers > Google)
GoogleSignin.configure({
  webClientId: '997465465802-biu0r3k8ff880560gvgd8tao71361bp4.apps.googleusercontent.com',
});

export default function LoginScreen() {
  const { enterGuestMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        await auth().createUserWithEmailAndPassword(email.trim(), password);
      } else {
        await auth().signInWithEmailAndPassword(email.trim(), password);
      }
    } catch (err: unknown) {
      const error = err as AuthErrorLike;
      Alert.alert('Authentication Error', error.message || 'Unknown authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error('No ID token returned from Google Sign-In');
      const credential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(credential);
    } catch (err: unknown) {
      const error = err as AuthErrorLike;
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google Sign-In Error', error.message || 'Unknown Google sign-in error');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>grabio</Text>
        <Text style={styles.subtitle}>Your local marketplace</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Loading…' : isSignUp ? 'Sign Up' : 'Sign In'}</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={googleLoading}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleText}>{googleLoading ? 'Signing in…' : 'Continue with Google'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={styles.toggle}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.guestButton} onPress={enterGuestMode}>
          <Text style={styles.guestText}>Browse as Guest →</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logo: { fontSize: 42, fontWeight: '800', color: COLORS.primary, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 40 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: RADIUS.md, padding: 14,
    fontSize: 16, marginBottom: 12, backgroundColor: '#f9fafb',
  },
  button: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { marginHorizontal: 12, color: '#9ca3af', fontSize: 14 },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: RADIUS.md, padding: 14,
    backgroundColor: '#fff',
  },
  googleIcon: {
    fontSize: 18, fontWeight: '800', color: '#4285F4', marginRight: 10,
  },
  googleText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  toggle: { color: COLORS.primary, textAlign: 'center', marginTop: 20, fontSize: 14 },
  guestButton: {
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center', backgroundColor: '#fff',
  },
  guestText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
});
