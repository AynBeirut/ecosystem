
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/context/useAuth';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithCustomToken, updateProfile } from 'firebase/auth';
import PoweredByEmoove from '@/components/PoweredByEmoove';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, googleLogin, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';

  // DEV-only: `?customToken=…` for local E2E (custom token from Admin SDK)
  useEffect(() => {
    const devToken = searchParams.get('customToken');
    if (!import.meta.env.DEV || !devToken || user) return;
    void signInWithCustomToken(auth, devToken).catch((err) => {
      console.error('[Login] dev customToken sign-in failed', err);
      toast.error('Dev token sign-in failed');
    });
  }, [searchParams, user]);

  // Redirect if already logged in
  useEffect(() => {
    console.log('[Login] useEffect: user state changed:', user);
    if (user) {
      console.log('[Login] User detected, checking for redirect');
      const fromState = (location.state as { from?: { pathname?: string; search?: string } })?.from;
      const fromStatePath =
        fromState?.pathname
          ? `${fromState.pathname}${fromState.search || ''}`
          : null;
      const nextParam = searchParams.get('next');
      const redirectPath =
        localStorage.getItem('redirectAfterLogin') || nextParam || fromStatePath;
      console.log('[Login] Redirect path:', redirectPath);

      if (redirectPath && redirectPath.startsWith('/') && !redirectPath.startsWith('/login')) {
        localStorage.removeItem('redirectAfterLogin');
        console.log('[Login] Navigating to saved path:', redirectPath);
        navigate(redirectPath, { replace: true });
      } else if (user.role === 'crm_rep') {
        navigate('/team/crm', { replace: true });
      } else if (user.role === 'admin') {
        const onboarding = searchParams.get('onboarding');
        const preset = searchParams.get('preset');
        if (onboarding || preset) {
          const qs = preset ? `?preset=${preset}` : onboarding ? `?onboarding=${onboarding}` : '';
          navigate(`/onboarding/package${qs}`, { replace: true });
        } else {
          navigate('/admin', { replace: true });
        }
      } else if (user.role === 'sub_account') {
        navigate('/team/dashboard', { replace: true });
      } else {
        console.log('[Login] No redirect path, navigating to marketplace');
        navigate('/search', { replace: true });
      }
    }
  }, [user, navigate, searchParams, location.state]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signupPassword !== signupConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
      if (signupName.trim()) {
        await updateProfile(userCredential.user, { displayName: signupName.trim() });
      }
      toast.success('Account created successfully!');
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err?.message || 'An error occurred during signup');
      console.error('Signup error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await googleLogin();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show spinner only while a previous session is being restored (e.g. returning user).
  // Do NOT block while isLoading is true for a popup sign-in in progress — that would
  // hide the form and confuse the user if the popup is closed.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-market-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-market-primary">Grabio</h1>
          <p className="mt-2 text-gray-600">Your modular business platform</p>
          <p className="mt-1">
            <PoweredByEmoove />
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in with Google or create an account
            </CardDescription>
          </CardHeader>

          <Tabs defaultValue={defaultTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <CardContent className="space-y-4 pt-4">
                <Button 
                  type="button" 
                  className="w-full flex items-center justify-center"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5 mr-2" alt="Google logo" />
                  Sign in with Google
                </Button>
                
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-gray-500">Or continue with email</span>
                  </div>
                </div>
                
                <form onSubmit={handleEmailLogin}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <a href="#" className="text-xs text-market-primary hover:underline">
                          Forgot password?
                        </a>
                      </div>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="signup">
              <CardContent className="space-y-4 pt-4">
                <Button 
                  type="button" 
                  className="w-full flex items-center justify-center"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5 mr-2" alt="Google logo" />
                  Sign up with Google
                </Button>
                
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-gray-500">Or sign up with email</span>
                  </div>
                </div>
                
                <form onSubmit={handleEmailSignup}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="John Doe"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-signup">Email</Label>
                      <Input
                        id="email-signup"
                        name="email"
                        type="email"
                        placeholder="email@example.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password-signup">Password</Label>
                      <Input
                        id="password-signup"
                        name="password"
                        type="password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password-signup-confirm">Confirm Password</Label>
                      <Input
                        id="password-signup-confirm"
                        name="confirmPassword"
                        type="password"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
          
          <CardFooter className="flex flex-col text-center text-xs text-gray-500 pt-0">
            <p>By signing in, you agree to our Terms of Service and Privacy Policy.</p>
          </CardFooter>
        </Card>

        <div className="text-center text-sm space-y-2">
          <div>
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link to="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </div>

        <a
          href="/store-owner-guide.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition text-sm font-semibold"
        >
          <span>📘</span>
          Store Owner Guide — Features &amp; Plans
        </a>
      </div>
    </div>
  );
};

export default Login;
