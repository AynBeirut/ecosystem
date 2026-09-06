/** Persist signup intent across Google OAuth redirect/popup. */
const SIGNUP_INTENT_KEY = 'grabio_signup_intent';

export function markSignupIntent(): void {
  sessionStorage.setItem(SIGNUP_INTENT_KEY, '1');
}

export function consumeSignupIntent(): boolean {
  const value = sessionStorage.getItem(SIGNUP_INTENT_KEY) === '1';
  sessionStorage.removeItem(SIGNUP_INTENT_KEY);
  return value;
}

export function buildSubscriptionPath(searchParams: URLSearchParams): string {
  const qs = new URLSearchParams();
  const preset = searchParams.get('preset');
  const onboarding = searchParams.get('onboarding');
  if (preset) qs.set('preset', preset);
  if (onboarding) qs.set('onboarding', onboarding);
  const query = qs.toString();
  return query ? `/subscription?${query}` : '/subscription';
}
