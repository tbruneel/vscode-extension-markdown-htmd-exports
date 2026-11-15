# Markdown HTMD Exports

Exports Markdown files (`.md`) to self-contained single-file HTML documents (`.htmd`) that open in VS Code's built-in viewer and in your default web browser, with all images, stylesheets, and math fonts packed inside.

## Why It Exists

Sharing formatted Markdown notes or documentation usually means sending raw `.md` files, zipping image folders separately, or exporting `.html` files that get mixed up with source code. Exporting to `.htmd` packs the entire rendered document into one standalone file you can inspect in VS Code, open directly from File Explorer, or send offline without broken images, missing equations, or unstyled Markdown.

## Features

- Packs local images, syntax-highlighted code blocks, your active VS Code color theme, and KaTeX math fonts into one offline `.htmd` file.
- Automatically rewrites relative links to other `.md` files to `.htmd` so cross-document links open formatted pages in your browser and the VS Code viewer.
- Picks up [Markdown Alerts](https://github.com/tbruneel/vscode-extension-markdown-alerts) for GitHub callouts (`[!NOTE]` through `[!CAUTION]`) and [Markdown Stylesheets](https://github.com/tbruneel/vscode-extension-markdown-stylesheets) for centered pages, scrollable tables and blockquotes, code copy buttons, and switchable themes whenever installed.
- Supports task lists, `:emoji:` shortcodes, LaTeX math, and Mermaid diagrams.
- Updates existing `.htmd` exports automatically whenever you save the source `.md` file, without creating `.htmd` files for documents you haven't exported.
- Includes a read-only `.htmd` viewer inside VS Code with live theme switching, file-change reload, and a toolbar button to jump straight back to the source `.md` file.
- Registers `.htmd` with your default web browser on Windows automatically so double-clicking in File Explorer opens rendered pages directly.

## Usage

Open any `.md` file in VS Code and click the **Export** icon in the top-right editor toolbar, right-click the file in the Explorer or editor and choose **Markdown HTMD Exports: Export**, or run **Markdown HTMD Exports: Export** from the Command Palette (`Ctrl+Shift+P`). Editing and saving any `.md` file that already has a `.htmd` export refreshes it automatically.

Clicking any `.htmd` file in VS Code opens the built-in **Markdown HTMD Exports Viewer**, where you can click **Open Source File** in the toolbar to jump back to its `.md` source, or right-click and choose **Reopen Editor With... -> Text Editor** to view the raw HTML. Outside VS Code, open `.htmd` files in any browser straight from File Explorer.

You can customize auto-save behavior, output folders, code-highlighting themes, and custom CSS in VS Code Settings under **Markdown HTMD Exports**. Exported `.htmd` documents follow your active VS Code color theme automatically, and any stylesheet chosen with [Markdown Stylesheets](https://github.com/tbruneel/vscode-extension-markdown-stylesheets) or custom Markdown stylesheets (`markdown.styles`) is applied to both live previews and exported `.htmd` files.

## Companion Projects

Each extension in this suite handles one responsibility and works on its own, except **Markdown HTMD Exports for Antigravity** which builds on **Markdown HTMD Exports**. Both VS Code's built-in Markdown Preview and **Markdown HTMD Exports** follow your active VS Code color theme and custom Markdown stylesheets out of the box, and automatically pick up **Markdown Alerts** and **Markdown Stylesheets** whenever they are installed.

| Extension | What It Provides | Works With |
| :--- | :--- | :--- |
| **[Markdown Alerts](https://github.com/tbruneel/vscode-extension-markdown-alerts)** | GitHub Alert callout parsing and styling (`[!NOTE]` through `[!CAUTION]`). | Standalone in Markdown Preview; picked up automatically by **Markdown HTMD Exports**. |
| **[Markdown Stylesheets](https://github.com/tbruneel/vscode-extension-markdown-stylesheets)** | Centered reading width, scrollable tables and blockquotes, code copy buttons, and switchable GitHub / VS Code themes. | Standalone in Markdown Preview; picked up automatically by **Markdown HTMD Exports**. |
| **[Markdown HTMD Exports](https://github.com/tbruneel/vscode-extension-markdown-htmd-exports)** *(this repo)* | Self-contained `.htmd` export, auto-refresh on save, built-in VS Code `.htmd` viewer, and Windows browser association. | Standalone (uses active VS Code theme and custom stylesheets); adopts **Markdown Alerts** and **Markdown Stylesheets** if installed. |
| **[Markdown HTMD Exports for Antigravity](https://github.com/tbruneel/vscode-extension-markdown-htmd-exports-antigravity)** | Antigravity agent hook and CLI skill that keep `.htmd` files synced when agents edit `.md` files on disk. | Requires **Markdown HTMD Exports** (installed automatically) and inherits your full VS Code setup. |

## Documentation

- [Technical Documentation](./docs/technical.md) — Conversion pipeline, full settings and frontmatter reference, HTML sanitization, custom viewer, Windows association, and packaging.
