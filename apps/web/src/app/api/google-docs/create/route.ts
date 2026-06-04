import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_DOCS_ACCESS_TOKEN_COOKIE = "google_docs_access_token";

const escapeMultipartValue = (value: string) =>
  value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

export async function POST(request: NextRequest) {
  const accessToken = cookies().get(GOOGLE_DOCS_ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Google authorization is required" },
      { status: 401 }
    );
  }

  let body: { title?: unknown; html?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.title !== "string" || typeof body.html !== "string") {
    return NextResponse.json(
      { error: "Missing title or html content" },
      { status: 400 }
    );
  }

  const title = body.title.trim() || "Untitled document";
  const boundary = `xaikit-google-doc-${crypto.randomUUID()}`;
  const metadata = {
    name: title,
    mimeType: "application/vnd.google-apps.document",
  };
  const multipartBody = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    escapeMultipartValue(body.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    return NextResponse.json(
      {
        error: "Failed to create Google Doc",
        details: errorText,
      },
      { status: uploadResponse.status }
    );
  }

  const uploadJson = await uploadResponse.json();
  return NextResponse.json({
    documentId: uploadJson.id,
    url: uploadJson.webViewLink,
  });
}
