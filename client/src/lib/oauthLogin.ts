import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export type OAuthLoginRequest = {
  redirectUri: string;
  state: string;
  stateCookie: string;
  url: string;
};

export function buildOAuthLoginRequest({
  origin,
  oauthPortalUrl,
  appId,
  nonce,
}: {
  origin: string;
  oauthPortalUrl: string;
  appId: string;
  nonce: string;
}): OAuthLoginRequest {
  const redirectUri = `${origin}/api/oauth/callback`;
  const state = encodeOAuthState({ redirectUri, nonce });
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return {
    redirectUri,
    state,
    stateCookie: `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`,
    url: url.toString(),
  };
}
