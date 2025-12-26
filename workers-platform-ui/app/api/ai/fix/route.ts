import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

export async function POST(request: Request) {
  try {
    const { codeType, originalCode, issues, systemPrompt } = await request.json();

    if (!codeType || !originalCode || !issues) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const prompt = `Fix the following ${codeType} code:

=== ORIGINAL CODE ===
${originalCode}

=== ISSUES TO FIX ===
${issues.map((issue: { severity: string; description: string; fix: string; line?: string }, i: number) => 
  `${i + 1}. [${issue.severity}] ${issue.description}
   Location: ${issue.line || 'Unknown'}
   Fix: ${issue.fix}`
).join('\n\n')}

Generate the COMPLETE fixed ${codeType} code with all issues resolved.
Output ONLY the fixed code, no explanations.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 64000,
        stream: true,
        system: systemPrompt || "You are an expert debugger. Fix the code issues and output only the corrected code.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return NextResponse.json(
        { error: "Failed to fix code" },
        { status: response.status }
      );
    }

    // Return streaming response
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in bug fix:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

