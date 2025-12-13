import { NextResponse } from "next/server";

const CLOUDFLARE_API_TOKEN_READ = process.env.CLOUDFLARE_API_TOKEN_READ!;
const CLOUDFLARE_API_TOKEN_EDIT = process.env.CLOUDFLARE_API_TOKEN_EDIT!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

const getBaseUrl = (namespace: string, scriptName: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/dispatch/namespaces/${namespace}/scripts/${scriptName}/content`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string; scriptName: string }> }
) {
  try {
    const { name, scriptName } = await params;

    // Content endpoint requires write permissions
    const response = await fetch(getBaseUrl(name, scriptName), {
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_EDIT}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch script content" },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    
    if (contentType.includes("multipart/form-data")) {
      const text = await response.text();
      const scripts: { name: string; content: string }[] = [];
      
      // Extract boundary from content-type header
      const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const parts = text.split(`--${boundary}`);
        
        for (const part of parts) {
          if (part.trim() === "" || part.trim() === "--") continue;
          
          // Look for filename in Content-Disposition
          const filenameMatch = part.match(/Content-Disposition:[^;]*;[^;]*filename="([^"]+)"/i);
          const nameMatch = part.match(/Content-Disposition:[^;]*;[^;]*name="([^"]+)"/i);
          
          const fileName = filenameMatch?.[1] || nameMatch?.[1];
          if (!fileName) continue;
          
          // Find the content after the headers (double newline)
          const headerEndIndex = part.indexOf("\r\n\r\n");
          if (headerEndIndex === -1) continue;
          
          let content = part.slice(headerEndIndex + 4);
          // Remove trailing boundary marker if present
          content = content.replace(/\r\n--$/, "").replace(/\r\n$/, "");
          
          if (content.trim()) {
            scripts.push({ name: fileName, content });
          }
        }
      }
      
      return NextResponse.json({ scripts });
    }
    
    const content = await response.text();
    return NextResponse.json({ scripts: [{ name: "index.js", content }] });
  } catch (error) {
    console.error("Error fetching content:", error);
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
    const { content, mainModule = "index.js" } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const formData = new FormData();
    formData.append(
      mainModule,
      new Blob([content], { type: "application/javascript+module" }),
      mainModule
    );

    const response = await fetch(getBaseUrl(name, scriptName), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN_EDIT}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.errors?.[0]?.message || "Failed to update content" },
        { status: response.status }
      );
    }

    return NextResponse.json(data.result);
  } catch (error) {
    console.error("Error updating content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

