const PORT = 8348;
const ROOT_DIR = './src'; // Root directory with TKML files
const VERSION = '20';

// Import TKML from local file
import { TKML } from './tkml.server.js';
const TKMLinstance = new TKML();

// HTML wrapper for TKML content
const HTML_WRAPPER = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TKML App</title>
    <link rel="stylesheet" href="/styles.min.css">
    <style>
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
</head>
<body>
    <div id="app" data-instance-id="{{instanceId}}">{{content}}</div>
    <script src="/tkml.min.js"></script>
    <script>{{js}}</script>
</body>
</html>
`;

// Cache for imported files (raw content only)
const importCache = new Map<string, string>();

/**
 * Class to handle a single TKML request
 */
class TKMLRequest {
    private readonly req: Request;
    private readonly url: URL;
    private readonly path: string;
    private readonly getParams: Record<string, string>;
    private readonly postParams: Record<string, string>;
    private readonly processingFiles: Set<string> = new Set();
    private finished: boolean = false;


    constructor(req: Request) {
        this.req = req;
        this.url = new URL(req.url);
        this.path = this.normalizePath(this.url.pathname);
        this.getParams = Object.fromEntries(this.url.searchParams.entries());
        this.postParams = {};
    }

    /**
     * Normalize the path by removing leading slash and handling directories
     */
    private normalizePath(path: string): string {
        // Remove leading slash
        path = path.replace(/^\//, '');

        // Check if the path is a TKML file
        if (!path.endsWith('.tkml')) {
            // If not, assume it's a directory and add index.tkml
            path = path.replace(/\/?$/, '/index.tkml');
        }

        return path;
    }

    /**
     * Parse POST parameters from the request
     */
    async parsePostParams(): Promise<void> {
        if (this.req.method !== 'POST') return;

        try {
            const contentType = this.req.headers.get('Content-Type') || '';

            if (contentType.includes('application/json')) {
                // Handle JSON data
                const jsonData = await this.req.json();
                Object.assign(this.postParams, jsonData);
            } else if (contentType.includes('application/x-www-form-urlencoded') ||
                contentType.includes('multipart/form-data')) {
                // Handle form data
                const formData = await this.req.formData();
                // Use type assertion to access entries method
                Object.assign(this.postParams, Object.fromEntries((formData as any).entries()));
            }
        } catch (error) {
            console.error('Error parsing POST data:', error);
        }
    }

    /**
     * Handle CORS preflight requests
     */
    handleCorsPreflightRequest(): Response | null {
        if (this.req.method !== 'OPTIONS') return null;

        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Accept',
                'Access-Control-Max-Age': '86400' // 24 hours
            }
        });
    }

    /**
     * Handle requests to static files
     */
    handleStaticFileRequest(): Promise<Response> | null {
        const path = this.url.pathname;

        if (path === '/tkml.min.js') {
            return this.serveStaticFile('./tkml.min.js', 'application/javascript');
        } else if (path === '/styles.min.css') {
            return this.serveStaticFile('./styles.min.css', 'text/css');
        }

        return null;
    }

    /**
     * Serve a static file
     */
    async serveStaticFile(filePath: string, contentType: string): Promise<Response> {
        try {
            const file = Bun.file(filePath);
            const exists = await file.exists();

            if (!exists) {
                return new Response(`File not found: ${filePath}`, {
                    status: 404,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            return new Response(file, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'max-age=3600'
                }
            });
        } catch (error) {
            console.error(`Error serving ${filePath}:`, error);
            return new Response('Server Error', { status: 500 });
        }
    }

    /**
     * Include file content
     */
    async includeFile(filePath: string, currentFilePath: string = ''): Promise<string> {
        // Resolve the path relative to the current file
        let resolvedPath = filePath;

        // If the path is relative and we have a current file path
        if (!filePath.startsWith('/') && currentFilePath) {
            // Get the directory of the current file
            const currentDir = currentFilePath.split('/').slice(0, -1).join('/');
            // Resolve the path relative to the current directory
            resolvedPath = currentDir ? `${currentDir}/${filePath}` : filePath;
        }

        // Form full path to file
        const fullPath = `${ROOT_DIR}/${resolvedPath}`;

        try {
            // Check if file exists
            let fileContent;

            // Only use cache for raw file content, not processed results
            if (importCache.has(resolvedPath)) {
                fileContent = importCache.get(resolvedPath)!;
            } else {
                const file = Bun.file(fullPath);
                const exists = await file.exists();

                if (!exists) {
                    console.error(`Import file not found: ${fullPath}`);
                    return `[Error: Import file not found: ${resolvedPath}]`;
                }

                // Read file content
                fileContent = await file.text();

                // Cache the raw file content
                importCache.set(resolvedPath, fileContent);
            }

            // Check for circular includes
            if (this.processingFiles.has(resolvedPath)) {
                console.error(`Circular include detected: ${resolvedPath}`);
                return `[Error: Circular include detected: ${resolvedPath}]`;
            }

            // Mark file as being processed
            this.processingFiles.add(resolvedPath);

            let processedContent;

            // Check if it's a JavaScript/TypeScript file
            if (resolvedPath.endsWith('.js') || resolvedPath.endsWith('.ts')) {
                try {
                    // Create a context for the script
                    const context = {
                        // Convert string values to appropriate types when possible
                        get: Object.fromEntries(
                            Object.entries(this.getParams).map(([key, value]) => {
                                // Try to convert numeric strings to numbers
                                if (/^\d+$/.test(value)) {
                                    return [key, parseInt(value, 10)];
                                }
                                return [key, value];
                            })
                        ),
                        post: this.postParams,
                        result: '',
                        finished: false,
                        exports: {},

                        // Function to finish execution and return content
                        finish(content: string) {
                            this.result = content;
                            this.finished = true;
                            // Throw a special error to stop execution
                            throw new Error("__TKML_FINISH__");
                        },

                        // Function to export variables
                        export(name: string, value: any) {
                            this.exports[name] = value;
                        }
                    };

                    // Wrap the script in a function that provides the context
                    const scriptFunction = new Function('context', `
                        try {
                            with(context) {
                                ${fileContent}
                                return { result, finished, exports };
                            }
                        } catch(e) {
                            // Check if this is our special finish signal
                            if (e.message === "__TKML_FINISH__") {
                                return { result: context.result, finished: true, exports: context.exports };
                            }
                            // Otherwise rethrow
                            throw e;
                        }
                    `);

                    // Execute the script
                    const result = scriptFunction(context);

                    // If finish() was called, use that result
                    if (result.finished) {
                        processedContent = result.result;
                        this.finished = true;
                    } else if (Object.keys(result.exports).length > 0) {
                        // If there are exports, make them available in the sandbox
                        processedContent = `
                            <!-- JS Module Exports -->
                            <script type="application/x-tkml-exports">
                                ${JSON.stringify(result.exports)}
                            </script>
                        `;
                    } else {
                        // No result or exports
                        processedContent = '';
                    }
                } catch (error) {
                    // Only log errors that aren't our special finish signal
                    if (error.message !== "__TKML_FINISH__") {
                        console.error(`Error executing JS/TS module ${resolvedPath}:`, error);
                        processedContent = `[Error executing ${resolvedPath}: ${error.message}]`;
                    }
                }
            } else {
                // Process JavaScript expressions in the included file
                // Pass the resolved path as the current file path for nested includes
                processedContent = await this.processJsExpressions(fileContent, resolvedPath);
            }

            // Mark file as no longer being processed
            this.processingFiles.delete(resolvedPath);

            return processedContent;
        } catch (error) {
            // Make sure to remove from processing set in case of error
            this.processingFiles.delete(resolvedPath);
            console.error(`Error importing file ${resolvedPath}:`, error);
            return `[Error importing ${resolvedPath}: ${error.message}]`;
        }
    }

    /**
     * Process JavaScript expressions in double curly braces
     */
    async processJsExpressions(content: string, currentFilePath: string = ''): Promise<string> {
        // First, extract any exports from included JS/TS files
        const exportsRegex = /<script type="application\/x-tkml-exports">([\s\S]*?)<\/script>/g;
        let match;

        // Collect all exports
        let allExports = {};
        while ((match = exportsRegex.exec(content)) !== null) {
            try {
                const exports = JSON.parse(match[1]);
                allExports = { ...allExports, ...exports };
            } catch (error) {
                console.error('Error parsing exports:', error);
            }
        }

        // Remove all export script tags
        content = content.replace(exportsRegex, '');

        // Regular expression for finding expressions like {{...}}
        const jsExpressionRegex = /\{\{([\s\S]*?)\}\}/;

        // Process expressions sequentially
        let processedContent = content;
        let expressionMatch;

        // Keep processing while there are matches
        while ((expressionMatch = jsExpressionRegex.exec(processedContent)) !== null) {
            const fullMatch = expressionMatch[0];
            const jsCode = expressionMatch[1];
            const matchIndex = expressionMatch.index;

            try {
                // Create a safe context for code execution
                const sandbox = {
                    Date,
                    Math,
                    JSON,
                    Array,
                    Object,
                    String,
                    Number,
                    Boolean,
                    console: {
                        log: (...args: any[]) => console.log(...args),
                        error: (...args: any[]) => console.error(...args),
                        warn: (...args: any[]) => console.warn(...args),
                        info: (...args: any[]) => console.info(...args)
                    },
                    // Pass the current file path to includeFile and return the result
                    include: async (path: string) => {
                        return await this.includeFile(path, currentFilePath);
                    },
                    get: this.getParams,
                    post: this.postParams,
                    // Add all exports from included JS/TS files
                    ...allExports
                };

                // Create an async function to execute the code
                const asyncFunction = new Function('sandbox', `
                    return (async function() {
                        with(sandbox) {
                            return ${jsCode};
                        }
                    })();
                `);

                // Execute the code and get the result
                const result = await asyncFunction(sandbox);

                // Check if we need to stop processing due to finish() being called
                if (this.finished) {
                    return String(result);
                }

                // Replace just this expression with its result
                const resultStr = String(result);
                processedContent =
                    processedContent.substring(0, matchIndex) +
                    resultStr +
                    processedContent.substring(matchIndex + fullMatch.length);

                // Reset regex to start from the position after the replacement
                // This is important to avoid infinite loops with empty results
                jsExpressionRegex.lastIndex = matchIndex + resultStr.length;
            } catch (error) {
                console.error(`Error executing JS expression: ${jsCode}`, error);

                // Replace with error message
                const errorMsg = `[Error: ${error.message}]`;
                processedContent =
                    processedContent.substring(0, matchIndex) +
                    errorMsg +
                    processedContent.substring(matchIndex + fullMatch.length);

                // Reset regex to start from the position after the replacement
                jsExpressionRegex.lastIndex = matchIndex + errorMsg.length;
            }
        }

        return processedContent;
    }

    /**
     * Create a TKML response
     */
    createTkmlResponse(content: string): Response {
        const headers = new Headers({
            'Content-Type': 'application/tkml',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept',
            'Cache-Control': 'no-cache'
        });

        return new Response(content, { headers });
    }

    /**
     * Create an HTML response
     */
    createHtmlResponse(content: string): Response {
        const html = HTML_WRAPPER.replace('{{content}}', content);
        const headers = new Headers({
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept',
            'Cache-Control': 'no-cache'
        });

        return new Response(html, { headers });
    }

    /**
     * Create an SSR response
     */
    createSSRResponse(content: string, js: string, instanceId: string): Response {
        const html = HTML_WRAPPER
            .replace('{{content}}', content)
            .replace('{{js}}', js)
            .replace('{{instanceId}}', instanceId);

        const headers = new Headers({
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept',
            'Cache-Control': 'no-cache'
        });

        return new Response(html, { headers });
    }

    /**
     * Handle the TKML request
     */
    async handle(): Promise<Response> {
        console.log('URL', this.req.url);

        // Handle CORS preflight requests
        const corsResponse = this.handleCorsPreflightRequest();
        if (corsResponse) return corsResponse;

        // Parse POST parameters
        await this.parsePostParams();

        // Handle requests to static files
        const staticResponse = this.handleStaticFileRequest();
        if (staticResponse) return staticResponse;

        // Form full path to file
        const filePath = `${ROOT_DIR}/${this.path}`;
        console.log('filePath:', filePath);

        try {
            // Check if file exists
            const file = Bun.file(filePath);
            const exists = await file.exists();

            if (!exists) {
                return new Response(`TKML file not found: ${this.path}`, {
                    status: 404,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            // Read file content
            let content = await file.text();

            // Process JavaScript expressions in double curly braces
            content = await this.processJsExpressions(content, this.path);

            // Check Accept header
            const acceptHeader = this.req.headers.get('Accept') || '';
            if (acceptHeader.includes('application/tkml')) {
                return this.createTkmlResponse(content);
            } else {
                let html = TKMLinstance.compile(content);
                let js = TKMLinstance.getRuntimeJS();

                return this.createSSRResponse(html, js, TKMLinstance.runtime.getId());
            }
        } catch (error) {
            console.error('Error:', error);
            return new Response('Server Error', { status: 500 });
        }
    }
}

/**
 * Main request handler
 */
async function handleRequest(req: Request): Promise<Response> {
    const handler = new TKMLRequest(req);
    return await handler.handle();
}

// Start the server
const server = Bun.serve({
    port: PORT,
    fetch: handleRequest
});

console.log(`TKML server running at http://localhost:${server.port} (v${VERSION})`); 