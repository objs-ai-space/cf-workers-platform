import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_EDIT = process.env.CLOUDFLARE_API_TOKEN_EDIT!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

const getBaseUrl = (namespace: string, scriptName: string, tag: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${namespace}/scripts/${scriptName}/tags/${tag}`;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ name: string; scriptName: string; tag: string }> }
) {
  try {
    const { name, scriptName, tag } = await params;

    const response = await fetch(getBaseUrl(name, scriptName, tag), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_EDIT}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to delete tag" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

