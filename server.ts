const PORT = 8348;
const ROOT_DIR = './src'; // Root directory with TKML files
const VERSION = '19';

// Import TKML from local file
import { TKML } from './tkml.server.js';

const HTML_WRAPPER = `<!DOCTYPE html>
<html>
<head>
    <title>TKML App</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAHdElNRQflAx4QGA4EvmzDAAAA30lEQVRIx2NgGAWMCKa8JKM4A8Ovt88ekyLCDGOoyDBJMjExMbFy8zF8/EKsCAMDE8yAPyIwFps48SJIBpAL4AZwvoSx/r0lXgQpDN58EWL5x/7/H+vL20+JFxluQKVe5b3Ke5V+0kQQCamfoYKBg4GDwUKI8d0BYkWQkrLKewYBKPPDHUFiRaiZkBgmwhj/F5IgggyUJ6i8V3mv0kCayDAAeEsklXqGAgYGhgV3CnGrwVciYSYk0kokhgS44/JxqqFpiYSZbEgskd4dEBRk1GD4wdB5twKXmlHAwMDAAACdEZau06NQUwAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMC0wNy0xNVQxNTo1Mzo0MCswMDowMCVXsDIAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjAtMDctMTVUMTU6NTM6NDArMDA6MDBUCgiOAAAAAElFTkSuQmCC">
    <link rel="stylesheet" href="https://tkml.app/styles.min.css?${VERSION}">
    <script src="https://tkml.app/tkml.min.js?${VERSION}"></script>
</head>
<body>
    <div id="container" class="tkml-cont">{{content}}</div>
    <script>
        const tkml = new TKML(document.getElementById('container'), { dark: true, URLControl: true, instanceId: {{instanceId}} });
        {{js}}
    </script>
</body>
</html>`;

// Create TKML instance for server-side rendering
const TKMLinstance = new TKML(null, { isServer: true });

// Cache for imported files to avoid repeated reading
const importCache = new Map<string, string>();

// Set to track files currently being processed to prevent circular includes
const processingFiles = new Set<string>();

// Function to include file content
async function includeFile(
    filePath: string,
    getParams: Record<string, string> = {},
    postParams: Record<string, string> = {}
): Promise<string> {
    // Check cache
    if (importCache.has(filePath)) {
        return importCache.get(filePath)!;
    }

    // Check for circular includes
    if (processingFiles.has(filePath)) {
        console.error(`Circular include detected: ${filePath}`);
        return `[Error: Circular include detected: ${filePath}]`;
    }

    // Mark file as being processed
    processingFiles.add(filePath);

    // Form full path to file
    const fullPath = `${ROOT_DIR}/${filePath}`;

    try {
        const file = Bun.file(fullPath);
        const exists = await file.exists();

        if (!exists) {
            processingFiles.delete(filePath);
            console.error(`Import file not found: ${fullPath}`);
            return `[Error: Import file not found: ${filePath}]`;
        }

        // Read file content
        let content = await file.text();

        // Process JavaScript expressions in the included file
        content = await processJsExpressions(content, getParams, postParams);

        // Cache the processed result
        importCache.set(filePath, content);

        // Mark file as no longer being processed
        processingFiles.delete(filePath);

        return content;
    } catch (error) {
        // Make sure to remove from processing set in case of error
        processingFiles.delete(filePath);
        console.error(`Error importing file ${filePath}:`, error);
        return `[Error importing ${filePath}: ${error.message}]`;
    }
}

// Function to execute JavaScript code inside double curly braces
async function processJsExpressions(
    content: string,
    getParams: Record<string, string> = {},
    postParams: Record<string, string> = {}
): Promise<string> {
    // Regular expression to find expressions like {{...}}
    const jsExpressionRegex = /\{\{([\s\S]*?)\}\}/g;

    // Find all matches
    const matches = Array.from(content.matchAll(jsExpressionRegex));

    // Process each match sequentially
    for (const match of matches) {
        const fullMatch = match[0];
        const jsCode = match[1];

        try {
            // Create a safe context for code execution with import function and parameters
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
                include: async (path: string) => await includeFile(path, getParams, postParams),
                get: getParams,
                post: postParams
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

            // Replace the expression with the execution result
            content = content.replace(fullMatch, String(result));
        } catch (error) {
            console.error(`Error executing JS expression: ${jsCode}`, error);
            content = content.replace(fullMatch, `[Error: ${error.message}]`);
        }
    }

    return content;
}

async function handleTkmlRequest(req: Request): Promise<Response> {
    console.log('URL', req.url);
    const url = new URL(req.url);
    let path = url.pathname;

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Accept',
                'Access-Control-Max-Age': '86400' // 24 hours
            }
        });
    }

    // Parse GET parameters
    const getParams = Object.fromEntries(url.searchParams.entries());

    // Parse POST parameters if method is POST
    let postParams: Record<string, string> = {};
    if (req.method === 'POST') {
        try {
            const contentType = req.headers.get('Content-Type') || '';

            if (contentType.includes('application/json')) {
                // Handle JSON data
                const jsonData = await req.json();
                postParams = jsonData;
            } else if (contentType.includes('application/x-www-form-urlencoded') ||
                contentType.includes('multipart/form-data')) {
                // Handle form data
                const formData = await req.formData();
                // Use type assertion to access entries method
                postParams = Object.fromEntries((formData as any).entries());
            }
        } catch (error) {
            console.error('Error parsing POST data:', error);
        }
    }

    // Handle requests to static files
    if (path === '/tkml.min.js') {
        return serveStaticFile('./tkml.min.js', 'application/javascript');
    } else if (path === '/styles.min.css') {
        return serveStaticFile('./styles.min.css', 'text/css');
    }

    // Remove leading slash
    path = path.replace(/^\//, '');

    // Check if the path is a TKML file
    if (!path.endsWith('.tkml')) {
        // If not, assume it's a directory and add index.tkml
        path = path.replace(/\/?$/, '/index.tkml');
    }

    // Form full path to file
    const filePath = `${ROOT_DIR}/${path}`;

    console.log('filePath:', filePath);

    try {
        // Check if file exists
        const file = Bun.file(filePath);
        const exists = await file.exists();

        if (!exists) {
            return new Response(`TKML file not found: ${path}`, {
                status: 404,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // Read file content
        let content = await file.text();

        // Process JavaScript expressions in double curly braces with GET and POST parameters
        content = await processJsExpressions(content, getParams, postParams);

        // Check Accept header
        const acceptHeader = req.headers.get('Accept') || '';
        if (acceptHeader.includes('application/tkml')) {
            return createTkmlResponse(content);
        } else {
            let html = TKMLinstance.compile(content);
            let js = TKMLinstance.getRuntimeJS();

            return createSSRResponse(html, js, TKMLinstance.runtime.getId());
        }
    } catch (error) {
        console.error('Error:', error);
        return new Response('Server Error', { status: 500 });
    }
}

// Function to serve static files
async function serveStaticFile(filePath: string, contentType: string): Promise<Response> {
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

function createTkmlResponse(content: string): Response {
    const headers = new Headers({
        'Content-Type': 'application/tkml',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Cache-Control': 'no-cache'
    });

    return new Response(content, { headers });
}

function createHtmlResponse(content: string): Response {
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

function createSSRResponse(content: string, js: string, instanceId: string): Response {
    const html = HTML_WRAPPER.replace('{{content}}', content).replace('{{js}}', js).replace('{{instanceId}}', instanceId);
    const headers = new Headers({
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Cache-Control': 'no-cache'
    });

    return new Response(html, { headers });
}

const server = Bun.serve({
    port: PORT,
    fetch: handleTkmlRequest
});

console.log(`TKML server running at http://localhost:${server.port}`); 