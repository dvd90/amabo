/**
 * auth/provider.ts — the OAuth boundary (ARCHITECTURE.md §14). Google is the launch
 * provider; everything sits behind an AuthProvider port so the rest of the app never
 * touches a vendor SDK and tests use a FakeAuthProvider. Passwords are never stored.
 */

export interface OAuthProfile {
  provider: string;
  subject: string;
  email: string;
  displayName: string;
}

export interface AuthProvider {
  /** Where to send the browser to begin sign-in. */
  authUrl(state: string, redirectUri: string): string;
  /** Exchange the returned code for a verified profile. */
  exchange(code: string, redirectUri: string): Promise<OAuthProfile>;
}

/** Deterministic provider for tests and zero-setup local dev: the code *is* the subject. */
export class FakeAuthProvider implements AuthProvider {
  authUrl(state: string, redirectUri: string): string {
    return `${redirectUri}?code=test-user&state=${encodeURIComponent(state)}`;
  }
  async exchange(code: string): Promise<OAuthProfile> {
    return {
      provider: 'fake',
      subject: code,
      email: `${code}@example.com`,
      displayName: code,
    };
  }
}

/** Real Google OAuth 2.0 (used in production; needs GOOGLE_OAUTH_ID/SECRET). */
export class GoogleAuthProvider implements AuthProvider {
  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  authUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchange(code: string, redirectUri: string): Promise<OAuthProfile> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error('oauth token exchange failed');
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error('oauth userinfo failed');
    const info = (await infoRes.json()) as { sub: string; email: string; name?: string };
    return {
      provider: 'google',
      subject: info.sub,
      email: info.email,
      displayName: info.name ?? info.email,
    };
  }
}
