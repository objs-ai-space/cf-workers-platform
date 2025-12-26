import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_D1 = process.env.CLOUDFLARE_API_TOKEN_D1!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database`;

// List all D1 databases
export async function GET() {
  try {
    console.log("[API /databases GET] Fetching all D1 databases");
    console.log("[API /databases GET] URL:", BASE_URL);
    
    const response = await fetch(BASE_URL, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_D1}`,
      },
    });

    const data = await response.json();
    console.log("[API /databases GET] Response status:", response.status);
    console.log("[API /databases GET] Databases count:", data.result?.length);

    if (!data.success) {
      console.error("[API /databases GET] Error:", data.errors);
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to fetch databases" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result);
  } catch (error) {
    console.error("[API /databases GET] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Create a new D1 database
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    console.log("========================================");
    console.log("[API /databases POST] CREATING D1 DATABASE");
    console.log("========================================");
    console.log("[API /databases POST] Database name:", name);
    console.log("[API /databases POST] Account ID:", CLOUDFLARE_ACCOUNT_ID);

    if (!name || typeof name !== "string") {
      console.error("[API /databases POST] Invalid database name");
      return NextResponse.json(
        { error: "Database name is required" },
        { status: 400 }
      );
    }

    console.log("[API /databases POST] Cloudflare API URL:", BASE_URL);

    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_D1}`,
      },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();
    console.log("[API /databases POST] Cloudflare response status:", response.status);
    console.log("[API /databases POST] Cloudflare response:", JSON.stringify(data, null, 2));

    if (!data.success) {
      console.error("[API /databases POST] Cloudflare error:", data.errors);
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to create database" },
        { status: response.status }
      );
    }

    console.log("[API /databases POST] ✅ Database created successfully!");
    console.log("[API /databases POST] Database UUID:", data.result?.uuid);
    console.log("========================================\n");
    
    return NextResponse.json(data.result, { status: 201 });
  } catch (error) {
    console.error("[API /databases POST] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

