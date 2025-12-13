import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_READ = process.env.CLOUDFLARE_API_TOKEN_READ!;
const CLOUDFLARE_API_TOKEN_EDIT = process.env.CLOUDFLARE_API_TOKEN_EDIT!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

const getBaseUrl = (namespace: string, scriptName: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${namespace}/scripts/${scriptName}/secrets`;

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
        { error: data.errors?.[0]?.message || "Failed to fetch secrets" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result);
  } catch (error) {
    console.error("Error fetching secrets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string; scriptName: string }> }
) {
  try {
    const { name, scriptName } = await params;
    const body = await request.json();
    const { secretName, secretValue, type = "secret_text" } = body;

    if (!secretName || !secretValue) {
      return NextResponse.json(
        { error: "Secret name and value are required" },
        { status: 400 }
      );
    }

    const response = await fetch(getBaseUrl(name, scriptName), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_EDIT}`,
      },
      body: JSON.stringify({
        name: secretName,
        text: secretValue,
        type,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to add secret" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result, { status: 201 });
  } catch (error) {
    console.error("Error adding secret:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

