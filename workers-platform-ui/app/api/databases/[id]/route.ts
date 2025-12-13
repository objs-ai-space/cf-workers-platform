import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_D1 = process.env.CLOUDFLARE_API_TOKEN_D1!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

const getBaseUrl = (id: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${id}`;

// Get database details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const response = await fetch(getBaseUrl(id), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_D1}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to fetch database" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result);
  } catch (error) {
    console.error("Error fetching database:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Delete database
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const response = await fetch(getBaseUrl(id), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_D1}`,
      },
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to delete database" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting database:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

