export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Log incoming request
    console.log("========================================");
    console.log("[DEVA-DISPATCHER] Incoming request");
    console.log("========================================");
    console.log("[DEVA-DISPATCHER] URL:", url.toString());
    console.log("[DEVA-DISPATCHER] Method:", request.method);
    console.log("[DEVA-DISPATCHER] Path parts:", pathParts);
    console.log("[DEVA-DISPATCHER] Namespace binding exists:", !!env.DISPATCHER);
    
    // First path segment is the script name
    const scriptName = pathParts[0];
    console.log("[DEVA-DISPATCHER] Target script name:", scriptName);
    
    if (!scriptName) {
      console.log("[DEVA-DISPATCHER] ❌ No script name provided");
      return new Response(JSON.stringify({
        error: 'Script name required',
        usage: 'GET /{script-name}/...',
        example: 'GET /my-worker/api/hello',
        dispatcher: 'deva-dispatcher',
        namespace: 'deva test',
        debug: {
          requestUrl: url.toString(),
          pathParts: pathParts,
          namespaceBinding: !!env.DISPATCHER
        }
      }, null, 2), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    try {
      console.log("[DEVA-DISPATCHER] Looking up script:", scriptName);
      
      // Get the user's worker from the dispatch namespace
      const userWorker = env.DISPATCHER.get(scriptName);
      console.log("[DEVA-DISPATCHER] Worker reference obtained:", !!userWorker);
      
      // Create a new URL without the script name prefix
      const newPath = '/' + pathParts.slice(1).join('/');
      const newUrl = new URL(newPath + url.search, url.origin);
      console.log("[DEVA-DISPATCHER] Forwarding to path:", newPath);
      console.log("[DEVA-DISPATCHER] New URL:", newUrl.toString());
      
      // Create new request with modified URL
      const newRequest = new Request(newUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      
      // Forward to user's worker
      console.log("[DEVA-DISPATCHER] Forwarding request to worker...");
      const response = await userWorker.fetch(newRequest);
      console.log("[DEVA-DISPATCHER] ✅ Got response from worker, status:", response.status);
      console.log("========================================\n");
      
      return response;
    } catch (e) {
      console.log("[DEVA-DISPATCHER] ❌ Error dispatching to worker");
      console.log("[DEVA-DISPATCHER] Error message:", e.message);
      console.log("[DEVA-DISPATCHER] Error stack:", e.stack);
      console.log("[DEVA-DISPATCHER] Script name attempted:", scriptName);
      console.log("========================================\n");
      
      return new Response(JSON.stringify({
        error: 'Script not found',
        script: scriptName,
        message: e.message,
        dispatcher: 'deva-dispatcher',
        namespace: 'deva test',
        debug: {
          requestUrl: url.toString(),
          pathParts: pathParts,
          attemptedScript: scriptName,
          namespaceBinding: !!env.DISPATCHER,
          hint: "Make sure the script is deployed to the 'deva test' namespace."
        }
      }, null, 2), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

