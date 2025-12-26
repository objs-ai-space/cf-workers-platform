import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_READ = process.env.CLOUDFLARE_API_TOKEN_READ!;
const CLOUDFLARE_API_TOKEN_EDIT = process.env.CLOUDFLARE_API_TOKEN_EDIT!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

const getBaseUrl = (namespace: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${namespace}/scripts`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    console.log("[API /namespaces/scripts GET] Fetching scripts for namespace:", name);
    console.log("[API /namespaces/scripts GET] URL:", getBaseUrl(name));

    const response = await fetch(getBaseUrl(name), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_READ}`,
      },
    });

    const data = await response.json();
    console.log("[API /namespaces/scripts GET] Response status:", response.status);
    console.log("[API /namespaces/scripts GET] Response success:", data.success);

    if (!data.success) {
      console.error("[API /namespaces/scripts GET] Error:", data.errors);
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to fetch scripts" },
        { status: response.status }
      );
    }

    console.log("[API /namespaces/scripts GET] Scripts count:", data.result?.length);
    return NextResponse.json(data.result);
  } catch (error) {
    console.error("[API /namespaces/scripts GET] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const formData = await request.formData();
    const scriptName = formData.get("scriptName") as string;
    const scriptContent = formData.get("script") as string;
    const mainModule = formData.get("mainModule") as string || "index.js";

    console.log("========================================");
    console.log("[API /namespaces/scripts PUT] DEPLOYING WORKER");
    console.log("========================================");
    console.log("[API /namespaces/scripts PUT] Namespace:", name);
    console.log("[API /namespaces/scripts PUT] Script name:", scriptName);
    console.log("[API /namespaces/scripts PUT] Main module:", mainModule);
    console.log("[API /namespaces/scripts PUT] Script content length:", scriptContent?.length || 0, "chars");
    console.log("[API /namespaces/scripts PUT] Account ID:", CLOUDFLARE_ACCOUNT_ID);

    if (!scriptName || !scriptContent) {
      console.error("[API /namespaces/scripts PUT] Missing required fields");
      return NextResponse.json(
        { error: "Script name and content are required" },
        { status: 400 }
      );
    }

    const metadata = {
      main_module: mainModule,
      compatibility_date: new Date().toISOString().split("T")[0],
      compatibility_flags: ["nodejs_compat"],
    };
    console.log("[API /namespaces/scripts PUT] Metadata:", JSON.stringify(metadata));

    const uploadFormData = new FormData();
    uploadFormData.append("metadata", JSON.stringify(metadata));
    uploadFormData.append(
      mainModule,
      new Blob([scriptContent], { type: "application/javascript+module" }),
      mainModule
    );

    const cfApiUrl = `${getBaseUrl(name)}/${scriptName}`;
    console.log("[API /namespaces/scripts PUT] Cloudflare API URL:", cfApiUrl);

    const response = await fetch(cfApiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_EDIT}`,
      },
      body: uploadFormData,
    });

    const data = await response.json();
    console.log("[API /namespaces/scripts PUT] Cloudflare response status:", response.status);
    console.log("[API /namespaces/scripts PUT] Cloudflare response:", JSON.stringify(data, null, 2));

    if (!data.success) {
      console.error("[API /namespaces/scripts PUT] Cloudflare error:", data.errors);
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to upload script" },
        { status: response.status }
      );
    }

    console.log("[API /namespaces/scripts PUT] ✅ Worker deployed successfully!");
    console.log("[API /namespaces/scripts PUT] Worker ID:", data.result?.id);
    console.log("========================================\n");
    
    return NextResponse.json(data.result, { status: 201 });
  } catch (error) {
    console.error("[API /namespaces/scripts PUT] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

