const PORT = 8348;
const ROOT_DIR = './src'; // Корневая директория с TKML файлами
const VERSION = '4';

// HTML wrapper template
const HTML_WRAPPER = `<!DOCTYPE html>
<html>
<head>
    <title>TKML App</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAHdElNRQflAx4QGA4EvmzDAAAA30lEQVRIx2NgGAWMCKa8JKM4A8Ovt88ekyLCDGOoyDBJMjExMbFy8zF8/EKsCAMDE8yAPyIwFps48SJIBpAL4AZwvoSx/r0lXgQpDN58EWL5x/7/H+vL20+JFxluQKVe5b3Ke5V+0kQQCamfoYKBg4GDwUKI8d0BYkWQkrLKewYBKPPDHUFiRaiZkBgmwhj/F5IgggyUJ6i8V3mv0kCayDAAeEsklXqGAgYGhgV3CnGrwVciYSYk0kokhgS44/JxqqFpiYSZbEgskd4dEBRk1GD4wdB5twKXmlHAwMDAAACdEZau06NQUwAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMC0wNy0xNVQxNTo1Mzo0MCswMDowMCVXsDIAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjAtMDctMTVUMTU6NTM6NDArMDA6MDBUCgiOAAAAAElFTkSuQmCC">
    <link rel="stylesheet" href="/styles.min.css?${VERSION}">
    <script src="/tkml.min.js?${VERSION}"></script>
</head>
<body>
    <div id="container"></div>
    <script>
        const tkml = new TKML(document.getElementById('container'), { dark: true, URLControl: true });
        tkml.fromText(\`{{content}}\`);
    </script>
</body>
</html>`;

async function handleTkmlRequest(req: Request): Promise<Response> {
    console.log('URL', req.url);
    const url = new URL(req.url);
    let path = url.pathname;

    // Убираем начальный слеш
    path = path.replace(/^\//, '');

    // Проверяем является ли путь TKML файлом
    if (!path.endsWith('.tkml')) {
        // Если нет, считаем что это директория и добавляем index.tkml
        path = path.replace(/\/?$/, '/index.tkml');
    }

    // Формируем полный путь к файлу
    const filePath = `${ROOT_DIR}/${path}`;

    console.log('filePath', filePath);

    try {
        // Проверяем существование файла
        const file = Bun.file(filePath);
        const exists = await file.exists();

        if (!exists) {
            return new Response(`TKML file not found: ${path}`, {
                status: 404,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // Читаем содержимое файла
        const content = await file.text();

        // Проверяем Accept заголовок
        const acceptHeader = req.headers.get('Accept') || '';
        if (acceptHeader.includes('application/tkml')) {
            return createTkmlResponse(content);
        } else {
            return createHtmlResponse(content);
        }
    } catch (error) {
        console.error('Error:', error);
        return new Response('Server Error', { status: 500 });
    }
}

function createTkmlResponse(content: string): Response {
    const headers = new Headers({
        'Content-Type': 'application/tkml',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Accept',
        'Cache-Control': 'no-cache'
    });

    return new Response(content, { headers });
}

function createHtmlResponse(content: string): Response {
    const html = HTML_WRAPPER.replace('{{content}}', content);
    const headers = new Headers({
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
    });

    return new Response(html, { headers });
}

const server = Bun.serve({
    port: PORT,
    fetch: handleTkmlRequest
});

console.log(`TKML server running at http://localhost:${server.port}`); 