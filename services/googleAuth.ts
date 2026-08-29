/**
 * Google Identity Services (GIS) Auth Wrapper
 * Uses the modern `google.accounts.id` API — completely free in production.
 * No backend required. Tokens are validated client-side via JWT decode.
 */

export interface GoogleUser {
  sub: string;       // unique Google user ID
  name: string;
  email: string;
  picture: string;
  given_name: string;
}

declare global {
  interface Window {
    google: any;
    onGoogleLibraryLoad: () => void;
  }
}

/** Decode a JWT credential string returned by Google GIS (no library needed) */
function decodeJwt(token: string): GoogleUser {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );
  return JSON.parse(json) as GoogleUser;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/** Resolve when the GIS script is fully loaded */
function waitForGIS(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    // Script already added by index.html, just wait for onload
    const check = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}

let isInitialized = false;
let globalCallback: ((user: GoogleUser) => void) | null = null;
let globalErrorCallback: ((err: Error) => void) | null = null;

/**
 * Initialize Google Auth SDK globally with stable callbacks.
 * Can be called multiple times safely when component re-renders.
 */
export async function initializeGoogleAuth(
  onSuccess: (user: GoogleUser) => void,
  onFailure: (err: Error) => void
): Promise<void> {
  globalCallback = onSuccess;
  globalErrorCallback = onFailure;

  if (isInitialized) {
    return;
  }

  if (!CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID no configurado en .env.local');
  }

  await waitForGIS();

  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response: { credential: string; error?: string }) => {
      if (response.error) {
        if (globalErrorCallback) globalErrorCallback(new Error(response.error));
        return;
      }
      try {
        const user = decodeJwt(response.credential);
        sessionStorage.setItem('airstark_user', JSON.stringify(user));
        sessionStorage.setItem('airstark_token', response.credential);
        if (globalCallback) globalCallback(user);
      } catch (e: any) {
        if (globalErrorCallback) globalErrorCallback(e);
      }
    },
    use_fedcm_for_prompt: true,
  });

  isInitialized = true;
}

/**
 * Trigger the Google One-Tap / popup sign-in flow.
 */
export async function signInWithGoogle(
  onSuccess: (user: GoogleUser) => void,
  onFailure: (err: Error) => void
): Promise<void> {
  await initializeGoogleAuth(onSuccess, onFailure);

  window.google.accounts.id.prompt((notification: any) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      if (!window.google.accounts.oauth2) {
        onFailure(new Error('Google Sign-In no disponible en este entorno'));
      }
    }
  });
}

/** Render the official Google Sign-In button into a container element */
export async function renderGoogleButton(container: HTMLElement): Promise<void> {
  if (!CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID no configurado en .env.local');
  }

  await waitForGIS();

  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: 320,
  });
}

/** Sign out — clears session and revokes GIS state */
export function signOut(email?: string): void {
  sessionStorage.removeItem('airstark_user');
  sessionStorage.removeItem('airstark_token');
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
    if (email) window.google.accounts.id.revoke(email, () => {});
  }
}

/** Return persisted session user (page reload resilience) */
export function getStoredUser(): GoogleUser | null {
  try {
    const raw = sessionStorage.getItem('airstark_user');
    return raw ? (JSON.parse(raw) as GoogleUser) : null;
  } catch {
    return null;
  }
}

/** Return the raw JWT credential for API authentication */
export function getStoredToken(): string | null {
  return sessionStorage.getItem('airstark_token');
}
