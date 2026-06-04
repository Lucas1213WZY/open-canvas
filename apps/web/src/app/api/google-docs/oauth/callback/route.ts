import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_DOCS_ACCESS_TOKEN_COOKIE = "google_docs_access_token";
const GOOGLE_OAUTH_STATE_COOKIE = "google_docs_oauth_state";

const getRedirectUri = (request: NextRequest) =>
  process.env.GOOGLE_REDIRECT_URI ||
  `${request.nextUrl.origin}/api/google-docs/oauth/callback`;

const popupResponse = (message: Record<string, string>) =>
  new NextResponse(
    `<!doctype html>
<html>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage(${JSON.stringify(message)}, window.location.origin);
  }
  window.close();
</script>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = cookies().get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || state !== storedState) {
    return popupResponse({
      type: "google-docs-auth-error",
      error: "Google authorization failed.",
    });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return popupResponse({
      type: "google-docs-auth-error",
      error: "Google OAuth credentials are not configured.",
    });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return popupResponse({
      type: "google-docs-auth-error",
      error: "Google token exchange failed.",
    });
  }

  const tokenJson = await tokenResponse.json();
  const accessToken = tokenJson.access_token;
  const expiresIn =
    typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 3600;

  if (typeof accessToken !== "string") {
    return popupResponse({
      type: "google-docs-auth-error",
      error: "Google did not return an access token.",
    });
  }

  const response = popupResponse({
    type: "google-docs-auth-complete",
  });
  response.cookies.set(GOOGLE_DOCS_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    maxAge: Math.min(expiresIn, 3600),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);

  return response;
}
