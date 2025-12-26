"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  SYSTEM_PROMPTS,
  generateAnalyzerPrompt,
  generateWorkerPrompt,
  generateSchemaPrompt,
  generateUIPrompt,
  generateReviewPrompt,
  generateBugFixPrompt,
} from "../lib/prompts";

// Dynamic import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/50 rounded-xl">
      <div className="w-6 h-6 border-2 border-white/20 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  ),
});

interface Namespace {
  namespace_id: string;
  namespace_name: string;
}

// Universal dispatcher URL - works for ALL namespaces
// URL Pattern: https://universal-dispatcher.embitious.workers.dev/{namespace}/{script}/...
const UNIVERSAL_DISPATCHER_URL = "https://universal-dispatcher.embitious.workers.dev";

// Convert namespace name to URL-safe format (spaces to dashes, lowercase)
const toUrlSafeNamespace = (namespace: string): string => {
  return namespace.toLowerCase().replace(/\s+/g, '-');
};

// Build dispatcher URL for a specific namespace and script
const getDispatcherUrl = (namespace: string, scriptName: string): string => {
  const urlSafeNamespace = toUrlSafeNamespace(namespace);
  return `${UNIVERSAL_DISPATCHER_URL}/${urlSafeNamespace}/${scriptName}`;
};

interface AppSpec {
  appName: string;
  description: string;
  features?: string[];
  database?: {
    tables?: Array<{
      name: string;
      description?: string;
      columns?: Array<{ name: string; type: string; constraints?: string }>;
    }>;
    sampleData?: boolean;
  };
  api?: {
    endpoints?: Array<{
      method: string;
      path: string;
      description: string;
      requestBody?: string;
      response?: string;
    }>;
  };
  ui?: {
    pages?: string[];
    components?: string[];
    style?: string;
  };
}

interface ReviewResult {
  valid: boolean;
  score: number;
  issues: Array<{
    severity: "critical" | "warning" | "info";
    location: string;
    description: string;
    fix: string;
  }>;
  summary: string;
  deploymentSteps: string[];
}

type Step = "idle" | "analyzing" | "schema" | "worker" | "ui" | "ready" | "deploying" | "deployed" | "reviewing" | "fixing" | "error";

interface AIBuilderProps {
  namespaces: Namespace[];
  onDeployComplete?: (result: { workerUrl: string; dbId: string }) => void;
}

export default function AIBuilder({ namespaces, onDeployComplete }: AIBuilderProps) {
  const [userRequest, setUserRequest] = useState("");
  const [selectedNamespace, setSelectedNamespace] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  
  // Generated content (state + refs for caching)
  const [spec, setSpec] = useState<AppSpec | null>(null);
  const [workerCode, setWorkerCode] = useState("");
  const [schemaSQL, setSchemaSQL] = useState("");
  const [uiHTML, setUIHTML] = useState("");
  const [review, setReview] = useState<ReviewResult | null>(null);
  
  // Refs to cache generated values (prevents loss during re-renders)
  const workerCodeRef = useRef("");
  const schemaSQLRef = useRef("");
  const uiHTMLRef = useRef("");
  
  // Deployment state
  const [deployError, setDeployError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Editor refs for auto-scroll
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerEditorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schemaEditorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uiEditorRef = useRef<any>(null);

  // Scroll editor to bottom
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollEditorToBottom = useCallback((editorRef: React.MutableRefObject<any>) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel?.();
      if (model) {
        const lineCount = model.getLineCount();
        editor.revealLine?.(lineCount);
      }
    }
  }, []);

  // Auto-scroll when streaming content updates
  useEffect(() => {
    if (isStreaming && workerCode) {
      scrollEditorToBottom(workerEditorRef);
    }
  }, [workerCode, isStreaming, scrollEditorToBottom]);

  useEffect(() => {
    if (isStreaming && schemaSQL) {
      scrollEditorToBottom(schemaEditorRef);
    }
  }, [schemaSQL, isStreaming, scrollEditorToBottom]);

  useEffect(() => {
    if (isStreaming && uiHTML) {
      scrollEditorToBottom(uiEditorRef);
    }
  }, [uiHTML, isStreaming, scrollEditorToBottom]);

  // Helper to strip markdown code fences from generated code
  const stripCodeFences = (text: string): string => {
    // Remove opening code fences with optional language tag
    let cleaned = text.replace(/^```(?:javascript|js|typescript|ts|sql|html|json|)\n?/gm, "");
    // Remove closing code fences
    cleaned = cleaned.replace(/\n?```$/gm, "");
    // Also remove fences that might be in the middle
    cleaned = cleaned.replace(/```(?:javascript|js|typescript|ts|sql|html|json|)\n/g, "");
    cleaned = cleaned.replace(/\n```\n/g, "\n");
    return cleaned.trim();
  };

  // Stream Claude response
  const streamGenerate = useCallback(async (
    prompt: string,
    systemPrompt: string,
    onChunk: (text: string) => void,
    maxTokens = 64000
  ): Promise<string> => {
    abortControllerRef.current = new AbortController();
    
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemPrompt, maxTokens }),
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      throw new Error("Failed to generate");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE events
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          
          try {
            const parsed = JSON.parse(data);
            // Handle Anthropic streaming events
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(fullText);
            } else if (parsed.type === "message_delta" && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(fullText);
            } else if (parsed.content && Array.isArray(parsed.content)) {
              // Handle non-streaming response format
              for (const block of parsed.content) {
                if (block.type === "text" && block.text) {
                  fullText += block.text;
                  onChunk(fullText);
                }
              }
            }
          } catch {
            // Log parse errors for debugging
            console.debug("SSE parse skip:", line.substring(0, 100));
          }
        } else if (line.startsWith("event: ")) {
          // Log event types for debugging
          console.debug("SSE event:", line);
        }
      }
    }

    console.log("Stream complete, fullText length:", fullText.length);
    return fullText;
  }, []);

  // Main generation flow
  // SEQUENTIAL GENERATION FLOW:
  // 1. Analyze → 2. Schema → 3. Worker (based on schema) → 4. UI (based on worker) → 5. Deploy
  const handleGenerate = async () => {
    if (!userRequest.trim() || !selectedNamespace) {
      setError("Please enter a request and select a namespace");
      return;
    }

    try {
      setError(null);
      setDeployError(null);
      setIsStreaming(true);
      setWorkerCode("");
      setSchemaSQL("");
      setUIHTML("");
      setReview(null);
      setRetryCount(0);

      // Step 1: Analyze request
      setStep("analyzing");
      const analyzerResult = await streamGenerate(
        generateAnalyzerPrompt(userRequest),
        SYSTEM_PROMPTS.analyzer,
        () => {},
        4096
      );

      let parsedSpec: AppSpec;
      try {
        const cleanJson = analyzerResult.replace(/```json\n?|\n?```/g, "").trim();
        console.log("Analyzer result (cleaned):", cleanJson);
        parsedSpec = JSON.parse(cleanJson);
        console.log("Parsed spec:", parsedSpec);
        console.log("Database tables:", parsedSpec.database?.tables);
        setSpec(parsedSpec);
      } catch (e) {
        console.error("Failed to parse spec:", e, analyzerResult);
        throw new Error("Failed to analyze request. Please try rephrasing.");
      }

      const apiBaseUrl = getDispatcherUrl(selectedNamespace, parsedSpec.appName);
      console.log("Using universal dispatcher URL:", apiBaseUrl);

      // Step 2: Generate Schema FIRST (foundation)
      setStep("schema");
      const schemaPrompt = generateSchemaPrompt(parsedSpec);
      console.log("Schema prompt:", schemaPrompt);
      const schemaResult = await streamGenerate(
        schemaPrompt,
        SYSTEM_PROMPTS.schemaGenerator,
        (text) => {
          const cleaned = stripCodeFences(text);
          schemaSQLRef.current = cleaned;
          setSchemaSQL(cleaned);
        },
        8192
      );
      console.log("Schema result length:", schemaResult?.length);
      const finalSchema = stripCodeFences(schemaResult);
      if (!finalSchema || finalSchema.trim().length === 0) {
        throw new Error("Schema generation returned empty result");
      }
      schemaSQLRef.current = finalSchema;
      setSchemaSQL(finalSchema);

      // Step 3: Generate Worker (based on schema)
      setStep("worker");
      const workerResult = await streamGenerate(
        generateWorkerPrompt(parsedSpec, finalSchema),
        SYSTEM_PROMPTS.workerGenerator,
        (text) => {
          const cleaned = stripCodeFences(text);
          workerCodeRef.current = cleaned;
          setWorkerCode(cleaned);
        },
        16384
      );
      console.log("Worker result length:", workerResult?.length);
      const finalWorker = stripCodeFences(workerResult);
      if (!finalWorker || finalWorker.trim().length === 0) {
        throw new Error("Worker generation returned empty result");
      }
      workerCodeRef.current = finalWorker;
      setWorkerCode(finalWorker);

      // Step 4: Generate UI (based on worker code)
      setStep("ui");
      const uiResult = await streamGenerate(
        generateUIPrompt(parsedSpec, apiBaseUrl, finalWorker),
        SYSTEM_PROMPTS.uiGenerator,
        (text) => {
          const cleaned = stripCodeFences(text);
          uiHTMLRef.current = cleaned;
          setUIHTML(cleaned);
        },
        64000  // Model max output tokens
      );
      console.log("UI result length:", uiResult?.length);
      const finalUI = stripCodeFences(uiResult);
      if (!finalUI || finalUI.trim().length === 0) {
        throw new Error("UI generation returned empty result");
      }
      uiHTMLRef.current = finalUI;
      setUIHTML(finalUI);

      // Log final values before setting ready
      console.log("Generation complete:");
      console.log("- Schema length:", finalSchema.length);
      console.log("- Worker length:", finalWorker.length);
      console.log("- UI length:", finalUI.length);
      console.log("- Refs - Schema:", schemaSQLRef.current.length, "Worker:", workerCodeRef.current.length, "UI:", uiHTMLRef.current.length);

      setStep("ready");
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setStep("error");
    } finally {
      setIsStreaming(false);
    }
  };

  // Deploy with automatic retry on failure
  const handleDeploy = async () => {
    // Use refs for reliable access to generated code
    const currentWorkerCode = workerCodeRef.current || workerCode;
    const currentSchemaSQL = schemaSQLRef.current || schemaSQL;
    const currentUIHTML = uiHTMLRef.current || uiHTML;
    
    console.log("========================================");
    console.log("🚀 DEPLOYMENT STARTED");
    console.log("========================================");
    console.log("📋 Deploy Configuration:");
    console.log("  - Selected Namespace:", selectedNamespace);
    console.log("  - App Name:", spec?.appName);
    console.log("  - Spec exists:", !!spec);
    console.log("  - Worker code length (ref/state):", workerCodeRef.current?.length, "/", workerCode?.length);
    console.log("  - Schema SQL length (ref/state):", schemaSQLRef.current?.length, "/", schemaSQL?.length);
    console.log("  - UI HTML length (ref/state):", uiHTMLRef.current?.length, "/", uiHTML?.length);
    
    const missing: string[] = [];
    if (!spec) missing.push("spec");
    if (!currentWorkerCode || currentWorkerCode.trim().length === 0) missing.push("workerCode");
    if (!currentSchemaSQL || currentSchemaSQL.trim().length === 0) missing.push("schemaSQL");
    if (!currentUIHTML || currentUIHTML.trim().length === 0) missing.push("uiHTML");
    
    if (missing.length > 0 || !spec) {
      console.error("❌ Missing required data:", missing);
      setError(`Missing generated code: ${missing.join(", ")}`);
      return;
    }
    
    // At this point spec is guaranteed to be non-null
    const appName = spec.appName;
    // Use the ref values for deployment
    const deployWorkerCode = currentWorkerCode;
    const deploySchemaSQL = currentSchemaSQL;
    const deployUIHTML = currentUIHTML;

    try {
      setStep("deploying");
      setError(null);
      setDeployError(null);

      // 1. Create D1 database
      console.log("\n📦 STEP 1: Creating D1 Database");
      const dbName = `${appName}-db-${Date.now()}`;
      console.log("  - Database name:", dbName);
      
      const dbResponse = await fetch("/api/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: dbName }),
      });

      const dbResult = await dbResponse.json();
      console.log("  - Response status:", dbResponse.status);
      console.log("  - Response data:", JSON.stringify(dbResult, null, 2));

      if (!dbResponse.ok) {
        throw new Error(`Database creation failed: ${dbResult.error || "Unknown error"}`);
      }

      const databaseId = dbResult.uuid;
      console.log("  ✅ Database created with ID:", databaseId);

      // 2. Execute schema on the database
      console.log("\n📝 STEP 2: Executing Schema SQL");
      const statements = deploySchemaSQL
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      
      console.log("  - Total SQL statements:", statements.length);

      for (let i = 0; i < statements.length; i++) {
        const sql = statements[i];
        console.log(`  - Executing statement ${i + 1}/${statements.length}:`, sql.substring(0, 60) + "...");
        
        const queryResponse = await fetch(`/api/databases/${databaseId}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql: sql + ";" }),
        });
        
        const queryResult = await queryResponse.json();
        console.log(`    - Status: ${queryResponse.status}, Success: ${queryResponse.ok}`);
        
        if (!queryResponse.ok) {
          console.error("    - Query error:", queryResult);
          throw new Error(`Schema execution failed: ${queryResult.error || sql.substring(0, 50)}`);
        }
      }
      console.log("  ✅ All schema statements executed successfully");

      // 3. Deploy Worker (API backend)
      console.log("\n⚙️ STEP 3: Deploying Worker API");
      console.log("  - Script name:", appName);
      console.log("  - Target namespace:", selectedNamespace);
      console.log("  - Worker code length:", deployWorkerCode.length, "chars");
      console.log("  - API URL:", `/api/namespaces/${selectedNamespace}/scripts`);
      
      const workerFormData = new FormData();
      workerFormData.append("scriptName", appName);
      workerFormData.append("script", deployWorkerCode);
      workerFormData.append("mainModule", "index.js");

      const workerResponse = await fetch(`/api/namespaces/${selectedNamespace}/scripts`, {
        method: "PUT",
        body: workerFormData,
      });

      const workerResult = await workerResponse.json();
      console.log("  - Response status:", workerResponse.status);
      console.log("  - Response data:", JSON.stringify(workerResult, null, 2));

      if (!workerResponse.ok) {
        throw new Error(`Worker deployment failed: ${workerResult.error || "Unknown error"}`);
      }
      console.log("  ✅ Worker API deployed successfully");

      // 4. Add D1 binding to worker
      console.log("\n🔗 STEP 4: Adding D1 Binding to Worker");
      console.log("  - Binding name: DB");
      console.log("  - Database ID:", databaseId);
      console.log("  - API URL:", `/api/namespaces/${selectedNamespace}/scripts/${appName}/settings`);
      
      const bindingPayload = {
        bindings: [{ name: "DB", type: "d1", id: databaseId }],
      };
      console.log("  - Binding payload:", JSON.stringify(bindingPayload, null, 2));
      
      const bindingResponse = await fetch(`/api/namespaces/${selectedNamespace}/scripts/${appName}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bindingPayload),
      });

      const bindingResult = await bindingResponse.json();
      console.log("  - Response status:", bindingResponse.status);
      console.log("  - Response data:", JSON.stringify(bindingResult, null, 2));

      if (!bindingResponse.ok) {
        throw new Error(`Binding failed: ${bindingResult.error || "Unknown error"}`);
      }
      console.log("  ✅ D1 binding added successfully");

      // 5. Deploy UI as static site worker
      console.log("\n🎨 STEP 5: Deploying UI Worker");
      const uiScriptName = `${appName}-ui`;
      console.log("  - UI Script name:", uiScriptName);
      console.log("  - Target namespace:", selectedNamespace);
      console.log("  - HTML content length:", deployUIHTML.length, "chars");
      
      const uiWorkerCode = `
// Static Site Worker - Generated by AI Builder
const HTML_CONTENT = ${JSON.stringify(deployUIHTML)};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML_CONTENT, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    
    return new Response("Not Found", { status: 404 });
  },
};
`.trim();

      console.log("  - UI worker code length:", uiWorkerCode.length, "chars");

      const uiFormData = new FormData();
      uiFormData.append("scriptName", uiScriptName);
      uiFormData.append("script", uiWorkerCode);
      uiFormData.append("mainModule", "index.js");

      const uiResponse = await fetch(`/api/namespaces/${selectedNamespace}/scripts`, {
        method: "PUT",
        body: uiFormData,
      });

      const uiResult = await uiResponse.json();
      console.log("  - Response status:", uiResponse.status);
      console.log("  - Response data:", JSON.stringify(uiResult, null, 2));

      if (!uiResponse.ok) {
        throw new Error(`UI deployment failed: ${uiResult.error || "Unknown error"}`);
      }
      console.log("  ✅ UI worker deployed successfully");

      // 6. Summary
      console.log("\n========================================");
      console.log("🎉 DEPLOYMENT COMPLETE!");
      console.log("========================================");
      console.log("📍 Deployment Summary:");
      console.log("  - Namespace:", selectedNamespace);
      console.log("  - URL-safe Namespace:", toUrlSafeNamespace(selectedNamespace));
      console.log("  - App Name:", appName);
      console.log("  - Database ID:", databaseId);
      console.log("  - API Worker:", appName);
      console.log("  - UI Worker:", uiScriptName);
      
      // Build URLs using universal dispatcher
      const apiUrl = getDispatcherUrl(selectedNamespace, appName);
      const uiUrl = getDispatcherUrl(selectedNamespace, uiScriptName);
      
      console.log("\n🔗 URLs (using universal dispatcher):");
      console.log("  - Universal Dispatcher:", UNIVERSAL_DISPATCHER_URL);
      console.log("  - API URL:", apiUrl);
      console.log("  - UI URL:", uiUrl);
      console.log("========================================\n");

      setStep("deployed");
      setRetryCount(0);
      
      if (onDeployComplete) {
        onDeployComplete({
          workerUrl: apiUrl,
          dbId: databaseId,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Deployment failed";
      console.error("\n❌ DEPLOYMENT ERROR:", errorMessage);
      console.error("Stack:", err);
      setDeployError(errorMessage);
      
      // If we haven't exceeded retries, trigger fix flow
      if (retryCount < MAX_RETRIES) {
        console.log("🔄 Triggering auto-fix flow, retry:", retryCount + 1, "/", MAX_RETRIES);
        setStep("reviewing");
        await handleReviewAndFix(errorMessage);
      } else {
        setError(`Deployment failed after ${MAX_RETRIES} retries: ${errorMessage}`);
        setStep("error");
      }
    }
  };

  // Review failed deployment and fix issues
  const handleReviewAndFix = async (deploymentError: string) => {
    if (!spec) return;

    try {
      setIsStreaming(true);
      
      // Step 1: Review the code to identify issues
      const reviewResult = await streamGenerate(
        generateReviewPrompt(workerCode, schemaSQL, uiHTML, deploymentError, spec),
        SYSTEM_PROMPTS.reviewer,
        () => {},
        4096
      );

      let parsedReview: ReviewResult;
      try {
        const cleanReview = reviewResult.replace(/```json\n?|\n?```/g, "").trim();
        parsedReview = JSON.parse(cleanReview);
        setReview(parsedReview);
      } catch (e) {
        console.error("Failed to parse review:", e);
        setError("Failed to analyze deployment error");
        setStep("error");
        return;
      }

      if (parsedReview.issues.length === 0) {
        setError("Could not identify issues to fix");
        setStep("error");
        return;
      }

      // Step 2: Fix the identified issues using targeted patches
      setStep("fixing");

      // Helper to apply patches to code
      const applyPatches = (code: string, patchesJson: string): string => {
        try {
          const cleanJson = patchesJson.replace(/```json\n?|\n?```/g, "").trim();
          const patches: Array<{ find: string; replace: string }> = JSON.parse(cleanJson);
          let result = code;
          let appliedCount = 0;
          
          for (const patch of patches) {
            if (patch.find && result.includes(patch.find)) {
              result = result.replace(patch.find, patch.replace);
              appliedCount++;
              console.log(`Applied patch: "${patch.find.substring(0, 50)}..." -> "${patch.replace.substring(0, 50)}..."`);
            } else {
              console.warn(`Patch not found in code: "${patch.find?.substring(0, 50)}..."`);
            }
          }
          
          console.log(`Applied ${appliedCount}/${patches.length} patches`);
          return result;
        } catch (e) {
          console.error("Failed to parse/apply patches:", e, patchesJson);
          return code; // Return original if patching fails
        }
      };

      // Group issues by location
      const workerIssues = parsedReview.issues.filter(i => i.location === "worker");
      const schemaIssues = parsedReview.issues.filter(i => i.location === "schema");
      const uiIssues = parsedReview.issues.filter(i => i.location === "ui");

      // Fix each component that has issues (targeted patches only)
      if (schemaIssues.length > 0) {
        const patchesResult = await streamGenerate(
          generateBugFixPrompt("schema", schemaSQLRef.current, schemaIssues),
          SYSTEM_PROMPTS.bugFixer,
          () => {}, // No streaming preview for patches
          2048
        );
        const patchedSchema = applyPatches(schemaSQLRef.current, patchesResult);
        schemaSQLRef.current = patchedSchema;
        setSchemaSQL(patchedSchema);
        console.log("Schema patched, new length:", patchedSchema.length);
      }

      if (workerIssues.length > 0) {
        const patchesResult = await streamGenerate(
          generateBugFixPrompt("worker", workerCodeRef.current, workerIssues),
          SYSTEM_PROMPTS.bugFixer,
          () => {},
          2048
        );
        const patchedWorker = applyPatches(workerCodeRef.current, patchesResult);
        workerCodeRef.current = patchedWorker;
        setWorkerCode(patchedWorker);
        console.log("Worker patched, new length:", patchedWorker.length);
      }

      if (uiIssues.length > 0) {
        const patchesResult = await streamGenerate(
          generateBugFixPrompt("ui", uiHTMLRef.current, uiIssues),
          SYSTEM_PROMPTS.bugFixer,
          () => {},
          2048
        );
        const patchedUI = applyPatches(uiHTMLRef.current, patchesResult);
        uiHTMLRef.current = patchedUI;
        setUIHTML(patchedUI);
        console.log("UI patched, new length:", patchedUI.length);
      }

      // Increment retry count and redeploy
      setRetryCount(prev => prev + 1);
      setIsStreaming(false);
      
      // Auto-redeploy after fixing
      await handleDeploy();

    } catch (err) {
      console.error("Fix error:", err);
      setError(err instanceof Error ? err.message : "Failed to fix issues");
      setStep("error");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
    setStep("idle");
  };

  const getStepStatus = (s: Step) => {
    const steps: Step[] = ["analyzing", "schema", "worker", "ui", "ready"];
    const currentIndex = steps.indexOf(step);
    const stepIndex = steps.indexOf(s);
    
    if (step === "deployed") return "completed";
    if (step === "deploying" && s !== "ready") return "completed";
    if (step === "reviewing" || step === "fixing") {
      // During fix cycle, show all generation steps as completed
      if (["analyzing", "schema", "worker", "ui"].includes(s)) return "completed";
      if (s === "ready") return "active";
    }
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            ✕
          </button>
        </div>
      )}

      {/* Progress Steps */}
      {step !== "idle" && (
        <div className="flex items-center gap-2 p-4 bg-white/[0.02] border border-white/5 rounded-xl overflow-x-auto">
          {(["analyzing", "schema", "worker", "ui", "ready"] as Step[]).map((s, i) => {
            const status = getStepStatus(s);
            const labels: Record<string, string> = {
              analyzing: "Analyze",
              schema: "Schema",
              worker: "Worker",
              ui: "UI",
              ready: "Ready",
            };
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all shrink-0
                  ${status === "completed" ? "bg-emerald-500 text-white" : ""}
                  ${status === "active" ? "bg-cyan-500 text-white animate-pulse" : ""}
                  ${status === "pending" ? "bg-white/10 text-white/40" : ""}
                `}>
                  {i + 1}
                </div>
                <span className={`text-xs whitespace-nowrap ${status === "active" ? "text-cyan-400 font-medium" : "text-white/50"}`}>
                  {labels[s]}
                </span>
                {i < 4 && (
                  <div className={`w-6 h-0.5 ${status === "completed" ? "bg-emerald-500" : "bg-white/10"}`} />
                )}
              </div>
            );
          })}
          {/* Show fix cycle indicator */}
          {(step === "reviewing" || step === "fixing") && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
              <div className="w-7 h-7 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs font-bold animate-pulse">
                FIX
              </div>
              <span className="text-xs text-yellow-400 font-medium whitespace-nowrap">
                {step === "reviewing" ? "Reviewing..." : `Fixing (${retryCount}/${MAX_RETRIES})`}
              </span>
            </div>
          )}
          {step === "deploying" && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold animate-pulse">
                DEP
              </div>
              <span className="text-xs text-blue-400 font-medium whitespace-nowrap">Deploying...</span>
            </div>
          )}
        </div>
      )}

      {/* FIRST ROW: AI Builder (left) | Code Review (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - AI Builder Input */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white">
              AI
            </div>
            <div>
              <h2 className="font-semibold">App Builder</h2>
              <p className="text-xs text-white/40">Describe your app in natural language</p>
            </div>
          </div>

          {/* Namespace Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-white/70">
              Target Namespace
            </label>
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              disabled={isStreaming}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50"
            >
              <option value="">Select a namespace...</option>
              {namespaces.map((ns) => (
                <option key={ns.namespace_id} value={ns.namespace_name}>
                  {ns.namespace_name}
                </option>
              ))}
            </select>
          </div>

          {/* Request Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-white/70">
              What do you want to build?
            </label>
            <textarea
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              disabled={isStreaming}
              placeholder="Example: Build a todo app where users can create, complete, and delete tasks. Include categories and due dates. Make it look modern with a dark theme."
              rows={4}
              className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Quick Examples */}
          {step === "idle" && (
            <div className="mb-4">
              <p className="text-xs text-white/40 mb-2">Quick examples:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Todo App", desc: "Build a todo app with tasks, categories, due dates, and priority levels. Dark theme with colorful accents." },
                  { label: "Blog", desc: "Create a simple blog with posts, comments, and author profiles. Include a rich text preview." },
                  { label: "Expenses", desc: "Build an expense tracker with categories, monthly reports, and budget goals visualization." },
                ].map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setUserRequest(ex.desc)}
                    className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {step === "idle" || step === "error" ? (
              <button
                onClick={handleGenerate}
                disabled={!userRequest.trim() || !selectedNamespace}
                className="flex-1 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                Generate App
              </button>
            ) : step === "ready" ? (
              <>
                <button
                  onClick={() => {
                    setStep("idle");
                    setSpec(null);
                    setWorkerCode("");
                    setSchemaSQL("");
                    setUIHTML("");
                    setReview(null);
                  }}
                  className="px-5 py-2.5 bg-white/10 text-white text-sm font-medium rounded-lg transition-all hover:bg-white/20"
                >
                  Reset
                </button>
                <button
                  onClick={handleDeploy}
                  className="flex-1 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  Deploy
                </button>
              </>
            ) : step === "deploying" ? (
              <button disabled className="flex-1 px-5 py-2.5 bg-yellow-500/20 text-yellow-400 text-sm font-medium rounded-lg flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                Deploying...
              </button>
            ) : step === "deployed" ? (
              <div className="flex-1 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-1">
                  ✅ Deployed Successfully
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-white/60">
                    <span className="text-white/40">Namespace:</span> <span className="text-cyan-400 font-mono">{selectedNamespace}</span>
                  </p>
                  <p className="text-xs text-white/60">
                    <span className="text-white/40">API Worker:</span> <span className="text-cyan-400 font-mono">{spec?.appName}</span>
                  </p>
                  <p className="text-xs text-white/60">
                    <span className="text-white/40">UI Worker:</span> <span className="text-cyan-400 font-mono">{spec?.appName}-ui</span>
                  </p>
                  <div className="pt-2 mt-2 border-t border-white/10 flex gap-4">
                    <a 
                      href={spec?.appName ? getDispatcherUrl(selectedNamespace, `${spec.appName}-ui`) : '#'} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-cyan-400 hover:underline text-xs"
                    >
                      Open UI →
                    </a>
                    <a 
                      href={spec?.appName ? `${getDispatcherUrl(selectedNamespace, spec.appName)}/api` : '#'} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-emerald-400 hover:underline text-xs"
                    >
                      Test API →
                    </a>
                  </div>
                  <p className="text-xs text-white/40 mt-2">
                    Universal Dispatcher: <span className="font-mono">{UNIVERSAL_DISPATCHER_URL}</span>
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleCancel}
                className="flex-1 px-5 py-2.5 bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-all hover:bg-red-500/30 flex items-center justify-center gap-2"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Spec Preview */}
          {spec && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-white/40">App:</span>
                <span className="text-sm text-cyan-400 font-mono">{spec.appName}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(spec.features || []).slice(0, 5).map((f, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400/80 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Code Review / Deploy Status */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
              deployError ? "bg-gradient-to-br from-red-500 to-orange-600" :
              step === "fixing" ? "bg-gradient-to-br from-yellow-500 to-amber-600" :
              "bg-gradient-to-br from-violet-500 to-purple-600"
            }`}>
              <span className="text-xs font-bold">{deployError ? "ERR" : step === "fixing" ? "FIX" : "LOG"}</span>
            </div>
            <div>
              <h2 className="font-semibold">
                {deployError ? "Deployment Failed" : step === "fixing" ? "Auto-Fixing" : "Status"}
              </h2>
              <p className="text-xs text-white/40">
                {deployError ? `Retry ${retryCount}/${MAX_RETRIES}` : 
                 step === "fixing" ? "AI is fixing issues..." : 
                 "Progress and review"}
              </p>
            </div>
          </div>

          {/* Deployment Error Display */}
          {deployError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <h4 className="text-xs font-medium text-red-400 uppercase mb-1">Error</h4>
              <p className="text-sm text-red-300/80 font-mono break-all">{deployError}</p>
            </div>
          )}

          {!review && !deployError && step === "idle" && (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center text-white/30">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center text-xs font-bold">LOG</div>
                <p className="text-sm">Status will appear here during generation</p>
              </div>
            </div>
          )}

          {!review && !deployError && step !== "idle" && step !== "ready" && step !== "deployed" && (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-white/50">
                  {step === "analyzing" && "Analyzing your request..."}
                  {step === "schema" && "Generating database schema..."}
                  {step === "worker" && "Creating worker API..."}
                  {step === "ui" && "Building frontend UI..."}
                  {step === "reviewing" && "Reviewing for issues..."}
                  {step === "fixing" && "Fixing identified issues..."}
                  {step === "deploying" && "Deploying to Cloudflare..."}
                </p>
              </div>
            </div>
          )}

          {review && (
            <div className="space-y-4">
              {/* Score Badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Quality Score</span>
                <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  review.score >= 8 ? "bg-emerald-500/20 text-emerald-400" :
                  review.score >= 5 ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-red-500/20 text-red-400"
                }`}>
                  {review.score}/10
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 bg-black/30 rounded-lg">
                <p className="text-sm text-white/70 leading-relaxed">{review.summary}</p>
              </div>

              {/* Issues */}
              {review.issues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide">Issues Found</h4>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {review.issues.map((issue, i) => (
                      <div key={i} className={`p-2.5 rounded-lg text-xs ${
                        issue.severity === "critical" ? "bg-red-500/10 border border-red-500/20 text-red-400" :
                        issue.severity === "warning" ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400" :
                        "bg-white/5 border border-white/10 text-white/60"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-medium ${
                            issue.severity === "critical" ? "bg-red-500/20" :
                            issue.severity === "warning" ? "bg-yellow-500/20" :
                            "bg-white/10"
                          }`}>
                            {issue.severity}
                          </span>
                          <span className="text-white/40">{issue.location}</span>
                        </div>
                        <p>{issue.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {review.issues.length === 0 && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                  <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">OK</div>
                  <p className="text-sm text-emerald-400">No issues found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECOND ROW: Code Editor - Split View (Always visible) */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
          <span className="text-sm text-white/50">Generated Code</span>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <span>Schema: {schemaSQLRef.current?.length || schemaSQL?.length || 0} chars</span>
            <span>Worker: {workerCodeRef.current?.length || workerCode?.length || 0} chars</span>
            <span>UI: {uiHTMLRef.current?.length || uiHTML?.length || 0} chars</span>
          </div>
        </div>

        {/* Split View - All Three Editors Always Visible */}
        <div className="grid grid-cols-3 divide-x divide-white/5">
          {/* Schema Editor - FIRST (foundation) */}
          <div className="flex flex-col">
            <div className="px-3 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-medium text-amber-400">Database Schema</span>
              {step === "schema" && <span className="text-xs text-amber-400 animate-pulse">Generating...</span>}
            </div>
            <div className="h-[400px]">
              <MonacoEditor
                height="100%"
                language="sql"
                value={schemaSQL}
                onChange={(value) => {
                  const v = value || "";
                  schemaSQLRef.current = v;
                  setSchemaSQL(v);
                }}
                onMount={(editor) => { schemaEditorRef.current = editor; }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  readOnly: isStreaming,
                }}
              />
            </div>
          </div>

          {/* Worker Editor - SECOND (based on schema) */}
          <div className="flex flex-col">
            <div className="px-3 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-medium text-cyan-400">Worker API</span>
              {step === "worker" && <span className="text-xs text-cyan-400 animate-pulse">Generating...</span>}
            </div>
            <div className="h-[400px]">
              <MonacoEditor
                height="100%"
                language="javascript"
                value={workerCode}
                onChange={(value) => {
                  const v = value || "";
                  workerCodeRef.current = v;
                  setWorkerCode(v);
                }}
                onMount={(editor) => { workerEditorRef.current = editor; }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  readOnly: isStreaming,
                }}
              />
            </div>
          </div>

          {/* UI Editor - THIRD (based on worker) */}
          <div className="flex flex-col">
            <div className="px-3 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-medium text-pink-400">Frontend UI</span>
              {step === "ui" && <span className="text-xs text-pink-400 animate-pulse">Generating...</span>}
            </div>
            <div className="h-[400px]">
              <MonacoEditor
                height="100%"
                language="html"
                value={uiHTML}
                onChange={(value) => {
                  const v = value || "";
                  uiHTMLRef.current = v;
                  setUIHTML(v);
                }}
                onMount={(editor) => { uiEditorRef.current = editor; }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  readOnly: isStreaming,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


