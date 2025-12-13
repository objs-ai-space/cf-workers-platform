import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_READ = process.env.CLOUDFLARE_API_TOKEN_READ!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

const getBaseUrl = (namespace: string, scriptName: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${namespace}/scripts/${scriptName}/bindings`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string; scriptName: string }> }
) {
  try {
    const { name, scriptName } = await params;

    const response = await fetch(getBaseUrl(name, scriptName), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_READ}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to fetch bindings" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result);
  } catch (error) {
    console.error("Error fetching bindings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

