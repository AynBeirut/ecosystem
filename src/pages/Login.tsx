
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/useAuth';
import AccountTypeSelection from '@/components/AccountTypeSelection';
import { Capacitor } from '@capacitor/core';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAccountTypeSelection, setShowAccountTypeSelection] = useState(false);
  const { login, googleLogin, upgradeToAdmin, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    console.log('[Login] useEffect: user state changed:', user);
    if (user) {
      console.log('[Login] Navigating to / because user is set');
      navigate('/');
    }
  }, [user, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await googleLogin();
      // After successful login, we'll ask about account type
      setShowAccountTypeSelection(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccountTypeSelection = async (type: 'user' | 'admin') => {
    setIsSubmitting(true);
    console.log('[Login] handleAccountTypeSelection called with:', type);
    try {
      if (type === 'admin') {
        // Upgrade to admin with free trial
        await upgradeToAdmin();
        console.log('[Login] Upgraded to admin, navigating to /admin');
        navigate('/admin');
      } else {
        // Continue as regular user
        console.log('[Login] Continuing as regular user, navigating to /');
        navigate('/');
      }
    } catch (e) {
      console.error('[Login] Error in handleAccountTypeSelection:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showAccountTypeSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-4xl space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-market-primary">Market Space</h1>
            <p className="mt-2 text-gray-600">Your one-stop market space - by AYN BEIRUT</p>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <AccountTypeSelection 
                onSelect={handleAccountTypeSelection} 
                isLoading={isSubmitting} 
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-market-primary">Market Space</h1>
          <p className="mt-2 text-gray-600">Your one-stop market space - by AYN BEIRUT</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in with Google or create an account
            </CardDescription>
          </CardHeader>

          <Tabs defaultValue="signin">
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
                
                <form>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" name="name" placeholder="John Doe" required autoComplete="name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-signup">Email</Label>
                      <Input id="email-signup" name="email" type="email" placeholder="email@example.com" required autoComplete="email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password-signup">Password</Label>
                      <Input id="password-signup" name="password" type="password" required autoComplete="new-password" />
                    </div>
                    <Button type="submit" className="w-full">
                      Create Account
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
      </div>
    </div>
  );
};

export default Login;
