# TKML Server Documentation

## Overview

The TKML Server is a lightweight, high-performance server for rendering TKML (Tonkeeper Markup Language) files. It supports server-side rendering (SSR), dynamic content generation, and interactive components through a simple yet powerful templating system.

## Key Features

- **Server-Side Rendering (SSR)** - Pre-renders TKML content for faster initial page loads
- **Dynamic Content Generation** - Supports JavaScript expressions in templates
- **JavaScript/TypeScript Integration** - Include and execute JS/TS files directly in TKML
- **Automatic Routing** - Maps URL paths to TKML files
- **CORS Support** - Built-in cross-origin resource sharing
- **Caching** - Optimized file caching for improved performance

## Server Architecture

The server is built around the `TKMLRequest` class, which handles individual HTTP requests. Each request is processed independently, allowing for clean separation of concerns and improved error handling.

## Basic Usage

Start the server with:
```bash
bun run server.ts
```

The server will run on port 8348 by default and serve TKML files from the `./src` directory.

## URL Routing

The server automatically maps URL paths to TKML files:

- `/example` → `./src/example/index.tkml`
- `/example/page` → `./src/example/page.tkml`
- `/example/page.tkml` → `./src/example/page.tkml`

## Template Syntax

### JavaScript Expressions

TKML supports JavaScript expressions within double curly braces:
```xml
<title><?get.title || 'Default Title'?></title>
<desc>Current time: <?new Date().toLocaleTimeString()?></desc>
```

These expressions are evaluated on the server and their results are inserted into the rendered output.

### Available Variables in Expressions

- `get` - URL query parameters
- `post` - Form submission data
- `include()` - Function to include other files
- Standard JavaScript objects (`Date`, `Math`, `JSON`, etc.)
- Any variables exported from included JS/TS files

## Including Files

### Including TKML Files

You can include other TKML files using the `include()` function:

```xml
<?include("header.tkml")?>
<content>
  <!-- Page content here -->
</content>
<?include("footer.tkml")?>
```

### Including JavaScript/TypeScript Files

You can include and execute JavaScript or TypeScript files:

```xml
<?include("data-loader.ts")?>
```

The included JS/TS files have access to special context variables and functions.

## JavaScript/TypeScript Integration

### Context Variables and Functions

When including a JS/TS file, the following context is available:

#### Variables

- `get` - URL query parameters (with automatic type conversion for numeric values)
- `post` - Form submission data

#### Functions

- `export(name, value)` - Export a variable to make it available in the TKML template
- `finish(content)` - Return TKML content and stop further processing

### Example JS/TS File

```typescript
/// <reference path="../../types.ts" />

// Access query parameters
const userId = get.userId;
const page = get.page || 1;

// Export variables for use in TKML
export('userName', 'John Doe');
export('items', [
  'Item 1: Introduction',
  'Item 2: Getting Started',
  'Item 3: Advanced Topics'
]);

// Or generate and return complete TKML content
if (get.format === 'list') {
  let content = '<list>';
  for (let i = 0; i < 5; i++) {
    content += `<section>Item ${i + 1}</section>`;
  }
  content += '</list>';
  finish(content);
}
```

### Using Exported Variables

Variables exported from JS/TS files can be used in TKML expressions:

```xml
<?include("user-data.ts")?>

<header>Welcome, <?userName?></header>

<list>
  <?items.map(item => `<section>${item}</section>`).join('')?>
</list>
```

### Early Termination with `finish()`

When a JS/TS file calls `finish()`, it immediately stops processing and returns the specified content. This is useful for dynamic content generation or conditional responses.

```typescript
if (get.next) {
  let content = '';
  for (let i = 0; i < 20; i++) {
    content += `<section>Item ${i + get.next}: Content</section>`;
  }
  content += `<loader href="./loader.tkml?next=${get.next + 20}" />`;
  finish(content);
}
```

## TypeScript Support

For better IDE support, you can use the provided type definitions:

```typescript
/// <reference path="../../types.ts" />

// Now you get proper type checking and autocompletion
const page = get.page || 1;
export('items', ['Item 1', 'Item 2']);
```

## Dynamic Loading with `<loader>` Tag

The `<loader>` tag allows for lazy-loading content when the user scrolls to it:

```xml
<list>
  <section>Item 1</section>
  <section>Item 2</section>
  <loader href="more-items.tkml?start=3" />
</list>
```

When the server receives a request to `more-items.tkml?start=3`, it can generate just the additional content:

```typescript
if (get.start) {
  let content = '';
  const start = parseInt(get.start);
  for (let i = 0; i < 10; i++) {
    content += `<section>Item ${start + i}</section>`;
  }
  content += `<loader href="more-items.tkml?start=${start + 10}" />`;
  finish(content);
}
```

## CORS Support

The server includes built-in CORS support, allowing cross-origin requests:

- Handles OPTIONS preflight requests
- Sets appropriate CORS headers for all responses
- Allows GET, POST, and OPTIONS methods

## Caching

The server implements a smart caching strategy:

- Raw file content is cached to avoid repeated disk reads
- Processed results are not cached, ensuring dynamic content is always fresh
- Static assets (JS, CSS) are served with appropriate cache headers

## Error Handling

The server provides detailed error messages for common issues:

- File not found errors
- Circular include detection
- JavaScript execution errors
- Server errors

Errors in JavaScript expressions are replaced with `[Error: message]` in the output.

## Advanced Features

### Relative Path Resolution

When including files, paths are resolved relative to the current file:

```xml
<!-- In src/pages/user.tkml -->
<?include("../components/header.tkml")?> <!-- Resolves to src/components/header.tkml -->
<?include("./profile.ts")?> <!-- Resolves to src/pages/profile.ts -->
```

### Circular Include Detection

The server automatically detects and prevents circular includes, which could cause infinite loops.

## Security Considerations

- JavaScript expressions are executed in a sandboxed environment
- File access is limited to the specified root directory
- Error messages are sanitized to avoid leaking sensitive information

## Performance Tips

1. Use the cache for static content
2. Minimize the number of included files
3. Keep JavaScript expressions simple
4. Use `finish()` to return early when possible
5. Consider splitting large pages into smaller components that can be loaded dynamically

## Example: Complete Application

```xml
<!-- index.tkml -->
<header center>
  <menu href="/menu.tkml" />
  TKML Example App
</header>

<?include("data-loader.ts")?>

<desc>
  Welcome to our example application. Current time: <?new Date().toLocaleTimeString()?>
</desc>

<list>
  <?items.map((item, index) => `
    <section href="item.tkml?id=${index}">${item.title}</section>
  `).join('')?>
  <loader href="index.tkml?page=<?currentPage + 1?>" />
</list>

<footer>
  <navigation>
    <next href="about.tkml">About</next>
  </navigation>
</footer>
```

```typescript
// data-loader.ts
/// <reference path="../types.ts" />

const currentPage = get.page ? parseInt(get.page) : 1;

// Simulate fetching data
const items = [];
const startIndex = (currentPage - 1) * 10;

for (let i = 0; i < 10; i++) {
  items.push({
    id: startIndex + i,
    title: `Item ${startIndex + i}: Dynamic Content`,
    description: `Description for item ${startIndex + i}`
  });
}

export('items', items);
export('currentPage', currentPage);

// If this is a loader request, only return the new items
if (get.page && get.page > 1) {
  let content = items.map((item, index) => 
    `<section href="item.tkml?id=${item.id}">${item.title}</section>`
  ).join('');
  
  // Add another loader if there are more pages
  if (currentPage < 5) {
    content += `<loader href="index.tkml?page=${currentPage + 1}" />`;
  }
  
  finish(content);
}
```

This example demonstrates a complete application with dynamic content loading, pagination, and conditional rendering.