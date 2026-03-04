const TOKEN_KEY = 'vimdocs_token';
const EXPIRY_KEY = 'vimdocs_token_expiry';
const AUTH_CHANNEL = 'vimdocs-auth';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function getClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (Date.now() > Number(expiry)) {
    clearToken();
    return null;
  }
  return token;
}

function setToken(token: string, expiresIn: number) {
  const expiryMs = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(expiryMs));
  scheduleRefresh(expiresIn);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleRefresh(expiresInSec: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  // Re-auth 5 minutes before expiry
  const refreshIn = Math.max((expiresInSec - 300) * 1000, 60_000);
  refreshTimer = setTimeout(() => {
    signIn(true);
  }, refreshIn);
}

export function signIn(prompt = false): Promise<string> {
  const clientId = getClientId();
  if (!clientId) return Promise.reject(new Error('No client ID configured'));

  const redirectUri = window.location.origin;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: SCOPES,
    ...(prompt ? { prompt: 'none' } : {}),
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  const popup = window.open(authUrl, 'google-auth', 'width=500,height=600');

  return new Promise<string>((resolve, reject) => {
    // With same-origin COOP, window.opener is null in the popup after
    // cross-origin navigation. Use BroadcastChannel to communicate instead.
    const channel = new BroadcastChannel(AUTH_CHANNEL);

    const cleanup = () => {
      channel.close();
      if (pollTimer) clearInterval(pollTimer);
    };

    channel.onmessage = (event) => {
      const data = event.data;
      if (data?.type !== 'vimdocs-oauth') return;

      cleanup();
      if (data.error) {
        reject(new Error(data.error));
      } else {
        setToken(data.access_token, Number(data.expires_in));
        resolve(data.access_token);
      }
    };

    // Check if popup was blocked
    if (!popup) {
      cleanup();
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    // Poll for popup close (user cancelled)
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Sign-in cancelled'));
      }
    }, 500);
  });
}

export function initAuthRedirect() {
  // If this page was opened as the OAuth redirect, extract token and send via BroadcastChannel
  if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    const error = params.get('error');

    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage({
      type: 'vimdocs-oauth',
      access_token: accessToken,
      expires_in: expiresIn,
      error,
    });
    channel.close();

    // Clean URL hash and close popup
    window.close();
    return;
  }

  // Also handle error responses from OAuth
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  if (error) {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage({
      type: 'vimdocs-oauth',
      error,
    });
    channel.close();
    window.close();
  }
}

export async function getUserInfo(token: string): Promise<{ email: string; name: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to get user info');
  return res.json();
}
