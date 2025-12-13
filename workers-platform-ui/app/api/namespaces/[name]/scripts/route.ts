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

    const response = await fetch(getBaseUrl(name), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_READ}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to fetch scripts" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result);
  } catch (error) {
    console.error("Error fetching scripts:", error);
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

    if (!scriptName || !scriptContent) {
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

    const uploadFormData = new FormData();
    uploadFormData.append("metadata", JSON.stringify(metadata));
    uploadFormData.append(
      mainModule,
      new Blob([scriptContent], { type: "application/javascript+module" }),
      mainModule
    );

    const response = await fetch(`${getBaseUrl(name)}/${scriptName}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_EDIT}`,
      },
      body: uploadFormData,
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to upload script" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result, { status: 201 });
  } catch (error) {
    console.error("Error uploading script:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

