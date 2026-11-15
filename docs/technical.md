# Technical Documentation — Markdown HTMD Exports

This engineering reference covers the `markdown-it` conversion pipeline, active VS Code theme extraction, companion extension integration, asset and font inlining, raw HTML sanitization, custom `.htmd` viewer, Windows per-user `.htmd` registration, full settings schema, and packaging workflow across [`source/extension.ts`](../source/extension.ts), [`source/vscode-theme.ts`](../source/vscode-theme.ts), [`source/utils.ts`](../source/utils.ts), [`source/html-viewer.ts`](../source/html-viewer.ts), and [`source/windows-association.ts`](../source/windows-association.ts).

## 1. Architecture & Repository Layout

```text
vscode-extension-markdown-htmd-exports/
├── .gitignore                        # Ignores *.htmd, node_modules/, build/, package/, *.vsix, .DS_Store
├── .vscodeignore                     # Excludes source/*.ts, source/types/, **/*.vsix, build.ps1, package/, readme.md, docs/, .agents/, **/*.htmd; keeps highlight.js styles
├── assets/
│   ├── icon.png                      # 256x256 Marketplace extension icon
│   └── katex/                        # Bundled katex.min.css and .woff2/.woff/.ttf font files
├── build.ps1                         # Type-checks, bundles build/extension.js, and outputs package\<repo>-v<ver>.vsix
├── license.md                        # MIT license
├── package.json                      # Manifest declaring viewer, commands, settings & esbuild scripts
├── tsconfig.json                     # TypeScript compiler configuration
├── readme.md                         # User guide, features & usage
├── docs/
│   └── technical.md                  # Architecture, settings/frontmatter contracts, sanitization & packaging
├── source/
│   ├── extension.ts                  # Activation hook, commands, save listener, companion discovery & export pipeline
│   ├── vscode-theme.ts               # Active color theme JSONC resolver, ColorRegistry defaults & :root CSS vars
│   ├── html-viewer.ts                # MarkdownHtmdExportsViewerProvider (CustomReadonlyEditorProvider)
│   ├── windows-association.ts        # Per-user HKCU .htmd file association & browser resolution
│   ├── utils.ts                      # Frontmatter parser, ordered CSS/Base64 builders & sanitizeRawHtml
│   ├── logger.ts                     # OutputChannel logging facade decoupled from vscode
│   ├── math-renderer.ts              # KaTeX renderMath helper with macro merging
│   ├── markdown-it-checkbox.ts       # Task list checkbox token transformer
│   ├── markdown-it-named-headers.ts  # GitHub-compatible heading slugifier & duplicate suffixing
│   ├── markdown-it-math-brackets.ts  # \(...\) and \[...\] inline and display math rules
│   ├── markdown-it-math-fence.ts     # ```math fenced code block KaTeX renderer
│   ├── markdown-it-sanitize.ts       # html_block and html_inline sanitization hooks
│   ├── template.html                 # HTML wrapper with body polarity class, conditional Mermaid & preview scripts
│   └── types/
│       └── markdown-it-emoji.d.ts    # Ambient type declarations for markdown-it-emoji
└── styles/
    ├── vscode-markdown.css           # VS Code webview @layer vscode-default + markdown-language-features base CSS
    └── vscode-highlight.css          # VS Code built-in vs2015 dark + vs light highlight.js theme
```

```mermaid
flowchart LR
    Trigger["Export Command / onDidSaveTextDocument"] -->|"Check convertOnSave & exclude patterns"| Convert["convertMarkdownToHtml (markdown-it + markdown-alerts + KaTeX)"]
    Convert -->|"Rendered HTML + SanitizeReport"| Wrap["makeHtml (:root Theme Vars + Ordered Styles + previewScripts)"]
    Wrap -->|"Write UTF-8"| HtmdFile["Output .htmd Document"]
    HtmdFile -->|"CustomReadonlyEditorProvider"| Viewer["MarkdownHtmdExportsViewerProvider"]
    Activate["First Win32 Activation"] -->|"HKCU\\Software\\Classes\\.htmd"| WinAssoc["ensureWindowsHtmdAssociation"]
```

## 2. Markdown-to-`.htmd` Conversion Pipeline & Suite Interoperability

| Component | Owned Assets / APIs | Markdown Preview Path | `.htmd` Export Path |
| :--- | :--- | :--- | :--- |
| *(VS Code Core)* | Active Color Theme JSONC, `workbench.colorCustomizations`, `markdown.styles` | Injects `--vscode-*` vars on `<html>`, built-in webview CSS, and user `markdown.styles`. | `resolveActiveVscodeThemeContext` emits `--vscode-*` vars on `:root`; `buildStyleTags` inlines [`styles/vscode-markdown.css`](../styles/vscode-markdown.css), [`styles/vscode-highlight.css`](../styles/vscode-highlight.css), and `markdown.styles`. |
| `tbruneel.markdown-alerts` | `extendMarkdownIt` (`github-alerts` ruler) + `styles/markdown-alerts.css` | Loaded via `contributes.markdown.markdownItPlugins` and `markdown.previewStyles`. | Discovered via `vscode.extensions.getExtension` (with `createRequire` fallback before preview activation) and inlined when installed; plain blockquotes remain unchanged when absent. |
| `tbruneel.markdown-stylesheets` | `styles/markdown-preview-layout.css`, `source/copy-code-button.js`, `styles/markdown-*.css` via `markdown.styles` | `previewStyles` and `previewScripts` always active; preset CSS applied via global `markdown.styles`. | Discovered dynamically to inline `previewStyles` and `previewScripts` alongside any active preset in `markdown.styles`. |
| `tbruneel.markdown-htmd-exports` | `convertMarkdownToHtml`, `makeHtml`, `MarkdownHtmdExportsViewerProvider`, `ensureWindowsHtmdAssociation` | Independent of Markdown Preview. | Owns `.htmd` compilation, KaTeX/Mermaid/image/font inlining, `.md` -> `.htmd` link rewriting, custom viewer, and per-user `HKCU` browser association. |
| `tbruneel.markdown-htmd-exports-antigravity` | `plugins/markdown-htmd-exports/**`, `.base-extension-path`, `headless-bridge.ts` | None. | Declares `extensionDependencies: ["tbruneel.markdown-htmd-exports"]`, registers `~/.gemini/config/plugins.json`, and shims `vscode` in Node CLI/hook runs to call `tbruneel.markdown-htmd-exports/build/extension.js`. |

Triggering `extension.markdown-htmd-exports.export` or saving a Markdown file under `onDidSaveMarkdownDocument` delegates to `exportDocumentToHtml`, which exports `convertMarkdownToHtml` and `makeHtml` so both VS Code events and companion tools share identical output. `convertMarkdownToHtml` first parses optional YAML frontmatter via [`parseFrontMatter`](../source/utils.ts), initializes `markdown-it` with `buildHighlightCallback`, and registers plugins in strict order: `markdownItCheckbox`, `markdownItEmojiFull`, `markdownItNamedHeaders`, the installed `tbruneel.markdown-alerts` plugin (resolved dynamically via `vscode.extensions.getExtension('tbruneel.markdown-alerts')` with a `createRequire` fallback before preview activation completes), and the KaTeX suite (`@vscode/markdown-it-katex`, [`mathBracketsPlugin`](../source/markdown-it-math-brackets.ts) registered before `'escape'` and `'fence'` so `\(...\)` and `\[...\]` survive escape processing, and [`mathFencePlugin`](../source/markdown-it-math-fence.ts) wired through [`renderMath`](../source/math-renderer.ts)). When `tbruneel.markdown-alerts` is not installed, `> [!NOTE]` blocks remain standard blockquotes rather than duplicating parser logic.

Asset inlining, link rewriting, theme mirroring, and styling occur synchronously so exported `.htmd` files remain portable offline:

- **Images and Links**: `md.renderer.rules.image` calls [`inlineImageHref`](../source/utils.ts) to convert relative local images (`png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, `bmp`, `ico`) into Base64 `data:` URIs. `md.renderer.rules.link_open` calls [`rewriteMarkdownLinkHref`](../source/utils.ts) and [`installSanitizeRules`](../source/markdown-it-sanitize.ts) applies [`rewriteHtmlAnchorHrefs`](../source/utils.ts) to raw `<a>` elements so relative `.md` and `.markdown` links rewrite to `.htmd` while preserving query strings and `#fragments`.
- **Active VS Code Theme Mirroring**: [`resolveActiveVscodeThemeContext`](../source/vscode-theme.ts) inspects `vscode.window.activeColorTheme.kind` (`vscode-light`, `vscode-dark`, `vscode-high-contrast`, or `vscode-high-contrast vscode-high-contrast-light`), resolves the active theme name (`autoDetectHighContrast` / `autoDetectColorScheme` / `workbench.colorTheme`), walks its `include` chain and `package.nls.json` labels across installed extensions, merges `ColorRegistry` polarity defaults with theme colors and `workbench.colorCustomizations` (both global and `[Theme Name]` sections), and reads `editor.fontFamily`, `markdown.preview.*`, and `accessibility.underlineLinks`. All `--vscode-*` and `--markdown-*` custom properties are emitted strictly on `:root` inside `<style id="vscode-theme-variables">`, so browsers display the active VS Code theme while `Markdown HTMD Exports Viewer` inside VS Code continues to let `<html>` inline variables drive live theme switching.
- **Ordered CSS & Script Cascade**: [`buildStyleTags`](../source/utils.ts) emits stylesheets in the same order as VS Code's built-in preview: (1) `:root` theme variables, (2) [`styles/vscode-markdown.css`](../styles/vscode-markdown.css) (`@layer vscode-default` + `markdown-language-features` base rules when `includeDefaultStyles` is true), (3) [`styles/vscode-highlight.css`](../styles/vscode-highlight.css) or explicit `markdown-htmd-exports.highlightStyle`, (4) companion `markdown.previewStyles` contributed by `tbruneel.markdown-alerts` and `tbruneel.markdown-stylesheets`, (5) `markdown.styles`, (6) `markdown-htmd-exports.styles`, and (7) KaTeX CSS from [`assets/katex/`](../assets/katex/katex.min.css) with Base64 WOFF2/WOFF/TTF fonts only when `class="katex` appears. [`makeHtml`](../source/extension.ts) similarly inlines `markdown.previewScripts` contributed by `tbruneel.markdown-stylesheets` (`source/copy-code-button.js`) into `{{{scripts}}}` alongside the conditional Mermaid loader and relative `.md` `data-source` attribute.

## 3. Built-In `.htmd` Viewer & Windows Association

[`MarkdownHtmdExportsViewerProvider`](../source/html-viewer.ts) implements `vscode.CustomReadonlyEditorProvider` for `viewType = 'markdown-htmd-exports.viewer'` on `*.htmd` (`priority: "default"`). It maintains normalized path mappings in `activePanels`, reloads open webviews via both `refreshFile` and `vscode.workspace.createFileSystemWatcher`, and injects `ANCHOR_NAV_SCRIPT` before `</body>`. The click listener registers in the capture phase (`true`) and calls `e.stopPropagation()` so smooth `#id` scrolling and relative local-link navigation work cleanly inside VS Code's webview host. Clicking a rewritten `.htmd` link forwards `openRelativeLink` via `webview.onDidReceiveMessage`, opening the target `.htmd` file via `vscode.open` when it exists on disk. [`resolveSourceMdFilename`](../source/utils.ts) reads `<meta name="generator" content="vscode-markdown-htmd-exports" data-source="...">` before falling back to sibling `.md` resolution when `extension.markdown-htmd-exports.showSource` runs.

On first activation on Windows (`process.platform === 'win32'`, tracked via `globalState` key `'htmdAssociationInitialized'`), [`ensureWindowsHtmdAssociation`](../source/windows-association.ts) configures per-user `.htmd` shell handling via `reg.exe` without requiring Administrator elevation. It reads the active `.html` handler from `HKCU\...\Explorer\FileExts\.html\UserChoice` (falling back to installed Chrome or Edge executables), maps `HKCU\Software\Classes\.htmd` to `MarkdownHTML.htmd` with `Content Type = text/html` so Chromium renders `.htmd` files inline instead of downloading them, clears conflicting `OpenWithList` entries if no explicit `.htmd` `UserChoice` exists, and flushes Explorer caches via `ie4uinit.exe -show` and Win32 `SHChangeNotify`. The standalone `powershell-markdown-html` utility shares this exact registry schema for external diagnostics and re-syncing.

## 4. Commands, Settings & Frontmatter Reference

| Contribution ID | Kind | Where Exposed | Behavior |
| :--- | :--- | :--- | :--- |
| `extension.markdown-htmd-exports.export` | Command | Editor toolbar, Explorer/editor context menu, Command Palette | Exports the target `.md` file immediately using active settings. |
| `extension.markdown-htmd-exports.showSource` | Command | Viewer toolbar, Command Palette | Opens the source `.md` file resolved from metadata or sibling path. |
| `markdown-htmd-exports.viewer` | Custom Editor | `*.htmd` default editor | Renders exported HTML read-only inside VS Code with live reload. |

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `markdown-htmd-exports.convertOnSave` | `string` | `"ifExists"` | Auto-export policy on save: `"ifExists"`, `"always"`, or `"never"`. |
| `markdown-htmd-exports.convertOnSaveExclude` | `string[]` | `[]` | Regex patterns matched against filenames excluded from save export. |
| `markdown-htmd-exports.styles` | `string[]` | `[]` | Local paths or URLs to extra CSS stylesheets inlined during export. |
| `markdown-htmd-exports.stylesRelativePathFile` | `boolean` | `false` | Resolve relative `markdown-htmd-exports.styles` entries from the `.md` folder. |
| `markdown-htmd-exports.includeDefaultStyles` | `boolean` | `true` | Include [`styles/vscode-markdown.css`](../styles/vscode-markdown.css) alongside the active theme variables, companion preview styles, and `markdown.styles`. |
| `markdown-htmd-exports.outputDirectory` | `string` | `""` | Destination folder for `.htmd` outputs (empty keeps sibling `.htmd`). |
| `markdown-htmd-exports.outputDirectoryRelativePathFile` | `boolean` | `false` | Resolve relative `outputDirectory` paths from the `.md` folder. |
| `markdown-htmd-exports.sanitize` | `string` | `"gfm"` | Raw HTML sanitization mode: `"gfm"`, `"gfm-allow-style"`, or `"none"`. |
| `markdown-htmd-exports.highlight` | `boolean` | `true` | Enable `highlight.js` syntax highlighting on fenced code blocks. |
| `markdown-htmd-exports.highlightStyle` | `string` | `""` | Optional `highlight.js` CSS filename (falls back to [`styles/vscode-highlight.css`](../styles/vscode-highlight.css)). |
| `markdown-htmd-exports.breaks` | `boolean` | `false` | Convert single newlines in paragraphs into `<br>` tags. |
| `markdown-htmd-exports.emoji` | `boolean` | `true` | Enable `:shortcode:` Unicode emoji expansion. |
| `markdown-htmd-exports.mermaidServer` | `string` | `"https://unpkg.com/mermaid/dist/mermaid.min.js"` | Mermaid runtime URL emitted only when ```` ```mermaid ```` blocks appear. |
| `markdown-htmd-exports.math.enabled` | `boolean` | `true` | Enable KaTeX math rendering across delimiters and ```` ```math ```` fences. |
| `markdown-htmd-exports.math.katex.macros` | `object` | `{}` | String map of custom KaTeX macros forwarded to `renderMath`. |
| `markdown-htmd-exports.StatusbarMessageTimeout` | `number` | `5000` | Status bar confirmation timeout in milliseconds after export. |

| Frontmatter Key | Type | Overrides | Behavior |
| :--- | :--- | :--- | :--- |
| `breaks` | `boolean` | `markdown-htmd-exports.breaks` | Controls `<br>` conversion per document when defined as boolean. |
| `emoji` | `boolean` | `markdown-htmd-exports.emoji` | Enables or disables `:emoji:` shortcodes per document. |
| `math.enabled` | `boolean` | `markdown-htmd-exports.math.enabled` | Toggles KaTeX rendering for the document. |
| `math.katex.macros` | `Record<string, string>` | Merged over `markdown-htmd-exports.math.katex.macros` | Per-document KaTeX macro overrides merged on top of workspace settings. |

## 5. HTML Sanitization & Safety Boundaries

[`installSanitizeRules`](../source/markdown-it-sanitize.ts) intercepts `html_block` and `html_inline` tokens and passes raw markup to [`sanitizeRawHtml`](../source/utils.ts#L772). Under `"gfm"`, disallowed elements are `title`, `textarea`, `style`, `xmp`, `iframe`, `noembed`, `noframes`, `script`, and `plaintext`; in block context `style`, `script`, and `iframe` are stripped together with their inner contents, whereas inline tags are HTML-escaped. Switching to `"gfm-allow-style"` retains `<style>` blocks, and `"none"` bypasses filtering completely. For permitted elements, `stripDangerousAttributes` strips `on*` event attributes and `javascript:` values in `href` or `src`, logging counts in `SanitizeReport` and prompting the user on manual exports when content is modified.

## 6. Build, Debug & Packaging

```powershell
# Type-check, bundle build/extension.js, and output package\vscode-extension-markdown-htmd-exports-v<version>.vsix
.\build.ps1

# Package and immediately install into Microsoft VS Code
.\build.ps1 -Install

# Equivalent npm wrapper or manual inspection commands
npm run package
npx @vscode/vsce ls
```

[`build.ps1`](../build.ps1) writes the archive to `package\`, synthesizes a temporary `package/marketplace-readme.md` passed via `--readme-path package/marketplace-readme.md --githubBranch main` (rewriting companion GitHub URLs to VS Code Marketplace links while leaving [`readme.md`](../readme.md) untouched on GitHub), and intentionally omits `--no-dependencies` because [`.vscodeignore`](../.vscodeignore) blocks `node_modules/**` while whitelisting `!node_modules/highlight.js/styles/**` so optional `highlightStyle` themes remain available at runtime alongside `assets/icon.png`, `assets/katex/`, `build/extension.js`, `styles/`, `source/template.html`, `package.json`, `license.md`, and the transformed `readme.md` (excluding `source/*.ts`, `source/types/**`, `build.ps1`, `package/**`, `readme.md`, `**/*.vsix`, `docs/**`, `.agents/**`, and `**/*.htmd`).
