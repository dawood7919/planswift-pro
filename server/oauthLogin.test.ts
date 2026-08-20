import { decodeOAuthState, OAUTH_STATE_COOKIE } from "@shared/const";
import { buildOAuthLoginRequest } from "@/lib/oauthLogin";
import { describe, expect, it } from "vitest";

describe("بداية OAuth", () => {
  it("يبني callback على أصل التطبيق ويربط الـstate بملف nonce قصير العمر", () => {
    const request = buildOAuthLoginRequest({
      origin: "https://takeoff.example.com",
      oauthPortalUrl: "https://manus.im",
      appId: "takeoff-app",
      nonce: "nonce-for-test",
    });

    expect(request.redirectUri).toBe("https://takeoff.example.com/api/oauth/callback");
    expect(decodeOAuthState(request.state)).toEqual({
      redirectUri: request.redirectUri,
      nonce: "nonce-for-test",
    });
    expect(request.stateCookie).toBe(
      `${OAUTH_STATE_COOKIE}=nonce-for-test; Path=/; Max-Age=600; SameSite=None; Secure`,
    );
  });

  it("يحافظ على معلمات Manus المطلوبة عند الانتقال من حدث تسجيل الدخول", () => {
    const request = buildOAuthLoginRequest({
      origin: "https://takeoff.example.com",
      oauthPortalUrl: "https://manus.im",
      appId: "takeoff-app",
      nonce: "nonce-for-test",
    });
    const url = new URL(request.url);

    expect(url.pathname).toBe("/app-auth");
    expect(url.searchParams.get("appId")).toBe("takeoff-app");
    expect(url.searchParams.get("redirectUri")).toBe(request.redirectUri);
    expect(url.searchParams.get("state")).toBe(request.state);
    expect(url.searchParams.get("type")).toBe("signIn");
  });
});
