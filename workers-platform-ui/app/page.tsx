"use client";

import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import dynamic from "next/dynamic";

// Dynamic import AIBuilder to avoid SSR issues with Monaco
const AIBuilder = dynamic(() => import("./components/AIBuilder"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-2 border-white/20 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  ),
});

interface Namespace {
  namespace_id: string;
  namespace_name: string;
  script_count: number;
  created_on: string;
  modified_on: string;
}

interface Script {
  id: string;
  created_on: string;
  modified_on: string;
  tag: string;
  tags: string[];
  etag: string;
  handlers: string[];
  compatibility_date: string;
  compatibility_flags: string[];
  usage_model: string;
  logpush: boolean;
  has_assets: boolean;
  has_modules: boolean;
}

interface ScriptDetails {
  dispatch_namespace: string;
  created_on: string;
  modified_on: string;
  script: Script;
}

interface Binding {
  name: string;
  type: string;
  [key: string]: unknown;
}

interface Secret {
  name: string;
  type: string;
}

interface Settings {
  compatibility_date: string;
  compatibility_flags: string[];
  usage_model: string;
  tags: string[];
  logpush: boolean;
  bindings: Binding[];
  placement?: { mode?: string };
  tail_consumers?: unknown[];
}

interface Database {
  uuid: string;
  name: string;
  created_at: string;
  version: string;
  num_tables: number;
  file_size: number;
}

interface TableInfo {
  name: string;
  sql: string;
}

interface Column {
  name: string;
  type: "TEXT" | "INTEGER" | "REAL" | "BLOB";
  primaryKey: boolean;
  notNull: boolean;
  unique: boolean;
  defaultValue: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  meta?: {
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

interface AvailableResource {
  id: string;
  name: string;
}

interface AvailableResources {
  d1_databases: AvailableResource[];
  kv_namespaces: AvailableResource[];
  r2_buckets: AvailableResource[];
}

type BindingType = "d1" | "kv_namespace" | "r2_bucket" | "plain_text" | "secret_text" | "service";

interface NewBinding {
  name: string;
  type: BindingType;
  // D1
  database_id?: string;
  // KV
  namespace_id?: string;
  // R2
  bucket_name?: string;
  // Plain text
  text?: string;
  // Service
  service?: string;
  environment?: string;
}

type View = "namespaces" | "scripts" | "script-detail" | "databases" | "database-detail" | "static-sites" | "ai-builder";

export default function Home() {
  // Navigation state
  const [view, setView] = useState<View>("namespaces");
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);

  // Data state
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scriptDetails, setScriptDetails] = useState<ScriptDetails | null>(null);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState<{ name: string; content: string }[]>([]);

  // Database state
  const [databases, setDatabases] = useState<Database[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Schema builder state
  const [newTableName, setNewTableName] = useState("");
  const [columns, setColumns] = useState<Column[]>([
    { name: "", type: "TEXT", primaryKey: false, notNull: false, unique: false, defaultValue: "" }
  ]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "bindings" | "secrets" | "settings" | "tags" | "content">("overview");
  const [dbActiveTab, setDbActiveTab] = useState<"tables" | "query" | "schema">("tables");

  // Modal states
  const [showCreateNamespace, setShowCreateNamespace] = useState(false);
  const [showUploadScript, setShowUploadScript] = useState(false);
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; name: string; id?: string } | null>(null);
  const [showCreateDatabase, setShowCreateDatabase] = useState(false);
  const [showAddBinding, setShowAddBinding] = useState(false);

  // Binding management state
  const [availableResources, setAvailableResources] = useState<AvailableResources>({
    d1_databases: [],
    kv_namespaces: [],
    r2_buckets: [],
  });
  const [newBinding, setNewBinding] = useState<NewBinding>({
    name: "",
    type: "d1",
  });
  const [bindingLoading, setBindingLoading] = useState(false);

  // Static site state
  const [staticSiteName, setStaticSiteName] = useState("");
  const [staticSiteHtml, setStaticSiteHtml] = useState("");
  const [staticSiteNamespace, setStaticSiteNamespace] = useState("");
  const [staticSiteDeploying, setStaticSiteDeploying] = useState(false);
  const [staticSiteUrl, setStaticSiteUrl] = useState<string | null>(null);

  // Form states
  const [newNamespaceName, setNewNamespaceName] = useState("");
  const [newScriptName, setNewScriptName] = useState("");
  const [newScriptContent, setNewScriptContent] = useState(`export default {
  async fetch(request, env, ctx) {
    return new Response("Hello World!");
  },
};`);
  const [newSecretName, setNewSecretName] = useState("");
  const [newSecretValue, setNewSecretValue] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newDatabaseName, setNewDatabaseName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selection states for bulk delete
  const [selectedNamespaces, setSelectedNamespaces] = useState<Set<string>>(new Set());
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ current: number; total: number } | null>(null);

  // Fetch namespaces
  const fetchNamespaces = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/namespaces");
      if (!response.ok) throw new Error("Failed to fetch namespaces");
      const data = await response.json();
      setNamespaces(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch scripts for a namespace
  const fetchScripts = useCallback(async (namespace: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/namespaces/${namespace}/scripts`);
      if (!response.ok) throw new Error("Failed to fetch scripts");
      const data = await response.json();
      setScripts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch script details
  const fetchScriptDetails = useCallback(async (namespace: string, scriptName: string) => {
    try {
      setLoading(true);
      const [detailsRes, bindingsRes, secretsRes, settingsRes, tagsRes, contentRes] = await Promise.all([
        fetch(`/api/namespaces/${namespace}/scripts/${scriptName}`),
        fetch(`/api/namespaces/${namespace}/scripts/${scriptName}/bindings`),
        fetch(`/api/namespaces/${namespace}/scripts/${scriptName}/secrets`),
        fetch(`/api/namespaces/${namespace}/scripts/${scriptName}/settings`),
        fetch(`/api/namespaces/${namespace}/scripts/${scriptName}/tags`),
        fetch(`/api/namespaces/${namespace}/scripts/${scriptName}/content`),
      ]);

      if (detailsRes.ok) setScriptDetails(await detailsRes.json());
      if (bindingsRes.ok) setBindings(await bindingsRes.json());
      if (secretsRes.ok) setSecrets(await secretsRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (tagsRes.ok) setTags(await tagsRes.json());
      if (contentRes.ok) {
        const contentData = await contentRes.json();
        setContent(contentData.scripts || []);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch databases
  const fetchDatabases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/databases");
      if (!response.ok) throw new Error("Failed to fetch databases");
      const data = await response.json();
      setDatabases(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch database tables
  const fetchTables = useCallback(async (databaseId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/databases/${databaseId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch tables");
      const data = await response.json();
      if (data[0]?.results) {
        setTables(data[0].results as TableInfo[]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch available resources for bindings
  const fetchAvailableResources = useCallback(async () => {
    try {
      const response = await fetch("/api/resources");
      if (!response.ok) throw new Error("Failed to fetch resources");
      const data = await response.json();
      setAvailableResources({
        d1_databases: data.d1_databases || [],
        kv_namespaces: data.kv_namespaces || [],
        r2_buckets: data.r2_buckets || [],
      });
    } catch (err) {
      console.error("Error fetching resources:", err);
    }
  }, []);

  // Effects
  useEffect(() => {
    if (view === "namespaces" || view === "static-sites" || view === "ai-builder") {
      fetchNamespaces();
    }
  }, [view, fetchNamespaces]);

  useEffect(() => {
    if (view === "scripts" && selectedNamespace) {
      fetchScripts(selectedNamespace);
    }
  }, [view, selectedNamespace, fetchScripts]);

  useEffect(() => {
    if (view === "script-detail" && selectedNamespace && selectedScript) {
      fetchScriptDetails(selectedNamespace, selectedScript);
    }
  }, [view, selectedNamespace, selectedScript, fetchScriptDetails]);

  useEffect(() => {
    if (view === "databases") {
      fetchDatabases();
    }
  }, [view, fetchDatabases]);

  useEffect(() => {
    if (view === "database-detail" && selectedDatabase) {
      fetchTables(selectedDatabase.uuid);
    }
  }, [view, selectedDatabase, fetchTables]);

  // Navigation handlers
  const navigateToScripts = (namespace: string) => {
    setSelectedNamespace(namespace);
    setView("scripts");
  };

  const navigateToScriptDetail = (scriptName: string) => {
    setSelectedScript(scriptName);
    setActiveTab("overview");
    setView("script-detail");
  };

  const navigateToDatabaseDetail = (db: Database) => {
    setSelectedDatabase(db);
    setDbActiveTab("tables");
    setQueryResults(null);
    setSqlQuery("");
    setQueryError(null);
    setView("database-detail");
  };

  const navigateBack = () => {
    if (view === "script-detail") {
      setSelectedScript(null);
      setView("scripts");
    } else if (view === "scripts") {
      setSelectedNamespace(null);
      setView("namespaces");
    } else if (view === "database-detail") {
      setSelectedDatabase(null);
      setTables([]);
      setView("databases");
    }
  };

  // Action handlers
  const handleCreateNamespace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNamespaceName.trim()) return;
    try {
      setSubmitting(true);
      const response = await fetch("/api/namespaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newNamespaceName.trim() }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create namespace");
      }
      setNewNamespaceName("");
      setShowCreateNamespace(false);
      fetchNamespaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScriptName.trim() || !newScriptContent.trim() || !selectedNamespace) return;
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("scriptName", newScriptName.trim());
      formData.append("script", newScriptContent);
      formData.append("mainModule", "index.js");

      const response = await fetch(`/api/namespaces/${selectedNamespace}/scripts`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload script");
      }
      setNewScriptName("");
      setNewScriptContent(`export default {
  async fetch(request, env, ctx) {
    return new Response("Hello World!");
  },
};`);
      setShowUploadScript(false);
      fetchScripts(selectedNamespace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretName.trim() || !newSecretValue.trim() || !selectedNamespace || !selectedScript) return;
    try {
      setSubmitting(true);
      const response = await fetch(`/api/namespaces/${selectedNamespace}/scripts/${selectedScript}/secrets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretName: newSecretName.trim(), secretValue: newSecretValue }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add secret");
      }
      setNewSecretName("");
      setNewSecretValue("");
      setShowAddSecret(false);
      fetchScriptDetails(selectedNamespace, selectedScript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim() || !selectedNamespace || !selectedScript) return;
    try {
      setSubmitting(true);
      const updatedTags = [...tags, newTag.trim()];
      const response = await fetch(`/api/namespaces/${selectedNamespace}/scripts/${selectedScript}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add tag");
      }
      setNewTag("");
      setShowAddTag(false);
      fetchScriptDetails(selectedNamespace, selectedScript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  // Binding handlers
  const handleOpenAddBinding = async () => {
    setShowAddBinding(true);
    setNewBinding({ name: "", type: "d1" });
    await fetchAvailableResources();
  };

  const handleAddBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBinding.name.trim() || !selectedNamespace || !selectedScript) return;

    try {
      setBindingLoading(true);

      // Build the binding object based on type
      let bindingData: Record<string, unknown> = {
        name: newBinding.name.trim(),
        type: newBinding.type,
      };

      switch (newBinding.type) {
        case "d1":
          if (!newBinding.database_id) {
            setError("Please select a database");
            return;
          }
          bindingData = {
            name: newBinding.name.trim(),
            type: "d1",
            id: newBinding.database_id,
          };
          break;
        case "kv_namespace":
          if (!newBinding.namespace_id) {
            setError("Please select a KV namespace");
            return;
          }
          bindingData = {
            name: newBinding.name.trim(),
            type: "kv_namespace",
            namespace_id: newBinding.namespace_id,
          };
          break;
        case "r2_bucket":
          if (!newBinding.bucket_name) {
            setError("Please select an R2 bucket");
            return;
          }
          bindingData = {
            name: newBinding.name.trim(),
            type: "r2_bucket",
            bucket_name: newBinding.bucket_name,
          };
          break;
        case "plain_text":
          if (!newBinding.text) {
            setError("Please enter text value");
            return;
          }
          bindingData = {
            name: newBinding.name.trim(),
            type: "plain_text",
            text: newBinding.text,
          };
          break;
        case "secret_text":
          if (!newBinding.text) {
            setError("Please enter secret value");
            return;
          }
          bindingData = {
            name: newBinding.name.trim(),
            type: "secret_text",
            text: newBinding.text,
          };
          break;
        case "service":
          if (!newBinding.service) {
            setError("Please enter service name");
            return;
          }
          bindingData = {
            name: newBinding.name.trim(),
            type: "service",
            service: newBinding.service,
            environment: newBinding.environment || "production",
          };
          break;
      }

      // Get current bindings and add new one
      const currentBindings = settings?.bindings || [];
      const updatedBindings = [...currentBindings, bindingData];

      const response = await fetch(
        `/api/namespaces/${selectedNamespace}/scripts/${selectedScript}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bindings: updatedBindings }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add binding");
      }

      setNewBinding({ name: "", type: "d1" });
      setShowAddBinding(false);
      fetchScriptDetails(selectedNamespace, selectedScript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBindingLoading(false);
    }
  };

  const handleRemoveBinding = async (bindingName: string) => {
    if (!selectedNamespace || !selectedScript) return;

    try {
      setBindingLoading(true);

      // Filter out the binding to remove
      const currentBindings = settings?.bindings || [];
      const updatedBindings = currentBindings.filter((b) => b.name !== bindingName);

      const response = await fetch(
        `/api/namespaces/${selectedNamespace}/scripts/${selectedScript}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bindings: updatedBindings }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove binding");
      }

      fetchScriptDetails(selectedNamespace, selectedScript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBindingLoading(false);
    }
  };

  // Static site deployment handler
  const handleDeployStaticSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staticSiteName.trim() || !staticSiteHtml.trim() || !staticSiteNamespace) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setStaticSiteDeploying(true);
      setStaticSiteUrl(null);
      setError(null);

      // Generate worker code that serves the HTML
      const workerCode = `
// Static Site Worker - Generated by Workers Platform UI
const HTML_CONTENT = ${JSON.stringify(staticSiteHtml)};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    
    // Serve the HTML for root or index paths
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML_CONTENT, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    
    // Return 404 for other paths
    return new Response("Not Found", { status: 404 });
  },
};
`.trim();

      // Deploy the worker
      const formData = new FormData();
      formData.append("scriptName", staticSiteName.trim());
      formData.append("script", workerCode);
      formData.append("mainModule", "index.js");

      const response = await fetch(`/api/namespaces/${staticSiteNamespace}/scripts`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to deploy static site");
      }

      // Generate the URL
      const dispatcherUrl = `https://platform-dispatcher.embitious.workers.dev/${staticSiteName.trim()}`;
      setStaticSiteUrl(dispatcherUrl);
      
      // Clear form
      setStaticSiteName("");
      setStaticSiteHtml("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setStaticSiteDeploying(false);
    }
  };

  // Database handlers
  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDatabaseName.trim()) return;
    try {
      setSubmitting(true);
      const response = await fetch("/api/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDatabaseName.trim() }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create database");
      }
      setNewDatabaseName("");
      setShowCreateDatabase(false);
      fetchDatabases();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteQuery = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!sqlQuery.trim() || !selectedDatabase) return;
    try {
      setQueryLoading(true);
      setQueryError(null);
      setQueryResults(null);
      const response = await fetch(`/api/databases/${selectedDatabase.uuid}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sqlQuery.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Query failed");
      }
      if (data[0]) {
        const result = data[0];
        setQueryResults({
          columns: result.results?.length > 0 ? Object.keys(result.results[0]) : [],
          rows: result.results || [],
          meta: result.meta,
        });
      }
      // Refresh tables list if it was a DDL statement
      const ddlPatterns = /^\s*(CREATE|DROP|ALTER)\s+/i;
      if (ddlPatterns.test(sqlQuery)) {
        fetchTables(selectedDatabase.uuid);
      }
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setQueryLoading(false);
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim() || !selectedDatabase || columns.filter(c => c.name.trim()).length === 0) return;

    // Generate SQL
    const validColumns = columns.filter(c => c.name.trim());
    const columnDefs = validColumns.map(col => {
      let def = `"${col.name}" ${col.type}`;
      if (col.primaryKey) def += " PRIMARY KEY";
      if (col.notNull) def += " NOT NULL";
      if (col.unique) def += " UNIQUE";
      if (col.defaultValue.trim()) {
        const val = col.type === "TEXT" ? `'${col.defaultValue}'` : col.defaultValue;
        def += ` DEFAULT ${val}`;
      }
      return def;
    }).join(",\n  ");

    const sql = `CREATE TABLE IF NOT EXISTS "${newTableName}" (\n  ${columnDefs}\n);`;

    try {
      setQueryLoading(true);
      setQueryError(null);
      const response = await fetch(`/api/databases/${selectedDatabase.uuid}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create table");
      }
      // Reset form
      setNewTableName("");
      setColumns([{ name: "", type: "TEXT", primaryKey: false, notNull: false, unique: false, defaultValue: "" }]);
      // Refresh tables
      fetchTables(selectedDatabase.uuid);
      setDbActiveTab("tables");
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setQueryLoading(false);
    }
  };

  const addColumn = () => {
    setColumns([...columns, { name: "", type: "TEXT", primaryKey: false, notNull: false, unique: false, defaultValue: "" }]);
  };

  const removeColumn = (index: number) => {
    if (columns.length > 1) {
      setColumns(columns.filter((_, i) => i !== index));
    }
  };

  const updateColumn = (index: number, field: keyof Column, value: string | boolean) => {
    setColumns(columns.map((col, i) => i === index ? { ...col, [field]: value } : col));
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      setSubmitting(true);
      let url = "";
      if (showDeleteConfirm.type === "namespace") {
        url = `/api/namespaces/${showDeleteConfirm.name}`;
      } else if (showDeleteConfirm.type === "script" && selectedNamespace) {
        url = `/api/namespaces/${selectedNamespace}/scripts/${showDeleteConfirm.name}`;
      } else if (showDeleteConfirm.type === "secret" && selectedNamespace && selectedScript) {
        url = `/api/namespaces/${selectedNamespace}/scripts/${selectedScript}/secrets/${showDeleteConfirm.name}`;
      } else if (showDeleteConfirm.type === "tag" && selectedNamespace && selectedScript) {
        url = `/api/namespaces/${selectedNamespace}/scripts/${selectedScript}/tags/${showDeleteConfirm.name}`;
      } else if (showDeleteConfirm.type === "database" && showDeleteConfirm.id) {
        url = `/api/databases/${showDeleteConfirm.id}`;
      } else if (showDeleteConfirm.type === "table" && selectedDatabase) {
        // Drop table via query
        const response = await fetch(`/api/databases/${selectedDatabase.uuid}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql: `DROP TABLE IF EXISTS "${showDeleteConfirm.name}"` }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to delete table");
        }
        setShowDeleteConfirm(null);
        fetchTables(selectedDatabase.uuid);
        setSubmitting(false);
        return;
      }

      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      setShowDeleteConfirm(null);
      if (showDeleteConfirm.type === "namespace") {
        fetchNamespaces();
      } else if (showDeleteConfirm.type === "script" && selectedNamespace) {
        fetchScripts(selectedNamespace);
      } else if (showDeleteConfirm.type === "database") {
        fetchDatabases();
      } else if (selectedNamespace && selectedScript) {
        fetchScriptDetails(selectedNamespace, selectedScript);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Selection handlers
  const toggleNamespaceSelection = (name: string) => {
    setSelectedNamespaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  const toggleScriptSelection = (id: string) => {
    setSelectedScripts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllNamespaces = () => {
    if (selectedNamespaces.size === namespaces.length) {
      setSelectedNamespaces(new Set());
    } else {
      setSelectedNamespaces(new Set(namespaces.map(ns => ns.namespace_name)));
    }
  };

  const selectAllScripts = () => {
    if (selectedScripts.size === scripts.length) {
      setSelectedScripts(new Set());
    } else {
      setSelectedScripts(new Set(scripts.map(s => s.id)));
    }
  };

  const handleBulkDelete = async () => {
    const isNamespaceView = view === "namespaces";
    const itemsToDelete = isNamespaceView 
      ? Array.from(selectedNamespaces) 
      : Array.from(selectedScripts);
    
    if (itemsToDelete.length === 0) return;

    try {
      setSubmitting(true);
      setBulkDeleteProgress({ current: 0, total: itemsToDelete.length });

      for (let i = 0; i < itemsToDelete.length; i++) {
        const item = itemsToDelete[i];
        let url = "";
        
        if (isNamespaceView) {
          url = `/api/namespaces/${item}`;
        } else if (selectedNamespace) {
          url = `/api/namespaces/${selectedNamespace}/scripts/${item}`;
        }

        const response = await fetch(url, { method: "DELETE" });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to delete ${item}`);
        }
        
        setBulkDeleteProgress({ current: i + 1, total: itemsToDelete.length });
      }

      // Clear selections and refresh
      if (isNamespaceView) {
        setSelectedNamespaces(new Set());
        fetchNamespaces();
      } else if (selectedNamespace) {
        setSelectedScripts(new Set());
        fetchScripts(selectedNamespace);
      }
      
      setShowBulkDeleteConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
      setBulkDeleteProgress(null);
    }
  };

  // Clear selections when changing views
  useEffect(() => {
    setSelectedNamespaces(new Set());
    setSelectedScripts(new Set());
  }, [view]);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(view === "scripts" || view === "script-detail" || view === "database-detail") && (
              <button
                onClick={navigateBack}
                className="p-2 -ml-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Workers Platform</h1>
              {view === "scripts" && selectedNamespace && (
                <p className="text-xs text-white/40">{selectedNamespace}</p>
              )}
              {view === "script-detail" && selectedScript && (
                <p className="text-xs text-white/40">{selectedNamespace} / {selectedScript}</p>
              )}
              {view === "database-detail" && selectedDatabase && (
                <p className="text-xs text-white/40">{selectedDatabase.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Main Navigation Tabs */}
            {(view === "namespaces" || view === "databases" || view === "static-sites" || view === "ai-builder") && (
              <div className="flex gap-1 p-1 bg-white/5 rounded-lg mr-4">
                <button
                  onClick={() => setView("ai-builder")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    view === "ai-builder" ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white" : "text-white/50 hover:text-white"
                  }`}
                >
                  AI Builder
                </button>
                <button
                  onClick={() => setView("namespaces")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    view === "namespaces" ? "bg-white text-black" : "text-white/50 hover:text-white"
                  }`}
                >
                  Namespaces
                </button>
                <button
                  onClick={() => setView("databases")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    view === "databases" ? "bg-white text-black" : "text-white/50 hover:text-white"
                  }`}
                >
                  Databases
                </button>
                <button
                  onClick={() => setView("static-sites")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    view === "static-sites" ? "bg-white text-black" : "text-white/50 hover:text-white"
                  }`}
                >
                  Static Sites
                </button>
              </div>
            )}
            {view === "namespaces" && (
              <button
                onClick={() => setShowCreateNamespace(true)}
                className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-all active:scale-95"
              >
                Create Namespace
              </button>
            )}
            {view === "scripts" && (
              <button
                onClick={() => setShowUploadScript(true)}
                className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-all active:scale-95"
              >
                Upload Script
              </button>
            )}
            {view === "databases" && (
              <button
                onClick={() => setShowCreateDatabase(true)}
                className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-all active:scale-95"
              >
                Create Database
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Namespaces View */}
        {!loading && view === "namespaces" && (
          <>
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight mb-2">Dispatch Namespaces</h2>
                <p className="text-white/50 text-sm">Manage your Workers for Platforms dispatch namespaces</p>
              </div>
            </div>
            
            {/* Selection Bar */}
            {namespaces.length > 0 && (
              <div className="flex items-center gap-4 mb-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={selectedNamespaces.size === namespaces.length && namespaces.length > 0}
                      onChange={selectAllNamespaces}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-white/20 rounded-md peer-checked:border-orange-500 peer-checked:bg-orange-500 transition-all flex items-center justify-center">
                      {selectedNamespaces.size === namespaces.length && namespaces.length > 0 && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {selectedNamespaces.size > 0 && selectedNamespaces.size < namespaces.length && (
                        <div className="w-2.5 h-0.5 bg-orange-500 rounded" />
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-white/60">
                    {selectedNamespaces.size === 0 
                      ? "Select all" 
                      : `${selectedNamespaces.size} of ${namespaces.length} selected`}
                  </span>
                </label>
                {selectedNamespaces.size > 0 && (
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="ml-auto px-4 py-2 text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Selected
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-3">
              {namespaces.map((ns) => (
                <div
                  key={ns.namespace_id}
                  className={`group p-5 bg-white/[0.02] border rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer ${
                    selectedNamespaces.has(ns.namespace_name) 
                      ? "border-orange-500/50 bg-orange-500/5" 
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div 
                      className="pt-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNamespaceSelection(ns.namespace_name);
                      }}
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={selectedNamespaces.has(ns.namespace_name)}
                          onChange={() => toggleNamespaceSelection(ns.namespace_name)}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 border-2 border-white/20 rounded-md peer-checked:border-orange-500 peer-checked:bg-orange-500 transition-all flex items-center justify-center hover:border-white/40">
                          {selectedNamespaces.has(ns.namespace_name) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      className="flex-1 min-w-0"
                      onClick={() => navigateToScripts(ns.namespace_name)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-mono text-base font-medium truncate">{ns.namespace_name}</h3>
                        <span className="px-2 py-0.5 text-xs font-medium bg-orange-500/10 text-orange-400 rounded-full shrink-0">
                          {ns.script_count} scripts
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/40">
                        <span>Created {formatDate(ns.created_on)}</span>
                        <span className="font-mono text-white/30 truncate max-w-[200px]">{ns.namespace_id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm({ type: "namespace", name: ns.namespace_name });
                        }}
                        className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg 
                        className="w-5 h-5 text-white/30 group-hover:text-white/50 transition-colors" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        onClick={() => navigateToScripts(ns.namespace_name)}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {namespaces.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/5 text-sm text-white/40">
                {namespaces.length} namespace{namespaces.length !== 1 ? "s" : ""}
              </div>
            )}
          </>
        )}

        {/* Scripts View */}
        {!loading && view === "scripts" && (
          <>
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight mb-2">Scripts</h2>
                <p className="text-white/50 text-sm">Workers in {selectedNamespace}</p>
              </div>
            </div>
            {scripts.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No scripts yet</h3>
                <p className="text-white/50 text-sm mb-6">Upload your first worker script</p>
                <button
                  onClick={() => setShowUploadScript(true)}
                  className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-all"
                >
                  Upload Script
                </button>
              </div>
            ) : (
              <>
                {/* Selection Bar */}
                <div className="flex items-center gap-4 mb-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={selectedScripts.size === scripts.length && scripts.length > 0}
                        onChange={selectAllScripts}
                        className="peer sr-only"
                      />
                      <div className="w-5 h-5 border-2 border-white/20 rounded-md peer-checked:border-orange-500 peer-checked:bg-orange-500 transition-all flex items-center justify-center">
                        {selectedScripts.size === scripts.length && scripts.length > 0 && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {selectedScripts.size > 0 && selectedScripts.size < scripts.length && (
                          <div className="w-2.5 h-0.5 bg-orange-500 rounded" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-white/60">
                      {selectedScripts.size === 0 
                        ? "Select all" 
                        : `${selectedScripts.size} of ${scripts.length} selected`}
                    </span>
                  </label>
                  {selectedScripts.size > 0 && (
                    <button
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      className="ml-auto px-4 py-2 text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Selected
                    </button>
                  )}
                </div>

                <div className="grid gap-3">
                  {scripts.map((script) => (
                    <div
                      key={script.id}
                      className={`group p-5 bg-white/[0.02] border rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer ${
                        selectedScripts.has(script.id) 
                          ? "border-orange-500/50 bg-orange-500/5" 
                          : "border-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div 
                          className="pt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleScriptSelection(script.id);
                          }}
                        >
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={selectedScripts.has(script.id)}
                              onChange={() => toggleScriptSelection(script.id)}
                              className="peer sr-only"
                            />
                            <div className="w-5 h-5 border-2 border-white/20 rounded-md peer-checked:border-orange-500 peer-checked:bg-orange-500 transition-all flex items-center justify-center hover:border-white/40">
                              {selectedScripts.has(script.id) && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className="flex-1 min-w-0"
                          onClick={() => navigateToScriptDetail(script.id)}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="font-mono text-base font-medium truncate">{script.id}</h3>
                            {script.handlers.map((h) => (
                              <span key={h} className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-full">
                                {h}
                              </span>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/40">
                            <span>Modified {formatDate(script.modified_on)}</span>
                            <span className="font-mono">{script.compatibility_date}</span>
                            {script.compatibility_flags.map((f) => (
                              <span key={f} className="text-white/30">{f}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm({ type: "script", name: script.id });
                            }}
                            className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <svg 
                            className="w-5 h-5 text-white/30 group-hover:text-white/50 transition-colors" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                            onClick={() => navigateToScriptDetail(script.id)}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Script Detail View */}
        {!loading && view === "script-detail" && scriptDetails && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight mb-2 font-mono">{selectedScript}</h2>
              <p className="text-white/50 text-sm">Worker details and configuration</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-xl w-fit">
              {(["overview", "bindings", "secrets", "settings", "tags", "content"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
                    activeTab === tab
                      ? "bg-white text-black"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Script ID</label>
                      <p className="font-mono mt-1">{scriptDetails.script.id}</p>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Namespace</label>
                      <p className="font-mono mt-1">{scriptDetails.dispatch_namespace}</p>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Created</label>
                      <p className="mt-1">{formatDate(scriptDetails.script.created_on)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Modified</label>
                      <p className="mt-1">{formatDate(scriptDetails.script.modified_on)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Compatibility Date</label>
                      <p className="font-mono mt-1">{scriptDetails.script.compatibility_date}</p>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Usage Model</label>
                      <p className="mt-1 capitalize">{scriptDetails.script.usage_model}</p>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Handlers</label>
                      <div className="flex gap-2 mt-1">
                        {scriptDetails.script.handlers.map((h) => (
                          <span key={h} className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-full">
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Compatibility Flags</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {scriptDetails.script.compatibility_flags.map((f) => (
                          <span key={f} className="px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 rounded-full">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <label className="text-xs text-white/40 uppercase tracking-wider">ETag</label>
                    <p className="font-mono text-sm mt-1 text-white/50 break-all">{scriptDetails.script.etag}</p>
                  </div>
                </div>
              )}

              {/* Bindings Tab */}
              {activeTab === "bindings" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Bindings</h3>
                    <button
                      onClick={handleOpenAddBinding}
                      className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 rounded-lg transition-all flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Binding
                    </button>
                  </div>
                  {bindings.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <p className="text-white/40 text-sm mb-4">No bindings configured</p>
                      <button
                        onClick={handleOpenAddBinding}
                        className="px-4 py-2 text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-all"
                      >
                        Add your first binding
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bindings.map((binding) => (
                        <div
                          key={binding.name}
                          className="p-4 bg-white/[0.02] border border-white/5 rounded-lg group hover:border-white/10 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-mono text-sm font-medium">{binding.name}</p>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  binding.type === "d1" ? "bg-cyan-500/10 text-cyan-400" :
                                  binding.type === "kv_namespace" ? "bg-purple-500/10 text-purple-400" :
                                  binding.type === "r2_bucket" ? "bg-orange-500/10 text-orange-400" :
                                  binding.type === "service" ? "bg-blue-500/10 text-blue-400" :
                                  "bg-emerald-500/10 text-emerald-400"
                                }`}>
                                  {binding.type === "d1" ? "D1 Database" :
                                   binding.type === "kv_namespace" ? "KV Namespace" :
                                   binding.type === "r2_bucket" ? "R2 Bucket" :
                                   binding.type === "plain_text" ? "Plain Text" :
                                   binding.type === "secret_text" ? "Secret" :
                                   binding.type === "service" ? "Service" :
                                   binding.type}
                                </span>
                              </div>
                              <div className="text-xs text-white/40 font-mono">
                                {binding.type === "d1" && binding.id ? (
                                  <span>ID: {String(binding.id as string)}</span>
                                ) : null}
                                {binding.type === "kv_namespace" && binding.namespace_id ? (
                                  <span>Namespace: {String(binding.namespace_id as string)}</span>
                                ) : null}
                                {binding.type === "r2_bucket" && binding.bucket_name ? (
                                  <span>Bucket: {String(binding.bucket_name as string)}</span>
                                ) : null}
                                {binding.type === "service" && binding.service ? (
                                  <span>Service: {String(binding.service as string)}</span>
                                ) : null}
                                {binding.type === "plain_text" ? (
                                  <span>Value: {String(binding.text as string || "").slice(0, 50)}{String(binding.text as string || "").length > 50 ? "..." : ""}</span>
                                ) : null}
                                {binding.type === "secret_text" ? (
                                  <span>Value: ••••••••</span>
                                ) : null}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveBinding(binding.name)}
                              disabled={bindingLoading}
                              className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Secrets Tab */}
              {activeTab === "secrets" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Secrets</h3>
                    <button
                      onClick={() => setShowAddSecret(true)}
                      className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                    >
                      Add Secret
                    </button>
                  </div>
                  {secrets.length === 0 ? (
                    <p className="text-white/40 text-sm">No secrets configured</p>
                  ) : (
                    <div className="space-y-2">
                      {secrets.map((secret) => (
                        <div
                          key={secret.name}
                          className="p-4 bg-white/[0.02] border border-white/5 rounded-lg flex items-center justify-between group"
                        >
                          <div>
                            <p className="font-mono text-sm">{secret.name}</p>
                            <p className="text-xs text-white/40 mt-1">{secret.type}</p>
                          </div>
                          <button
                            onClick={() => setShowDeleteConfirm({ type: "secret", name: secret.name })}
                            className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === "settings" && settings && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Compatibility Date</label>
                      <p className="font-mono mt-1">{settings.compatibility_date}</p>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Usage Model</label>
                      <p className="mt-1 capitalize">{settings.usage_model}</p>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Logpush</label>
                      <p className="mt-1">{settings.logpush ? "Enabled" : "Disabled"}</p>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase tracking-wider">Placement</label>
                      <p className="mt-1 capitalize">{settings.placement?.mode || "None"}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-wider">Compatibility Flags</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {settings.compatibility_flags.map((f) => (
                        <span key={f} className="px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 rounded-full">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tags Tab */}
              {activeTab === "tags" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Tags</h3>
                    <button
                      onClick={() => setShowAddTag(true)}
                      className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                    >
                      Add Tag
                    </button>
                  </div>
                  {tags.length === 0 ? (
                    <p className="text-white/40 text-sm">No tags configured</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="group px-3 py-1.5 text-sm bg-white/5 rounded-lg flex items-center gap-2"
                        >
                          {tag}
                          <button
                            onClick={() => setShowDeleteConfirm({ type: "tag", name: tag })}
                            className="text-white/30 hover:text-red-400 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Content Tab */}
              {activeTab === "content" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Script Content</h3>
                  </div>
                  {content.length === 0 ? (
                    <p className="text-white/40 text-sm">No content available</p>
                  ) : (
                    <div className="space-y-4">
                      {content.map((file) => (
                        <div key={file.name}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="font-mono text-sm">{file.name}</span>
                              <span className="text-xs text-white/30">({file.content.length.toLocaleString()} chars)</span>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(file.content);
                                const btn = document.getElementById(`copy-btn-${file.name}`);
                                if (btn) {
                                  btn.textContent = "Copied!";
                                  setTimeout(() => {
                                    btn.innerHTML = `<svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy`;
                                  }, 1500);
                                }
                              }}
                              id={`copy-btn-${file.name}`}
                              className="flex items-center px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                            >
                              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </button>
                          </div>
                          <div className="border border-white/10 rounded-lg overflow-hidden">
                            <Editor
                              height="70vh"
                              defaultLanguage={file.name.endsWith(".ts") ? "typescript" : file.name.endsWith(".json") ? "json" : "javascript"}
                              value={file.content}
                              theme="vs-dark"
                              options={{
                                readOnly: true,
                                minimap: { enabled: true },
                                fontSize: 12,
                                lineNumbers: "on",
                                scrollBeyondLastLine: false,
                                wordWrap: "on",
                                folding: true,
                                automaticLayout: true,
                                padding: { top: 12, bottom: 12 },
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Databases View */}
        {!loading && view === "databases" && (
          <>
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight mb-2">D1 Databases</h2>
                <p className="text-white/50 text-sm">Manage your SQLite databases for Workers</p>
              </div>
            </div>

            {databases.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No databases yet</h3>
                <p className="text-white/50 text-sm mb-6">Create your first D1 database</p>
                <button
                  onClick={() => setShowCreateDatabase(true)}
                  className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-all"
                >
                  Create Database
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {databases.map((db) => (
                  <div
                    key={db.uuid}
                    onClick={() => navigateToDatabaseDetail(db)}
                    className="group p-5 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-mono text-base font-medium truncate">{db.name}</h3>
                          <span className="px-2 py-0.5 text-xs font-medium bg-cyan-500/10 text-cyan-400 rounded-full shrink-0">
                            {db.num_tables} tables
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/40">
                          <span>Created {formatDate(db.created_at)}</span>
                          <span>{(db.file_size / 1024).toFixed(1)} KB</span>
                          <span className="font-mono text-white/30 truncate max-w-[200px]">{db.uuid}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm({ type: "database", name: db.name, id: db.uuid });
                          }}
                          className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <svg className="w-5 h-5 text-white/30 group-hover:text-white/50 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {databases.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/5 text-sm text-white/40">
                {databases.length} database{databases.length !== 1 ? "s" : ""}
              </div>
            )}
          </>
        )}

        {/* Database Detail View */}
        {!loading && view === "database-detail" && selectedDatabase && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight mb-2 font-mono">{selectedDatabase.name}</h2>
              <p className="text-white/50 text-sm">Database schema and query interface</p>
            </div>

            {/* Database Tabs */}
            <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-xl w-fit">
              {(["tables", "query", "schema"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDbActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
                    dbActiveTab === tab
                      ? "bg-white text-black"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab === "schema" ? "Schema Builder" : tab}
                </button>
              ))}
            </div>

            {/* Database Tab Content */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
              {/* Tables Tab */}
              {dbActiveTab === "tables" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Tables</h3>
                    <button
                      onClick={() => setDbActiveTab("schema")}
                      className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                    >
                      Create Table
                    </button>
                  </div>
                  {tables.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-white/40 text-sm mb-4">No tables yet</p>
                      <button
                        onClick={() => setDbActiveTab("schema")}
                        className="px-4 py-2 text-sm font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-all"
                      >
                        Create your first table
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tables.map((table) => (
                        <div
                          key={table.name}
                          className="p-4 bg-white/[0.02] border border-white/5 rounded-lg group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-mono text-sm font-medium">{table.name}</h4>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSqlQuery(`SELECT * FROM "${table.name}" LIMIT 100;`);
                                  setDbActiveTab("query");
                                }}
                                className="px-2 py-1 text-xs font-medium text-cyan-400 hover:bg-cyan-500/10 rounded transition-all"
                              >
                                Query
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm({ type: "table", name: table.name })}
                                className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <pre className="text-xs text-white/40 font-mono overflow-x-auto whitespace-pre-wrap">
                            {table.sql}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Query Tab */}
              {dbActiveTab === "query" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">SQL Query</h3>
                    <div className="flex items-center gap-2">
                      {tables.length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              setSqlQuery(`SELECT * FROM "${e.target.value}" LIMIT 100;`);
                            }
                          }}
                          className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white/70"
                          defaultValue=""
                        >
                          <option value="" disabled>Insert table...</option>
                          {tables.map(t => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleExecuteQuery}>
                    <textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      placeholder="SELECT * FROM users LIMIT 10;"
                      rows={6}
                      className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono text-sm resize-none mb-4"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={queryLoading || !sqlQuery.trim()}
                        className="px-4 py-2 text-sm font-medium bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {queryLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Execute
                          </>
                        )}
                      </button>
                      <span className="text-xs text-white/40">Press Cmd+Enter to run</span>
                    </div>
                  </form>

                  {queryError && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                      {queryError}
                    </div>
                  )}

                  {queryResults && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-white/70">Results</h4>
                        {queryResults.meta && (
                          <div className="flex gap-4 text-xs text-white/40">
                            <span>{queryResults.rows.length} rows</span>
                            <span>{queryResults.meta.duration?.toFixed(2)}ms</span>
                          </div>
                        )}
                      </div>
                      {queryResults.rows.length === 0 ? (
                        <p className="text-white/40 text-sm">No results returned</p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-white/10">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-white/5">
                                {queryResults.columns.map((col) => (
                                  <th key={col} className="px-4 py-2 text-left font-mono text-xs text-white/50 font-medium border-b border-white/10">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {queryResults.rows.map((row, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                                  {queryResults.columns.map((col) => (
                                    <td key={col} className="px-4 py-2 font-mono text-xs text-white/70 max-w-xs truncate">
                                      {row[col] === null ? (
                                        <span className="text-white/30 italic">NULL</span>
                                      ) : (
                                        String(row[col])
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Schema Builder Tab */}
              {dbActiveTab === "schema" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-medium">Schema Builder</h3>
                    <p className="text-xs text-white/40">Define your table structure visually</p>
                  </div>

                  <form onSubmit={handleCreateTable}>
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2 text-white/70">Table Name</label>
                      <input
                        type="text"
                        value={newTableName}
                        onChange={(e) => setNewTableName(e.target.value)}
                        placeholder="users"
                        className="w-full max-w-xs px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono text-sm"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-3 text-white/70">Columns</label>
                      <div className="space-y-2">
                        {columns.map((col, index) => (
                          <div key={index} className="flex items-center gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => updateColumn(index, "name", e.target.value)}
                              placeholder="column_name"
                              className="flex-1 min-w-0 px-3 py-1.5 bg-black/30 border border-white/10 rounded text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 font-mono text-sm"
                            />
                            <select
                              value={col.type}
                              onChange={(e) => updateColumn(index, "type", e.target.value)}
                              className="px-3 py-1.5 bg-black/30 border border-white/10 rounded text-white text-sm"
                            >
                              <option value="TEXT">TEXT</option>
                              <option value="INTEGER">INTEGER</option>
                              <option value="REAL">REAL</option>
                              <option value="BLOB">BLOB</option>
                            </select>
                            <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={col.primaryKey}
                                onChange={(e) => updateColumn(index, "primaryKey", e.target.checked)}
                                className="rounded border-white/20"
                              />
                              PK
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={col.notNull}
                                onChange={(e) => updateColumn(index, "notNull", e.target.checked)}
                                className="rounded border-white/20"
                              />
                              NOT NULL
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={col.unique}
                                onChange={(e) => updateColumn(index, "unique", e.target.checked)}
                                className="rounded border-white/20"
                              />
                              UNIQUE
                            </label>
                            <input
                              type="text"
                              value={col.defaultValue}
                              onChange={(e) => updateColumn(index, "defaultValue", e.target.value)}
                              placeholder="default"
                              className="w-24 px-2 py-1.5 bg-black/30 border border-white/10 rounded text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 font-mono text-xs"
                            />
                            {columns.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeColumn(index)}
                                className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={addColumn}
                        className="mt-3 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Column
                      </button>
                    </div>

                    {/* Preview SQL */}
                    {newTableName && columns.some(c => c.name.trim()) && (
                      <div className="mb-6">
                        <label className="block text-sm font-medium mb-2 text-white/70">Generated SQL</label>
                        <pre className="p-4 bg-black/50 rounded-lg text-xs font-mono text-cyan-400 overflow-x-auto">
                          {`CREATE TABLE IF NOT EXISTS "${newTableName}" (\n  ${columns.filter(c => c.name.trim()).map(col => {
                            let def = `"${col.name}" ${col.type}`;
                            if (col.primaryKey) def += " PRIMARY KEY";
                            if (col.notNull) def += " NOT NULL";
                            if (col.unique) def += " UNIQUE";
                            if (col.defaultValue.trim()) {
                              const val = col.type === "TEXT" ? `'${col.defaultValue}'` : col.defaultValue;
                              def += ` DEFAULT ${val}`;
                            }
                            return def;
                          }).join(",\n  ")}\n);`}
                        </pre>
                      </div>
                    )}

                    {queryError && (
                      <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {queryError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={queryLoading || !newTableName.trim() || !columns.some(c => c.name.trim())}
                      className="px-4 py-2 text-sm font-medium bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 transition-all"
                    >
                      {queryLoading ? "Creating..." : "Create Table"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}

        {/* Static Sites View */}
        {!loading && view === "static-sites" && (
          <>
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight mb-2">Static Sites</h2>
                <p className="text-white/50 text-sm">Deploy HTML pages as Workers</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Deploy Form */}
              <div className="card bg-white/[0.02] border border-white/5 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">Deploy Static Site</h3>
                    <p className="text-xs text-white/40">Paste your HTML and deploy instantly</p>
                  </div>
                </div>

                <form onSubmit={handleDeployStaticSite}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-white/70">Namespace</label>
                    <select
                      value={staticSiteNamespace}
                      onChange={(e) => setStaticSiteNamespace(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                      required
                    >
                      <option value="">Select a namespace...</option>
                      {namespaces.map((ns) => (
                        <option key={ns.namespace_id} value={ns.namespace_name}>
                          {ns.namespace_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-white/70">Site Name</label>
                    <input
                      type="text"
                      value={staticSiteName}
                      onChange={(e) => setStaticSiteName(e.target.value)}
                      placeholder="my-static-site"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-mono text-sm"
                      required
                    />
                    <p className="text-xs text-white/40 mt-1">
                      URL will be: https://platform-dispatcher.embitious.workers.dev/{staticSiteName || "site-name"}
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2 text-white/70">HTML Content</label>
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <Editor
                        height="400px"
                        defaultLanguage="html"
                        value={staticSiteHtml}
                        onChange={(value) => setStaticSiteHtml(value || "")}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 12,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          wordWrap: "on",
                          folding: true,
                          automaticLayout: true,
                          padding: { top: 12, bottom: 12 },
                          tabSize: 2,
                        }}
                      />
                    </div>
                    <p className="text-xs text-white/40 mt-2">
                      {staticSiteHtml.length.toLocaleString()} characters
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={staticSiteDeploying || !staticSiteName.trim() || !staticSiteHtml.trim() || !staticSiteNamespace}
                    className="w-full px-4 py-3 text-sm font-medium bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-pink-500/20 flex items-center justify-center gap-2"
                  >
                    {staticSiteDeploying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Deploy Static Site
                      </>
                    )}
                  </button>
                </form>

                {/* Success Message */}
                {staticSiteUrl && (
                  <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-emerald-400 font-medium">Deployed Successfully!</span>
                    </div>
                    <p className="text-sm text-white/60 mb-3">Your static site is now live at:</p>
                    <a
                      href={staticSiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-black/30 rounded-lg font-mono text-sm text-pink-400 hover:text-pink-300 break-all"
                    >
                      {staticSiteUrl}
                    </a>
                    <button
                      onClick={() => window.open(staticSiteUrl, "_blank")}
                      className="mt-3 w-full px-4 py-2 text-sm font-medium bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open in New Tab
                    </button>
                  </div>
                )}
              </div>

              {/* Info Panel */}
              <div className="space-y-6">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <span className="text-lg">📖</span> How it works
                  </h3>
                  <ol className="space-y-3 text-sm text-white/60">
                    <li className="flex gap-3">
                      <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-medium shrink-0">1</span>
                      <span>Select a namespace to deploy your site into</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-medium shrink-0">2</span>
                      <span>Enter a unique name for your static site</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-medium shrink-0">3</span>
                      <span>Paste your complete HTML content</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-medium shrink-0">4</span>
                      <span>Click deploy and get your live URL instantly!</span>
                    </li>
                  </ol>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <span className="text-lg">💡</span> Tips
                  </h3>
                  <ul className="space-y-2 text-sm text-white/60">
                    <li className="flex gap-2">
                      <span className="text-pink-400">•</span>
                      Include all CSS/JS inline or via CDN links
                    </li>
                    <li className="flex gap-2">
                      <span className="text-pink-400">•</span>
                      Perfect for landing pages, dashboards, and demos
                    </li>
                    <li className="flex gap-2">
                      <span className="text-pink-400">•</span>
                      HTML is served with proper content-type headers
                    </li>
                    <li className="flex gap-2">
                      <span className="text-pink-400">•</span>
                      Redeploy anytime by using the same site name
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-xl p-6">
                  <h3 className="font-semibold mb-2 text-pink-400">🚀 RideShare Demo</h3>
                  <p className="text-sm text-white/60 mb-4">
                    Try deploying the ride-sharing UI! Copy the HTML from the rideshare-app/index.html file and paste it here.
                  </p>
                  <button
                    onClick={() => {
                      setStaticSiteName("rideshare-demo");
                      setStaticSiteHtml(`<!DOCTYPE html>
<html>
<head>
  <title>RideShare Demo</title>
</head>
<body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: white;">
  <div style="text-align: center;">
    <h1>🚗 RideShare Demo</h1>
    <p>Paste the full rideshare-app/index.html content here!</p>
  </div>
</body>
</html>`);
                    }}
                    className="text-sm text-pink-400 hover:text-pink-300 font-medium"
                  >
                    Load placeholder template →
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* AI Builder View - kept mounted to preserve state */}
        <div className={view === "ai-builder" ? "" : "hidden"}>
          {!loading && (
            <AIBuilder 
              namespaces={namespaces}
              onDeployComplete={(result) => {
                console.log("Deployed:", result);
              }}
            />
          )}
        </div>
      </main>

      {/* Create Database Modal */}
      {showCreateDatabase && (
        <Modal onClose={() => setShowCreateDatabase(false)}>
          <h3 className="text-lg font-semibold mb-1">Create Database</h3>
          <p className="text-sm text-white/50 mb-6">Create a new D1 SQLite database</p>
          <form onSubmit={handleCreateDatabase}>
            <label className="block text-sm font-medium mb-2 text-white/70">Database Name</label>
            <input
              type="text"
              value={newDatabaseName}
              onChange={(e) => setNewDatabaseName(e.target.value)}
              placeholder="my-database"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono text-sm"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateDatabase(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newDatabaseName.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Namespace Modal */}
      {showCreateNamespace && (
        <Modal onClose={() => setShowCreateNamespace(false)}>
          <h3 className="text-lg font-semibold mb-1">Create Namespace</h3>
          <p className="text-sm text-white/50 mb-6">Create a new dispatch namespace</p>
          <form onSubmit={handleCreateNamespace}>
            <label className="block text-sm font-medium mb-2 text-white/70">Namespace Name</label>
            <input
              type="text"
              value={newNamespaceName}
              onChange={(e) => setNewNamespaceName(e.target.value)}
              placeholder="my-namespace"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono text-sm"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateNamespace(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newNamespaceName.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Upload Script Modal */}
      {showUploadScript && (
        <Modal onClose={() => setShowUploadScript(false)} wide>
          <h3 className="text-lg font-semibold mb-1">Upload Script</h3>
          <p className="text-sm text-white/50 mb-6">Upload a new worker script to {selectedNamespace}</p>
          <form onSubmit={handleUploadScript}>
            <label className="block text-sm font-medium mb-2 text-white/70">Script Name</label>
            <input
              type="text"
              value={newScriptName}
              onChange={(e) => setNewScriptName(e.target.value)}
              placeholder="my-worker"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono text-sm mb-4"
              autoFocus
            />
            <label className="block text-sm font-medium mb-2 text-white/70">Script Content (ES Module)</label>
            <textarea
              value={newScriptContent}
              onChange={(e) => setNewScriptContent(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono text-sm resize-none"
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowUploadScript(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newScriptName.trim() || !newScriptContent.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                {submitting ? "Uploading..." : "Upload"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Secret Modal */}
      {showAddSecret && (
        <Modal onClose={() => setShowAddSecret(false)}>
          <h3 className="text-lg font-semibold mb-1">Add Secret</h3>
          <p className="text-sm text-white/50 mb-6">Add a new secret to {selectedScript}</p>
          <form onSubmit={handleAddSecret}>
            <label className="block text-sm font-medium mb-2 text-white/70">Secret Name</label>
            <input
              type="text"
              value={newSecretName}
              onChange={(e) => setNewSecretName(e.target.value)}
              placeholder="MY_SECRET"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono text-sm mb-4"
              autoFocus
            />
            <label className="block text-sm font-medium mb-2 text-white/70">Secret Value</label>
            <input
              type="password"
              value={newSecretValue}
              onChange={(e) => setNewSecretValue(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono text-sm"
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAddSecret(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newSecretName.trim() || !newSecretValue.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                {submitting ? "Adding..." : "Add Secret"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Tag Modal */}
      {showAddTag && (
        <Modal onClose={() => setShowAddTag(false)}>
          <h3 className="text-lg font-semibold mb-1">Add Tag</h3>
          <p className="text-sm text-white/50 mb-6">Add a new tag to {selectedScript}</p>
          <form onSubmit={handleAddTag}>
            <label className="block text-sm font-medium mb-2 text-white/70">Tag</label>
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="my-tag"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono text-sm"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAddTag(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newTag.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                {submitting ? "Adding..." : "Add Tag"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Binding Modal */}
      {showAddBinding && (
        <Modal onClose={() => setShowAddBinding(false)} wide>
          <h3 className="text-lg font-semibold mb-1">Add Binding</h3>
          <p className="text-sm text-white/50 mb-6">Add a resource binding to {selectedScript}</p>
          <form onSubmit={handleAddBinding}>
            {/* Binding Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-white/70">Binding Name</label>
              <input
                type="text"
                value={newBinding.name}
                onChange={(e) => setNewBinding({ ...newBinding, name: e.target.value })}
                placeholder="DB, KV, MY_BUCKET, etc."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-sm"
                autoFocus
              />
              <p className="text-xs text-white/40 mt-1">This is how you&apos;ll access it in your Worker: env.{newBinding.name || "BINDING_NAME"}</p>
            </div>

            {/* Binding Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-white/70">Binding Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: "d1" as BindingType, label: "D1 Database", icon: "🗄️", color: "cyan" },
                  { type: "kv_namespace" as BindingType, label: "KV Namespace", icon: "📦", color: "purple" },
                  { type: "r2_bucket" as BindingType, label: "R2 Bucket", icon: "🪣", color: "orange" },
                  { type: "plain_text" as BindingType, label: "Plain Text", icon: "📝", color: "emerald" },
                  { type: "secret_text" as BindingType, label: "Secret", icon: "🔐", color: "red" },
                  { type: "service" as BindingType, label: "Service", icon: "⚡", color: "blue" },
                ].map(({ type, label, icon, color }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewBinding({ ...newBinding, type, database_id: undefined, namespace_id: undefined, bucket_name: undefined, text: undefined, service: undefined })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newBinding.type === type
                        ? `bg-${color}-500/10 border-${color}-500/50 text-${color}-400`
                        : "bg-white/[0.02] border-white/10 text-white/60 hover:border-white/20"
                    }`}
                    style={{
                      backgroundColor: newBinding.type === type ? `var(--${color}-bg, rgba(255,255,255,0.05))` : undefined,
                      borderColor: newBinding.type === type ? `var(--${color}-border, rgba(255,255,255,0.3))` : undefined,
                    }}
                  >
                    <span className="text-lg">{icon}</span>
                    <p className="text-xs font-medium mt-1">{label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific fields */}
            <div className="mb-6">
              {/* D1 Database */}
              {newBinding.type === "d1" && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-white/70">Select Database</label>
                  {availableResources.d1_databases.length === 0 ? (
                    <p className="text-white/40 text-sm p-4 bg-white/[0.02] rounded-xl">No D1 databases found. Create one in the Databases tab first.</p>
                  ) : (
                    <select
                      value={newBinding.database_id || ""}
                      onChange={(e) => setNewBinding({ ...newBinding, database_id: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                      <option value="">Select a database...</option>
                      {availableResources.d1_databases.map((db) => (
                        <option key={db.id} value={db.id}>{db.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* KV Namespace */}
              {newBinding.type === "kv_namespace" && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-white/70">Select KV Namespace</label>
                  {availableResources.kv_namespaces.length === 0 ? (
                    <p className="text-white/40 text-sm p-4 bg-white/[0.02] rounded-xl">No KV namespaces found.</p>
                  ) : (
                    <select
                      value={newBinding.namespace_id || ""}
                      onChange={(e) => setNewBinding({ ...newBinding, namespace_id: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <option value="">Select a namespace...</option>
                      {availableResources.kv_namespaces.map((kv) => (
                        <option key={kv.id} value={kv.id}>{kv.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* R2 Bucket */}
              {newBinding.type === "r2_bucket" && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-white/70">Select R2 Bucket</label>
                  {availableResources.r2_buckets.length === 0 ? (
                    <p className="text-white/40 text-sm p-4 bg-white/[0.02] rounded-xl">No R2 buckets found.</p>
                  ) : (
                    <select
                      value={newBinding.bucket_name || ""}
                      onChange={(e) => setNewBinding({ ...newBinding, bucket_name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      <option value="">Select a bucket...</option>
                      {availableResources.r2_buckets.map((r2) => (
                        <option key={r2.id} value={r2.name}>{r2.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Plain Text */}
              {newBinding.type === "plain_text" && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-white/70">Text Value</label>
                  <input
                    type="text"
                    value={newBinding.text || ""}
                    onChange={(e) => setNewBinding({ ...newBinding, text: e.target.value })}
                    placeholder="Enter text value"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-sm"
                  />
                </div>
              )}

              {/* Secret Text */}
              {newBinding.type === "secret_text" && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-white/70">Secret Value</label>
                  <input
                    type="password"
                    value={newBinding.text || ""}
                    onChange={(e) => setNewBinding({ ...newBinding, text: e.target.value })}
                    placeholder="Enter secret value"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/50 font-mono text-sm"
                  />
                  <p className="text-xs text-white/40 mt-1">This value will be encrypted and not visible after saving.</p>
                </div>
              )}

              {/* Service */}
              {newBinding.type === "service" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/70">Service Name</label>
                    <input
                      type="text"
                      value={newBinding.service || ""}
                      onChange={(e) => setNewBinding({ ...newBinding, service: e.target.value })}
                      placeholder="my-other-worker"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/70">Environment (optional)</label>
                    <input
                      type="text"
                      value={newBinding.environment || ""}
                      onChange={(e) => setNewBinding({ ...newBinding, environment: e.target.value })}
                      placeholder="production"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddBinding(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bindingLoading || !newBinding.name.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                {bindingLoading ? "Adding..." : "Add Binding"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal onClose={() => setShowDeleteConfirm(null)}>
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-center mb-2">Delete {showDeleteConfirm.type}</h3>
          <p className="text-sm text-white/50 text-center mb-6">
            Are you sure you want to delete <span className="font-mono text-white/70">{showDeleteConfirm.name}</span>?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 transition-all"
            >
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <Modal onClose={() => !submitting && setShowBulkDeleteConfirm(false)}>
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-center mb-2">
            Delete {view === "namespaces" ? selectedNamespaces.size : selectedScripts.size} {view === "namespaces" ? "namespace" : "script"}{(view === "namespaces" ? selectedNamespaces.size : selectedScripts.size) !== 1 ? "s" : ""}
          </h3>
          <p className="text-sm text-white/50 text-center mb-4">
            Are you sure you want to delete the following {view === "namespaces" ? "namespaces" : "scripts"}?
          </p>
          <div className="mb-6 max-h-40 overflow-y-auto p-3 bg-black/30 rounded-lg">
            <div className="flex flex-wrap gap-2">
              {(view === "namespaces" ? Array.from(selectedNamespaces) : Array.from(selectedScripts)).map(item => (
                <span key={item} className="px-2 py-1 text-xs font-mono bg-white/5 rounded-md text-white/70">
                  {item}
                </span>
              ))}
            </div>
          </div>
          
          {bulkDeleteProgress && (
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-white/50">Deleting...</span>
                <span className="text-white/70">{bulkDeleteProgress.current} / {bulkDeleteProgress.total}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-300"
                  style={{ width: `${(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowBulkDeleteConfirm(false)}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 transition-all"
            >
              {submitting ? "Deleting..." : "Delete All"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Modal Component
function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} bg-[#151515] border border-white/10 rounded-2xl shadow-2xl p-6`}>
        {children}
      </div>
    </div>
  );
}
