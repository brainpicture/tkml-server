import { watch } from "fs";

const PORT = 8348;
const ROOT_DIR = './src'; // Root directory with TKML files
const VERSION = '47';

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
    <link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAHdElNRQflAx4QGA4EvmzDAAAA30lEQVRIx2NgGAWMCKa8JKM4A8Ovt88ekyLCDGOoyDBJMjExMbFy8zF8/EKsCAMDE8yAPyIwFps48SJIBpAL4AZwvoSx/r0lXgQpDN58EWL5x/7/H+vL20+JFxluQKVe5b3Ke5V+0kQQCamfoYKBg4GDwUKI8d0BYkWQkrLKewYBKPPDHUFiRaiZkBgmwhj/F5IgggyUJ6i8V3mv0kCayDAAeEsklXqGAgYGhgV3CnGrwVciYSYk0kokhgS44/JxqqFpiYSZbEgskd4dEBRk1GD4wdB5twKXmlHAwMDAAACdEZau06NQUwAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMC0wNy0xNVQxNTo1Mzo0MCswMDowMCVXsDIAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjAtMDctMTVUMTU6NTM6NDArMDA6MDBUCgiOAAAAAElFTkSuQmCC">
    <link rel="stylesheet" href="https://tkml.app/styles.min.css?${VERSION}">
    <script src="https://tkml.app/tkml.min.js?${VERSION}"></script>
</head>
<body class="dark">
    <?content?>
    <script>
        const tkml = new TKML(document.getElementById('container-<?instanceId?>'), { dark: true, URLControl: true, instanceId: <?instanceId?> });
        tkml.setCurrentUrl()
        <?js?>
    </script>
</body>
</html>
`;

// Cache for imported files (raw content)
const importCache = new Map<string, string>();

// Cache for processed TKML files
const processedCache = new Map<string, {
    content: string,
    dependencies: Set<string>,
    lastModified: number
}>();

// Cache for compiled HTML
const compiledCache = new Map<string, {
    html: string,
    dependencies: Set<string>,
    lastModified: number
}>();

// Track file dependencies (which files include which)
const fileDependencies = new Map<string, Set<string>>();

// Set up file watching
const watcher = watch(
    import.meta.dir,
    { recursive: true },
    (event, filename) => {
        if (!filename) return;

        console.log(`Detected ${event} in ${filename}`);

        // Clear import cache for this file
        const normalizedPath = filename.replace(/\\/g, '/');

        // If it's a source file, invalidate its cache and dependencies
        if (normalizedPath.startsWith(ROOT_DIR.substring(2))) {
            const relativePath = normalizedPath.substring(ROOT_DIR.substring(2).length);
            console.log(`Invalidating cache for ${relativePath}`);
            invalidateCache(relativePath);
        } else if (normalizedPath === 'server.ts' || normalizedPath === 'tkml.server.js') {
            console.log('Server file changed, clearing all caches');
            importCache.clear();
            processedCache.clear();
            compiledCache.clear();
            fileDependencies.clear();
        }
    }
);

// Clean up watcher on exit
process.on('exit', () => {
    watcher.close();
});

/**
 * Check if a file has been modified since it was cached
 */
async function isFileModified(filePath: string, cachedTime: number): Promise<boolean> {
    try {
        const file = Bun.file(filePath);
        const exists = await file.exists();
        if (!exists) return true;

        const stat = file.size > 0 ? new Date(await file.lastModified) : new Date();
        return stat.getTime() > cachedTime;
    } catch (error) {
        console.error(`Error checking file modification time for ${filePath}:`, error);
        // If there's an error, assume the file has changed
        return true;
    }
}

/**
 * Invalidate cache for a file and all files that depend on it
 */
function invalidateCache(filePath: string, visited = new Set<string>()) {
    // Prevent infinite recursion
    if (visited.has(filePath)) return;
    visited.add(filePath);

    console.log(`Invalidating cache for ${filePath}`);

    // Remove from caches
    importCache.delete(filePath);
    processedCache.delete(filePath);
    compiledCache.delete(filePath);

    // Invalidate all files that depend on this file
    const dependents = fileDependencies.get(filePath);
    if (dependents) {
        for (const dependent of Array.from(dependents)) {
            invalidateCache(dependent, visited);
        }
    }
}

/**
 * Add a dependency relationship between files
 */
function addDependency(parentFile: string, dependsOnFile: string) {
    if (!fileDependencies.has(dependsOnFile)) {
        fileDependencies.set(dependsOnFile, new Set());
    }
    fileDependencies.get(dependsOnFile)!.add(parentFile);
}

// Add this type definition at the top of your file
interface Context {
    exports: Record<string, any>;
}

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
    private finishedResult: string = '';
    private currentDependencies: Set<string> = new Set();

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

        // Handle specific static files
        if (path === '/tkml.min.js') {
            return this.serveStaticFile('./tkml.min.js', 'application/javascript');
        } else if (path === '/styles.min.css') {
            return this.serveStaticFile('./styles.min.css', 'text/css');
        }

        // Get file extension
        const extension = path.split('.').pop()?.toLowerCase() || '';

        // Map of file extensions to content types
        const contentTypeMap: Record<string, string> = {
            // Images
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'webp': 'image/webp',
            'ico': 'image/x-icon',

            // JavaScript
            'js': 'application/javascript',

            // Videos
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',

            // Audio
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',

            // Documents
            'pdf': 'application/pdf',

            // Fonts
            'woff': 'font/woff',
            'woff2': 'font/woff2',
            'ttf': 'font/ttf',
            'otf': 'font/otf',

            // Other
            'json': 'application/json',
            'xml': 'application/xml',
            'txt': 'text/plain',
            'csv': 'text/csv'
        };

        // Check if we have a content type for this extension
        if (extension && contentTypeMap[extension]) {
            const contentType = contentTypeMap[extension];

            // Remove leading slash if present
            const relativePath = path.startsWith('/') ? path.substring(1) : path;

            // Always look in src directory first
            const srcPath = `${ROOT_DIR}/${relativePath}`;

            // Try to serve the file
            return this.serveStaticFile(srcPath, contentType);
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
     * Include file content with caching
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

        // Track dependency relationship if we have a parent file
        if (currentFilePath) {
            addDependency(currentFilePath, resolvedPath);
            this.currentDependencies.add(resolvedPath);
        }

        try {
            // Check if file exists
            const file = Bun.file(fullPath);
            const exists = await file.exists();
            if (!exists) {
                console.error(`Import file not found: ${fullPath}`);
                return `[Error: Import file not found: ${resolvedPath}]`;
            }

            // Get file modification time
            const fileLastModified = await file.lastModified;

            // Get raw file content from cache or read from disk
            let fileContent;
            if (importCache.has(resolvedPath)) {
                fileContent = importCache.get(resolvedPath)!;
            } else {
                fileContent = await file.text();
                importCache.set(resolvedPath, fileContent);
            }

            // Check for circular includes
            if (this.processingFiles.has(resolvedPath)) {
                console.error(`Circular include detected: ${resolvedPath}`);
                return `[Error: Circular include detected: ${resolvedPath}]`;
            }

            // Mark this file as being processed
            this.processingFiles.add(resolvedPath);

            let processedContent;

            // Process the file based on its extension
            if (resolvedPath.endsWith('.js') || resolvedPath.endsWith('.ts')) {
                // For JS/TS files, execute them every time (no caching of execution results)
                try {
                    // Create a context for the script
                    const context = {
                        get: this.getParams,
                        post: this.postParams,
                        exports: {},
                        finish: (content: string) => {
                            this.finished = true;
                            this.finishedResult = content;
                            return content;
                        },
                        export: (name: string, value: any) => {
                            (context.exports as Record<string, any>)[name] = value;
                        }
                    };

                    // Execute the script
                    const asyncFunction = new Function('context', `
                        return (async function() {
                            const get = context.get;
                            const post = context.post;
                            const finish = context.finish;
                            const export_ = context.export;
                            ${fileContent}
                            return context.exports;
                        })();
                    `);

                    const exports = await asyncFunction(context);

                    console.log('ASYNC FUNC CALLED exports:', exports);
                    console.log('this.finished:', this.finished);

                    // If finish() was called, return the saved result
                    if (this.finished) {
                        return this.finishedResult;
                    }

                    // Otherwise, return empty string since nothing was returned
                    // while the execution of file
                    processedContent = ``;
                } catch (error) {
                    const err = error as Error;
                    console.error(`Error executing script ${resolvedPath}:`, err);
                    processedContent = `[Error executing script: ${err.message}]`;
                }
            } else {
                // For TKML files, check if we have a cached processed version that's still valid
                const cachedProcessed = processedCache.get(resolvedPath);
                if (cachedProcessed && cachedProcessed.lastModified >= fileLastModified) {
                    // Check if any dependencies have changed
                    let dependencyChanged = false;

                    for (const dep of cachedProcessed.dependencies) {
                        const depFullPath = `${ROOT_DIR}/${dep}`;
                        if (await isFileModified(depFullPath, cachedProcessed.lastModified)) {
                            dependencyChanged = true;
                            break;
                        }
                    }

                    if (!dependencyChanged) {
                        // Remove this file from the processing set
                        this.processingFiles.delete(resolvedPath);
                        return cachedProcessed.content;
                    }

                    // If dependencies changed, invalidate cache
                    invalidateCache(resolvedPath);
                }

                // Save current dependencies
                const prevDependencies = new Set(this.currentDependencies);
                this.currentDependencies = new Set();

                // Process the file
                processedContent = await this.processJsExpressions(fileContent, resolvedPath);

                // Collect dependencies from this processing
                const dependencies = new Set(this.currentDependencies);

                // Restore previous dependencies
                this.currentDependencies = prevDependencies;

                // Add current dependencies to parent
                for (const dep of dependencies) {
                    this.currentDependencies.add(dep);
                }

                // Cache the processed content with dependencies
                processedCache.set(resolvedPath, {
                    content: processedContent,
                    dependencies,
                    lastModified: fileLastModified
                });
            }

            // Remove this file from the processing set
            this.processingFiles.delete(resolvedPath);

            return processedContent;
        } catch (error) {
            // Remove this file from the processing set in case of error
            this.processingFiles.delete(resolvedPath);
            const err = error as Error;
            console.error(`Error including file ${resolvedPath}:`, err);
            return `[Error including file: ${err.message}]`;
        }
    }

    /**
     * Process JavaScript expressions in <? ... ?> tags
     * Supports both inline expressions and code blocks
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

        try {
            // Split the content into alternating chunks of text and JS code
            const chunks = content.split(/(<\?|\?>)/g);
            let isCode = false;
            let functionBody = 'let __result = "";\n';

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                if (chunk === '<?') {
                    isCode = true;
                    continue;
                } else if (chunk === '?>') {
                    isCode = false;
                    continue;
                }

                if (isCode) {
                    // This is a JS code block
                    const trimmedChunk = chunk.trim();

                    // Check if it's a simple expression (no control structures, no semicolons, no curly braces)
                    const isSimpleExpression = !trimmedChunk.includes(';') &&
                        !trimmedChunk.includes('{') &&
                        !trimmedChunk.includes('}') &&
                        !trimmedChunk.startsWith('if') &&
                        !trimmedChunk.startsWith('for') &&
                        !trimmedChunk.startsWith('while') &&
                        !trimmedChunk.startsWith('switch') &&
                        !trimmedChunk.startsWith('function') &&
                        !trimmedChunk.startsWith('class') &&
                        !trimmedChunk.startsWith('return');

                    if (isSimpleExpression) {
                        // For simple expressions, check if it contains function calls (has parentheses)
                        const containsFunctionCall = /\([^)]*\)/.test(trimmedChunk);

                        if (containsFunctionCall) {
                            // If it contains a function call, await the result
                            functionBody += `__result += String(await (${trimmedChunk}));\n`;
                        } else {
                            // Otherwise, just add the result directly
                            functionBody += `__result += String(${trimmedChunk});\n`;
                        }
                    } else {
                        // For complex code blocks, add them directly
                        functionBody += chunk + '\n';
                    }
                } else if (chunk) {
                    // This is a text chunk - add it as a string concatenation
                    // Escape backticks, newlines, and other special chars
                    const escapedChunk = chunk
                        .replace(/`/g, '\\`')
                        .replace(/\$/g, '\\$');
                    functionBody += `__result += \`${escapedChunk}\`;\n`;
                }
            }

            functionBody += 'return __result;';

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
                    const result = await this.includeFile(path, currentFilePath);
                    return result;
                },
                // Add a function to finish processing and return a result
                finish: (result: string) => {
                    this.finished = true;
                    this.finishedResult = result;
                },
                get: this.getParams,
                post: this.postParams,
                // Add all exports from included JS/TS files
                ...allExports
            };

            console.log('functionBody:', functionBody);

            // Create an async function to execute the code
            const asyncFunction = new Function('sandbox', `
                return (async function() {
                    with(sandbox) {
                        ${functionBody}
                    }
                })();
            `);

            // Execute the function and get the result
            const result = await asyncFunction(sandbox);

            // Check if we need to stop processing due to finish() being called
            if (this.finished) {
                return this.finishedResult;
            }

            return result;
        } catch (error) {
            const err = error as Error;
            console.error('Error executing template:', err);
            return `[Error: ${err.message}]`;
        }
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
     * Create an SSR response
     */
    createSSRResponse(content: string, js: string, instanceId: string): Response {
        const html = HTML_WRAPPER
            .replace('<?content?>', content)
            .replace('<?js?>', js)
            .replaceAll('<?instanceId?>', instanceId);

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
     * Handle the TKML request with caching
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

            // Get file stats for modification time
            const fileLastModified = file.size > 0 ? await file.lastModified : Date.now();

            // Check Accept header
            const acceptHeader = this.req.headers.get('Accept') || '';

            // Check if we have a valid cached compiled version
            if (acceptHeader.includes('application/tkml')) {
                // For TKML requests, check processed cache
                const cachedProcessed = processedCache.get(this.path);

                if (cachedProcessed && cachedProcessed.lastModified >= fileLastModified) {
                    // Check if any dependencies have changed
                    let dependencyChanged = false;

                    for (const dep of cachedProcessed.dependencies) {
                        const depFullPath = `${ROOT_DIR}/${dep}`;
                        if (await isFileModified(depFullPath, cachedProcessed.lastModified)) {
                            dependencyChanged = true;
                            break;
                        }
                    }

                    if (!dependencyChanged) {
                        return this.createTkmlResponse(cachedProcessed.content);
                    }

                    // If dependencies changed, invalidate cache
                    invalidateCache(this.path);
                }

                // Process the file
                this.currentDependencies = new Set();
                const content = await this.processJsExpressions(await file.text(), this.path);

                return this.createTkmlResponse(content);
            } else {
                // For HTML requests, check compiled cache
                const cachedCompiled = compiledCache.get(this.path);

                if (cachedCompiled && cachedCompiled.lastModified >= fileLastModified) {
                    // Check if any dependencies have changed
                    let dependencyChanged = false;

                    for (const dep of cachedCompiled.dependencies) {
                        const depFullPath = `${ROOT_DIR}/${dep}`;
                        if (await isFileModified(depFullPath, cachedCompiled.lastModified)) {
                            dependencyChanged = true;
                            break;
                        }
                    }

                    if (!dependencyChanged) {
                        return this.createSSRResponse(
                            cachedCompiled.html,
                            TKMLinstance.getRuntimeJS(),
                            TKMLinstance.runtime.getId()
                        );
                    }

                    // If dependencies changed, invalidate cache
                    invalidateCache(this.path);
                }

                // Process and compile the file
                this.currentDependencies = new Set();
                const content = await this.processJsExpressions(await file.text(), this.path);
                const html = TKMLinstance.compile(content);

                // Cache the compiled HTML
                compiledCache.set(this.path, {
                    html,
                    dependencies: this.currentDependencies,
                    lastModified: fileLastModified
                });

                return this.createSSRResponse(
                    html,
                    TKMLinstance.getRuntimeJS(),
                    TKMLinstance.runtime.getId()
                );
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