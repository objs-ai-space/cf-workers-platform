// Prompt templates for AI-powered full-stack application generation

export const SYSTEM_PROMPTS = {
  // Step 0: Analyze user request and create a detailed plan
  analyzer: `You are an expert full-stack application architect specializing in Cloudflare Workers and D1 databases.

Your task is to analyze a user's natural language request and create a detailed technical specification for building a complete full-stack application.

The application will be built using:
- **Backend**: Cloudflare Worker (JavaScript/ES modules) with D1 database binding
- **Database**: Cloudflare D1 (SQLite-compatible)
- **Frontend**: Static HTML/CSS/JS served as a Worker

Respond with a JSON object (no markdown, just valid JSON):
{
  "appName": "kebab-case-name",
  "description": "Brief description of the app",
  "features": ["feature1", "feature2"],
  "database": {
    "tables": [
      {
        "name": "table_name",
        "description": "What this table stores",
        "columns": [
          {"name": "column_name", "type": "TEXT|INTEGER|REAL|BLOB", "constraints": "PRIMARY KEY|NOT NULL|UNIQUE|etc"}
        ]
      }
    ],
    "sampleData": true
  },
  "api": {
    "endpoints": [
      {
        "method": "GET|POST|PUT|DELETE",
        "path": "/path",
        "description": "What this endpoint does",
        "requestBody": "description if POST/PUT",
        "response": "description of response"
      }
    ]
  },
  "ui": {
    "pages": ["page1", "page2"],
    "components": ["component1", "component2"],
    "style": "modern|minimal|colorful"
  }
}`,

  // Step 1: Generate D1 database schema (FIRST - foundation)
  schemaGenerator: `You are an expert database architect specializing in SQLite/D1.

Generate SQL statements to create the database schema. Include:
- CREATE TABLE statements with proper constraints
- CREATE INDEX statements for frequently queried columns
- INSERT statements for realistic sample data (at least 5-10 rows per table)

Rules:
- Use appropriate SQLite data types (TEXT, INTEGER, REAL, BLOB)
- Include proper PRIMARY KEY, NOT NULL, UNIQUE constraints
- Use foreign keys where appropriate
- Add indexes for columns used in WHERE clauses
- Generate realistic, diverse sample data
- Use INTEGER PRIMARY KEY for auto-increment IDs
- Include created_at/updated_at timestamps where appropriate

IMPORTANT: Output ONLY SQL statements, no markdown code blocks, no explanations. Each statement should end with a semicolon.`,

  // Step 2: Generate Worker API code (based on schema)
  workerGenerator: `You are an expert Cloudflare Worker developer. Generate a complete, production-ready Worker script.

Requirements:
- Use ES modules syntax (export default { fetch(request, env, ctx) { ... } })
- Use env.DB for D1 database access (binding name is always "DB")
- Include proper CORS headers for all responses
- Handle all HTTP methods appropriately
- Include comprehensive error handling
- Use async/await for all database operations
- Return proper JSON responses with appropriate status codes
- Match the SQL queries EXACTLY to the provided database schema

Database operations example:
\`\`\`javascript
// Query
const { results } = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).all();

// Insert
const info = await env.DB.prepare("INSERT INTO users (name, email) VALUES (?, ?)").bind(name, email).run();

// Update
await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, id).run();

// Delete
await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
\`\`\`

IMPORTANT: Output ONLY the JavaScript code, no markdown code blocks, no explanations. Start directly with the code.`,

  // Step 3: Generate static site UI (based on worker API)
  uiGenerator: `You are an expert frontend developer specializing in vanilla HTML/CSS/JavaScript.

Generate a PURE HTML FILE (NOT a Worker script). The output must be a standalone index.html file.

CRITICAL STRUCTURE:
- Start with <!DOCTYPE html>
- All CSS in a <style> tag in <head>
- All JavaScript in a <script> tag before </body>
- Define API_BASE as: const API_BASE = 'YOUR_URL_HERE'; at the start of the script

Requirements:
- All HTML, CSS, and JavaScript in ONE .html file
- Modern, responsive design with CSS Grid/Flexbox
- Use a distinctive, non-generic aesthetic (avoid typical "AI-generated" look)
- Include loading states and error handling
- Use fetch() for API calls with the API_BASE constant
- MATCH THE API ENDPOINTS EXACTLY as provided in the worker code
- Include smooth animations and micro-interactions
- Mobile-friendly responsive design
- Dark mode preferred with vibrant accent colors

Style Guidelines:
- Use CSS custom properties (variables) for theming
- Include subtle gradients and shadows
- Add hover/focus states for interactive elements
- Use modern fonts from Google Fonts (NOT Inter/Roboto/Arial)
- Include iconography (use inline SVG or emoji)

JavaScript Guidelines:
- Define const API_BASE = '...' at the very start of your script
- Use modern ES6+ syntax
- Async/await for fetch calls
- DOM manipulation with querySelector
- Event delegation where appropriate
- Form validation

DO NOT generate a Cloudflare Worker script. DO NOT wrap HTML in a JavaScript string.
Output ONLY the HTML file, starting with <!DOCTYPE html>.`,

  // Step 4: Review and validate (after deployment failure)
  reviewer: `You are a senior full-stack engineer debugging a failed Cloudflare Workers deployment.

Analyze the error and the code to identify:
1. **Syntax Errors**: JavaScript/SQL syntax issues
2. **API Mismatches**: UI calls not matching Worker endpoints
3. **Schema Issues**: Worker queries not matching table/column names
4. **Runtime Errors**: Issues that would cause crashes
5. **Type Errors**: Data type mismatches

Respond with a JSON object (no markdown, just valid JSON):
{
  "valid": false,
  "issues": [
    {
      "severity": "critical|warning|info",
      "location": "worker|schema|ui",
      "line": "approximate line number or code snippet",
      "description": "What's wrong",
      "fix": "Exact code fix needed"
    }
  ],
  "summary": "Brief explanation of what went wrong"
}`,

  // Step 5: Fix bug agent - generates corrected code
  bugFixer: `You are an expert debugger for Cloudflare Workers applications.

Given the original code and the identified issues, generate the COMPLETE FIXED CODE.

Rules:
- Fix ALL identified issues
- Maintain the same overall structure
- Keep all working functionality intact
- Only modify what needs to be fixed
- Ensure all API endpoints, database queries, and UI calls are consistent

IMPORTANT: Output ONLY the fixed code, no markdown code blocks, no explanations.`,
};

export const generateAnalyzerPrompt = (userRequest: string) => `
Analyze this user request and create a detailed technical specification:

USER REQUEST:
${userRequest}

Remember to respond with ONLY a valid JSON object, no markdown formatting.
`;

// Step 1: Schema generation (first step after analysis)
export const generateSchemaPrompt = (spec: {
  appName: string;
  database?: { 
    tables?: Array<{ 
      name: string; 
      description?: string;
      columns?: Array<{ name: string; type: string; constraints?: string }> 
    }>;
    sampleData?: boolean;
  };
}) => {
  const tables = spec.database?.tables || [];
  const tablesDescription = tables.length > 0 
    ? tables.map(t => `
TABLE: ${t.name}
Description: ${t.description || 'Data table'}
Columns:
${(t.columns || []).map(c => `  - ${c.name} ${c.type} ${c.constraints || ''}`).join('\n')}
`).join('\n')
    : 'Design appropriate tables based on the app requirements.';

  return `
Generate SQL schema for this application:

APP NAME: ${spec.appName}

TABLES:
${tablesDescription}

${spec.database?.sampleData !== false ? 'Include INSERT statements with realistic sample data (5-10 rows per table).' : ''}

Generate the SQL now. Output ONLY SQL statements, no explanations.
`;
};

// Step 2: Worker generation (based on schema)
export const generateWorkerPrompt = (spec: {
  appName: string;
  description: string;
  api?: { endpoints?: Array<{ method: string; path: string; description: string; requestBody?: string; response?: string }> };
  database?: { tables?: Array<{ name: string; columns?: Array<{ name: string; type: string }> }> };
}, schemaSQL: string) => {
  const endpoints = spec.api?.endpoints || [];
  const endpointsDescription = endpoints.length > 0
    ? endpoints.map(e => `- ${e.method} ${e.path}: ${e.description}${e.requestBody ? ` | Body: ${e.requestBody}` : ''}`).join('\n')
    : 'Design appropriate CRUD API endpoints based on the schema.';

  return `
Generate a Cloudflare Worker script for this application:

APP NAME: ${spec.appName}
DESCRIPTION: ${spec.description}

=== DATABASE SCHEMA (use these EXACT table and column names) ===
${schemaSQL}

=== API ENDPOINTS TO IMPLEMENT ===
${endpointsDescription}

Generate the complete Worker code now. The SQL queries MUST match the schema above exactly.
Output ONLY JavaScript code, no explanations.
`;
};

// Step 3: UI generation (based on worker code)
export const generateUIPrompt = (spec: {
  appName: string;
  description: string;
  api?: { endpoints?: Array<{ method: string; path: string; description: string }> };
  ui?: { pages?: string[]; components?: string[]; style?: string };
}, apiBaseUrl: string, workerCode: string) => {
  const pages = spec.ui?.pages?.join(', ') || 'Main page with all features';
  const components = spec.ui?.components?.join(', ') || 'Forms, lists, and interactive elements';
  const style = spec.ui?.style || 'modern dark theme';

  return `
Generate a PURE HTML FILE (index.html) for:

APP NAME: ${spec.appName}
DESCRIPTION: ${spec.description}
STYLE: ${style}

PAGES/SECTIONS: ${pages}
COMPONENTS: ${components}

=== WORKER API ENDPOINTS (match these EXACTLY) ===
${workerCode.substring(0, 4000)}${workerCode.length > 4000 ? '\n...(truncated)' : ''}

REQUIRED STRUCTURE:
1. Start with <!DOCTYPE html>
2. <head> with <style> for all CSS
3. <body> with HTML content
4. <script> tag at end with JavaScript that starts with:
   const API_BASE = '${apiBaseUrl}';

Example API call pattern:
  fetch(\`\${API_BASE}/api/items\`)
  fetch(\`\${API_BASE}/api/items/\${id}\`, { method: 'DELETE' })

DO NOT generate a Cloudflare Worker. DO NOT wrap HTML in JavaScript strings.
Output ONLY the HTML file content starting with <!DOCTYPE html>.
`;
};

// Step 4: Review prompt (for failed deployment)
export const generateReviewPrompt = (
  workerCode: string,
  schemaSQL: string,
  uiHTML: string,
  error: string,
  spec: { appName: string; description: string }
) => `
Debug this failed deployment:

APP: ${spec.appName}
DESCRIPTION: ${spec.description}

=== DEPLOYMENT ERROR ===
${error}

=== WORKER CODE ===
${workerCode}

=== DATABASE SCHEMA ===
${schemaSQL}

=== UI HTML ===
${uiHTML.substring(0, 3000)}${uiHTML.length > 3000 ? '...(truncated)' : ''}

Analyze the error and code to identify all issues.
Respond with ONLY a valid JSON object containing your analysis.
`;

// Step 5: Bug fix prompt - generates targeted patches instead of full code
export const generateBugFixPrompt = (
  codeType: 'worker' | 'schema' | 'ui',
  originalCode: string,
  issues: Array<{ severity: string; description: string; fix: string; line?: string }>
) => `
Fix ONLY the problematic parts of this ${codeType} code. Do NOT rewrite the entire code.

=== ORIGINAL CODE ===
${originalCode}

=== ISSUES TO FIX ===
${issues.map((issue, i) => `${i + 1}. [${issue.severity}] ${issue.description}
   Location: ${issue.line || 'Unknown'}
   Fix: ${issue.fix}`).join('\n\n')}

Respond with a JSON array of targeted replacements. Each replacement specifies:
- "find": exact string to find in the original code (must match exactly, including whitespace)
- "replace": the corrected string to replace it with

Example response format:
[
  {"find": "UNIQUE constraint ride_id", "replace": "ride_id"},
  {"find": "driver_id NOT NULL", "replace": "driver_id"}
]

IMPORTANT:
- Only include the minimal changes needed to fix the issues
- The "find" string must exist EXACTLY in the original code
- Keep changes as small as possible (single lines or small blocks)
- Output ONLY the JSON array, no explanations
`;
