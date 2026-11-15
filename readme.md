# Markdown HTML

Exports Markdown files (`.md`) to self-contained single-file HTML documents (`.htmd`) that open in VS Code's built-in viewer and in your default web browser, with all images, stylesheets, and math fonts packed inside.

## Why It Exists

Sharing formatted Markdown notes or documentation usually means sending raw `.md` files, zipping image folders separately, or exporting `.html` files that get mixed up with source code. Exporting to `.htmd` packs the entire rendered document into one standalone file you can inspect in VS Code, open directly from File Explorer, or send offline without broken images, missing equations, or unstyled Markdown.

## Features

- Packs local images, syntax-highlighted code blocks with copy buttons, active stylesheets, and KaTeX math fonts into one offline `.htmd` file.
- Automatically rewrites relative links to other `.md` files to `.htmd` so cross-document links open formatted pages in your browser and the VS Code viewer.
- Supports GitHub Alert callouts (`[!NOTE]` through `[!CAUTION]`), task lists, `:emoji:` shortcodes, LaTeX math, and Mermaid diagrams.
- Updates existing `.htmd` exports automatically whenever you save the source `.md` file, without creating `.htmd` files for documents you haven't exported.
- Includes a read-only `.htmd` viewer inside VS Code with live reload and a toolbar button to jump straight back to the source `.md` file.
- Registers `.htmd` with your default web browser on Windows automatically so double-clicking in File Explorer opens rendered pages directly.

## Usage

Open any `.md` file in VS Code and click the **Export** icon in the top-right editor toolbar, right-click the file in the Explorer or editor and choose **Markdown HTML: Export**, or run **Markdown HTML: Export** from the Command Palette (`Ctrl+Shift+P`). Editing and saving any `.md` file that already has a `.htmd` export refreshes it automatically.

Clicking any `.htmd` file in VS Code opens the built-in **Markdown HTML Viewer**, where you can click **Open Source File** in the toolbar to jump back to its `.md` source, or right-click and choose **Reopen Editor With... -> Text Editor** to view the raw HTML. Outside VS Code, open `.htmd` files in any browser straight from File Explorer.

You can customize auto-save behavior, output folders, code-highlighting themes, and custom CSS in VS Code Settings under **Markdown HTML**. Any theme chosen with [Markdown Stylesheets](https://github.com/tbruneel/vscode-extension-markdown-stylesheets) is applied to both live previews and exported `.htmd` files automatically.

## Companion Projects

| Repository | Role in Suite |
| :--- | :--- |
| **[`tbruneel/vscode-extension-markdown-html`](https://github.com/tbruneel/vscode-extension-markdown-html)** *(this repo)* | Exports Markdown files to self-contained `.htmd` documents with an integrated viewer. |
| **[`tbruneel/vscode-extension-markdown-html-antigravity`](https://github.com/tbruneel/vscode-extension-markdown-html-antigravity)** | Automatically refreshes `.htmd` exports when Antigravity agents edit Markdown files. |
| **[`tbruneel/vscode-extension-markdown-alert`](https://github.com/tbruneel/vscode-extension-markdown-alert)** | Renders GitHub Alert callouts in VS Code's Markdown Preview. |
| **[`tbruneel/vscode-extension-markdown-stylesheets`](https://github.com/tbruneel/vscode-extension-markdown-stylesheets)** | Provides a centered preview layout and switchable GitHub and VS Code themes. |

## Documentation

- [Technical Documentation](./docs/technical.md) — Conversion pipeline, full settings and frontmatter reference, HTML sanitization, custom viewer, Windows association, and packaging.
