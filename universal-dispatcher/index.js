/**
 * Universal Dispatcher - Routes to any configured namespace
 * 
 * URL Pattern: https://universal-dispatcher.embitious.workers.dev/{namespace}/{script-name}/...
 * 
 * Example:
 *   https://universal-dispatcher.embitious.workers.dev/deva-test/my-app/api/users
 *   → Routes to "my-app" worker in "deva test" namespace at path /api/users
 */

// Map URL-safe namespace names to their binding names
// The binding names must match what's in wrangler.toml
const NAMESPACE_BINDINGS = {
  "testing-app": "NS_TESTING_APP",
  "deva-test": "NS_DEVA_TEST",
  // Add more namespaces here as needed
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    console.log("[UNIVERSAL-DISPATCHER] Request:", url.toString());
    console.log("[UNIVERSAL-DISPATCHER] Path parts:", pathParts);
    
    // Show help if no path
    if (pathParts.length === 0) {
      return new Response(JSON.stringify({
        name: "Universal Dispatcher",
        usage: "/{namespace}/{script-name}/...",
        example: "/deva-test/my-app/api/users",
        availableNamespaces: Object.keys(NAMESPACE_BINDINGS),
        description: "Routes requests to workers in any configured namespace"
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // First segment is namespace, second is script name
    const namespaceName = pathParts[0];
    const scriptName = pathParts[1];
    
    console.log("[UNIVERSAL-DISPATCHER] Namespace:", namespaceName);
    console.log("[UNIVERSAL-DISPATCHER] Script:", scriptName);
    
    if (!scriptName) {
      return new Response(JSON.stringify({
        error: "Script name required",
        usage: "/{namespace}/{script-name}/...",
        namespace: namespaceName,
        availableNamespaces: Object.keys(NAMESPACE_BINDINGS)
      }, null, 2), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Get the binding name for this namespace
    const bindingName = NAMESPACE_BINDINGS[namespaceName];
    
    if (!bindingName) {
      return new Response(JSON.stringify({
        error: "Namespace not configured",
        namespace: namespaceName,
        availableNamespaces: Object.keys(NAMESPACE_BINDINGS),
        hint: "Add this namespace to the dispatcher's wrangler.toml and redeploy"
      }, null, 2), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Get the namespace binding from env
    const namespaceBinding = env[bindingName];
    
    if (!namespaceBinding) {
      return new Response(JSON.stringify({
        error: "Namespace binding not found in environment",
        namespace: namespaceName,
        bindingName: bindingName,
        hint: "Make sure the namespace binding exists in wrangler.toml"
      }, null, 2), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    try {
      // Get the worker from the namespace
      const userWorker = namespaceBinding.get(scriptName);
      
      // Create path without namespace and script name
      const newPath = '/' + pathParts.slice(2).join('/');
      const newUrl = new URL(newPath + url.search, url.origin);
      
      console.log("[UNIVERSAL-DISPATCHER] Forwarding to:", newPath);
      
      const newRequest = new Request(newUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      
      const response = await userWorker.fetch(newRequest);
      console.log("[UNIVERSAL-DISPATCHER] Response status:", response.status);
      
      return response;
    } catch (e) {
      console.error("[UNIVERSAL-DISPATCHER] Error:", e.message);
      
      return new Response(JSON.stringify({
        error: "Script not found",
        namespace: namespaceName,
        script: scriptName,
        message: e.message
      }, null, 2), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

