# TKML (TonKeeper Markup Language)

TKML isn't just a markup language; it's like your retro '90s game console for web apps! No need for CSS or JS—just plug in your components in XML format and play. We've sprinkled in some '90s vibes and a dash of HTTP/1.1 nostalgia to keep things fun and simple.

TKML is designed for building fast, mobile-friendly web applications with minimal configuration. Think of it as your trusty sidekick, providing a set of pre-styled components that follow modern design principles, so you can focus on creating awesome content without sweating the small stuff.

You can create the simplest TKML app by uploading an `index.tkml` page to your website. This page serves as the entry point for your application. Here's a basic example:

1. **Create an `index.tkml` file**: This file will contain your TKML markup. For instance:

   ```xml
   <title>Hello</title>
   <desc>
       Hello world! This is a minimal TKML website.
   </desc>
   ```

2. **Upload the file to your server**: Place the `index.tkml` file in the root directory of your website or any accessible path.

3. **Access your TKML app**: Go to http://tkml.app, and type `example.com/index.tkml` in input field.

This simple setup will render a page with a title and a description, demonstrating the basic structure of a TKML document.

## Features

- 🎨 Pre-styled components with dark/light mode support
- 📱 Mobile-first responsive design
- 🔄 Built-in navigation system with browser history support
- ⚡ Streaming XML parser for fast rendering
- 🎯 Zero CSS/JS configuration needed
- 🔌 Extensible component system

## Quick Start
This example demonstrates how to embed a TKML app within your own application
```html
<!DOCTYPE html>
<html>
<head>
    <title>TKML App</title>
    <link rel="stylesheet" href="./styles.min.css">
    <script src="./tkml.min.js"></script>
</head>
<body>
    <div id="container"></div>
    <script>
        const container = document.getElementById('container');
        const tkml = new TKML(container, { dark: true });
        tkml.load('index.tkml');
    </script>
</body>
</html>
```

## Components

### Title
Displays a heading.
```xml
<title>Regular Title</title>
<title center>Centered Title</title>
```
Attributes:
- `center` - Centers the title text

### Desc
Displays descriptive text in a muted color.
```xml
<desc>Description text</desc>
<desc center>Centered description</desc>
```
Attributes:
- `center` - Centers the description text

### Button
Creates a clickable button.
```xml
<button href="/action">Primary Button</button>
<button type="secondary" href="/back">Secondary Button</button>
<button width="200">Fixed Width Button</button>
<button width="100%">Full Width Button</button>
<button required="field1,field2" href="/submit">Submit</button>
```
Attributes:
- `href` - URL to navigate to when clicked
- `target` - Target window ('_blank' for new window)
- `preload` - Set to "true" to preload the href URL
- `width` - Button width in pixels or percentage (e.g. "200" or "100%")
- `type` - Button style: "secondary" for dark background (default: primary)
- `required` - Comma-separated list of required field names to validate before navigation

Example form with required fields:
```xml
<input name="to" placeholder="Enter name or address" />
<label>Message</label>
<textarea name="message" placeholder="Enter message" rows="10"></textarea>
<button required="to,message" width="100%" href="./messenger-sent.tkml">Send</button>
```

### Input
Creates a text input field.
```xml
<input placeholder="Enter text" href="/submit" name="query" />
```
Attributes:
- `placeholder` - Placeholder text
- `value` - Initial value
- `type` - Input type (text, password, etc)
- `href` - URL to submit to on Enter
- `name` - Parameter name for the submitted value

### Section
Creates a clickable section with optional icon.
```xml
<section href="/details" icon="/icons/arrow.png">Section content</section>
```
Attributes:
- `href` - URL to navigate to when clicked
- `icon` - URL of the icon to display
- `target` - Target window
- `preload` - Set to "true" to preload the href URL

### List
Groups items in a list container.
```xml
<list>
    <section>Item 1</section>
    <section>Item 2</section>
</list>
```

### Info
Another type of list container without any separation between items. The info block always tries to layout elements inside to make them look good.
```xml
<info>
    <img src="/image.jpg" height="200" />
    <title>Title</title>
    <desc>Description</desc>
    <button href="/action">Action</button>
</info>
```

### Checkbox
Creates a toggle switch.
```xml
<checkbox href="/toggle" checked>Toggle me</checkbox>
```
Attributes:
- `href` - URL to call when toggled
- `checked` - Initial checked state
- `target` - Target window
- `preload` - Set to "true" to preload the href URL

### Radio
Creates a radio button in a group.
```xml
<radio group="options" href="/select" checked>Option 1</radio>
<radio group="options" href="/select">Option 2</radio>
```
Attributes:
- `group` - Group name for related radio buttons
- `href` - URL to call when selected
- `checked` - Initial checked state
- `target` - Target window
- `preload` - Set to "true" to preload the href URL

### Code
Displays syntax-highlighted code.
```xml
<code lang="javascript">
const x = 42;
console.log(x);
</code>
```
Attributes:
- `lang` - Programming language for syntax highlighting

### Img
Displays an image.
```xml
<img src="/image.jpg" alt="Description" height="200" />
<img src="/avatar.jpg" circle /> <!-- Circular image, perfect for avatars -->
```
Attributes:
- `src` - Image URL
- `alt` - Alternative text
- `height` - Fixed height in pixels
- `circle` - Makes the image circular (forces 1:1 aspect ratio)

### Loader
Creates a loading indicator that loads content when visible.
```xml
<loader href="/content" />
```
Attributes:
- `href` - URL of content to load when loader becomes visible

### Links
Creates a clickable link.
```xml
<a href="/page" preload="true">Click here</a>
```
Attributes:
- `href` - URL to navigate to
- `target` - Target window ('_blank' for new window)
- `preload` - Set to "true" to preload the href URL

### Text Formatting
Basic text formatting tags:
```xml
<b>Bold text</b>
<i>Italic text</i>
<u>Underlined text</u>
<s>Strikethrough text</s>
```

### Line Break
Adds vertical spacing:
```xml
<br/>           <!-- Default break (20px) -->
```

All components that support navigation (`button`, `section`, `a`, etc) have these common attributes:
- `href` - URL to navigate to
- `target` - Target window ('_blank' for new window)
- `preload` - Set to "true" to preload the URL

### Header
Creates a sticky header that stays at the top while scrolling.
```xml
<header>Regular Header</header>
<header center>Centered Header</header>
```
Attributes:
- `center` - Centers the header text

The header component is useful for creating navigation bars or section titles that should remain visible while scrolling through content.

### Back
Creates a back navigation button. When used inside a header, displays as a round button. When used standalone, displays as a regular button with "Back" text.
```xml
<header>
    <back href="/previous" />
    Page Title
</header>

<!-- Or as standalone button -->
<back href="/home" />
```
Attributes:
- `href` - URL to navigate to (defaults to browser's back action if not specified)
- `target` - Target window ('_blank' for new window)
- `preload` - Set to "true" to preload the href URL

### Footer
Creates a sticky footer that stays at the bottom. Can automatically hide when scrolling down.
```xml
<footer>Regular Footer</footer>
<footer autohide>Auto-hiding Footer</footer>
```
Attributes:
- `autohide` - Makes the footer hide when scrolling down and show when scrolling up

The footer component is useful for creating navigation bars or action buttons that should remain accessible while scrolling.

### Pill
Creates a small oval-shaped label. Multiple pills are automatically grouped horizontally.
```xml
<pill>Label 1</pill>
<pill>Label 2</pill>
<pill>Label 3</pill>
```

Pills are useful for displaying tags, categories, or status indicators. When multiple pills are used consecutively, they are automatically arranged horizontally with proper spacing.

### W
Makes text white, useful for highlighting text in descriptions.
```xml
<desc>Regular text <w>highlighted text</w> regular text</desc>
```

### Bubble
Creates a message bubble like in messenger apps.
```xml
<bubble type="in">
    <img src="./john.jpg" circle="true" />
    <title>John Doe</title>
    Hello, how are you?
</bubble>
<bubble type="out">
    <img src="./rachiel.jpg" circle="true" />
    <title>Me</title>
    I'm fine, thank you!
</bubble>
```
Attributes:
- `type` - Message type: "in" for incoming or "out" for outgoing messages (default: "in")

The bubble component automatically handles:
- Avatar image (using `<img>` tag)
- Sender name (using `<title>` tag)
- Message content (any other content)
- Proper alignment (left for incoming, right for outgoing)
- Message bubble styling with rounded corners

### Label
Creates a form label.
```xml
<label>Field Name</label>
```

### Textarea
Creates a multi-line text input.
```xml
<textarea name="message" placeholder="Enter message" rows="10" />
```
Attributes:
- `placeholder` - Placeholder text
- `value` - Initial value
- `rows` - Number of visible text rows
- `href` - URL to submit to on Ctrl+Enter
- `name` - Parameter name for the submitted value

Example of a form layout:
```xml
<label>To</label>
<input name="to" placeholder="Enter name or address" />
<label>Message</label>
<textarea name="message" placeholder="Enter message" rows="10" />
```

### Msg
Creates a notification message with different styles.
```xml
<msg type="success">Operation completed successfully</msg>
<msg type="error">Something went wrong</msg>
<msg type="warning">Please be careful</msg>
<msg type="info">Just letting you know</msg>
```
Attributes:
- `type` - Message type: "success", "error", "warning", or "info" (default: "info")

Example usage:
```xml
<msg type="success">Message sent successfully</msg>
<button width="100%" href="messenger.tkml">Back to messages</button>
```

### Navigation
Creates a pagination block with navigation controls.
```xml
<navigation>
    <prev href="/page/1">Previous</prev>
    <page href="/page/1">1</page>
    <page href="/page/2" active>2</page>
    <page href="/page/3">3</page>
    <next href="/page/3">Next</next>
</navigation>
```

Components:
- `<navigation>` - Container for pagination elements
- `<prev>` - Previous page button with left arrow
- `<next>` - Next page button with right arrow
- `<page>` - Page number button

Attributes:
- `href` - URL to navigate to when clicked
- `active` - Marks the current page (for `<page>` component)
- `target` - Target window ('_blank' for new window)
- `preload` - Set to "true" to preload the href URL

Example for simple next/previous navigation:
```xml
<navigation>
    <prev href="example1.tkml">Previous Example</prev>
    <next href="example3.tkml">Next Example</next>
</navigation>
```

## Examples

Complete page example:
```