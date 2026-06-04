import { NextRequest, NextResponse } from "next/server";

const GOOGLE_OAUTH_STATE_COOKIE = "google_docs_oauth_state";

const getRedirectUri = (request: NextRequest) =>
  process.env.GOOGLE_REDIRECT_URI ||
  `${request.nextUrl.origin}/api/google-docs/oauth/callback`;

export async function GET(request: NextRequest) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(request),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    state,
    prompt: "consent",
    access_type: "offline",
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
