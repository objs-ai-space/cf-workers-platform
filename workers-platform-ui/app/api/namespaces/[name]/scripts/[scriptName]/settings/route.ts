import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_READ = process.env.CLOUDFLARE_API_TOKEN_READ!;
const CLOUDFLARE_API_TOKEN_EDIT = process.env.CLOUDFLARE_API_TOKEN_EDIT!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

const getBaseUrl = (namespace: string, scriptName: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${namespace}/scripts/${scriptName}/settings`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string; scriptName: string }> }
) {
  try {
    const { name, scriptName } = await params;
    console.log("[API /scripts/settings GET] Namespace:", name, "Script:", scriptName);

    const response = await fetch(getBaseUrl(name, scriptName), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_READ}`,
      },
    });

    const data = await response.json();
    console.log("[API /scripts/settings GET] Response:", JSON.stringify(data, null, 2));

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to fetch settings" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result);
  } catch (error) {
    console.error("[API /scripts/settings GET] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ name: string; scriptName: string }> }
) {
  try {
    const { name, scriptName } = await params;
    const body = await request.json();

    console.log("========================================");
    console.log("[API /scripts/settings PATCH] UPDATING BINDINGS");
    console.log("========================================");
    console.log("[API /scripts/settings PATCH] Namespace:", name);
    console.log("[API /scripts/settings PATCH] Script name:", scriptName);
    console.log("[API /scripts/settings PATCH] Settings payload:", JSON.stringify(body, null, 2));

    // Cloudflare requires multipart/form-data for settings
    const formData = new FormData();
    formData.append("settings", JSON.stringify(body));

    const cfApiUrl = getBaseUrl(name, scriptName);
    console.log("[API /scripts/settings PATCH] Cloudflare API URL:", cfApiUrl);

    const response = await fetch(cfApiUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_EDIT}`,
      },
      body: formData,
    });

    const data = await response.json();
    console.log("[API /scripts/settings PATCH] Cloudflare response status:", response.status);
    console.log("[API /scripts/settings PATCH] Cloudflare response:", JSON.stringify(data, null, 2));

    if (!data.success) {
      console.error("[API /scripts/settings PATCH] Cloudflare error:", data.errors);
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to update settings" },
        { status: response.status }
      );
    }

    console.log("[API /scripts/settings PATCH] ✅ Settings updated successfully!");
    console.log("========================================\n");
    
    return NextResponse.json(data.result);
  } catch (error) {
    console.error("[API /scripts/settings PATCH] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

