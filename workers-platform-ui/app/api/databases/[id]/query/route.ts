import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_D1 = process.env.CLOUDFLARE_API_TOKEN_D1!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

// Validate SQL to prevent dangerous operations
function validateSQL(sql: string): { valid: boolean; error?: string } {
  const normalized = sql.toUpperCase().trim();

  // Block dangerous patterns
  const blockedPatterns = [
    { pattern: /ATTACH\s+DATABASE/i, message: "ATTACH DATABASE not allowed" },
    { pattern: /DETACH\s+DATABASE/i, message: "DETACH DATABASE not allowed" },
    { pattern: /PRAGMA\s+(?!table_info|table_list)/i, message: "Most PRAGMA commands not allowed" },
  ];

  for (const { pattern, message } of blockedPatterns) {
    if (pattern.test(normalized)) {
      return { valid: false, error: message };
    }
  }

  return { valid: true };
}

// Execute SQL query
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sql, params: sqlParams } = body;

    if (!sql || typeof sql !== "string") {
      return NextResponse.json(
        { error: "SQL query is required" },
        { status: 400 }
      );
    }

    // Validate SQL
    const validation = validateSQL(sql);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${id}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_D1}`,
        },
        body: JSON.stringify({
          sql,
          params: sqlParams || [],
        }),
      }
    );

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Query failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result);
  } catch (error) {
    console.error("Error executing query:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

