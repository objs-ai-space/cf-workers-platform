import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_READ = process.env.CLOUDFLARE_API_TOKEN_READ!;
const CLOUDFLARE_API_TOKEN_D1 = process.env.CLOUDFLARE_API_TOKEN_D1!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

// Get all available resources for binding
export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  try {
    const resources: Record<string, unknown[]> = {};

    // Fetch D1 databases
    if (!type || type === "d1") {
      const d1Response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database`,
        {
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_D1}`,
          },
        }
      );
      const d1Data = await d1Response.json();
      if (d1Data.success) {
        resources.d1_databases = d1Data.result.map((db: { uuid: string; name: string }) => ({
          id: db.uuid,
          name: db.name,
        }));
      }
    }

    // Fetch KV namespaces
    if (!type || type === "kv") {
      const kvResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`,
        {
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_READ}`,
          },
        }
      );
      const kvData = await kvResponse.json();
      if (kvData.success) {
        resources.kv_namespaces = kvData.result.map((kv: { id: string; title: string }) => ({
          id: kv.id,
          name: kv.title,
        }));
      }
    }

    // Fetch R2 buckets
    if (!type || type === "r2") {
      const r2Response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets`,
        {
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_READ}`,
          },
        }
      );
      const r2Data = await r2Response.json();
      if (r2Data.success) {
        resources.r2_buckets = r2Data.result?.buckets?.map((r2: { name: string }) => ({
          id: r2.name,
          name: r2.name,
        })) || [];
      }
    }

    return NextResponse.json(resources);
  } catch (error) {
    console.error("Error fetching resources:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

