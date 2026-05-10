# JD Browser

JD Browser is a VS Code extension that adds a browser view to the Activity Bar. It opens inside the left sidebar and defaults to `http://localhost:9111`, which is useful for keeping a local development app visible while you work.

## Features

- Adds a **JD Browser** icon to the VS Code Activity Bar.
- Opens a sidebar webview with address, back, forward, reload, home, and external-open controls.
- Defaults to `http://localhost:9111`.
- Supports normal HTTP and HTTPS pages that allow embedding.
- Detects known sites that block embedded browsers, such as Google, and opens them in the system browser instead.

## Development

Install dependencies:

```bash
npm install
```

Run lint:

```bash
npm run lint
```

Launch the extension:

1. Open this folder in VS Code.
2. Press `F5`.
3. In the Extension Development Host, click the **JD Browser** icon in the Activity Bar.

## Notes

Some websites use security headers that prevent them from loading inside embedded browser frames. JD Browser cannot bypass those protections; it opens those pages externally when detected.
