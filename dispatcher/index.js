export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // First path segment is the script name
    const scriptName = pathParts[0];
    
    if (!scriptName) {
      return new Response(JSON.stringify({
        error: 'Script name required',
        usage: 'GET /{script-name}/...',
        example: 'GET /my-worker/api/hello'
      }, null, 2), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    try {
      // Get the user's worker from the dispatch namespace
      const userWorker = env.DISPATCHER.get(scriptName);
      
      // Create a new URL without the script name prefix
      const newPath = '/' + pathParts.slice(1).join('/');
      const newUrl = new URL(newPath + url.search, url.origin);
      
      // Create new request with modified URL
      const newRequest = new Request(newUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      
      // Forward to user's worker
      return await userWorker.fetch(newRequest);
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'Script not found',
        script: scriptName,
        message: e.message
      }, null, 2), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
