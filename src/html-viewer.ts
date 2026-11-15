import * as vscode from 'vscode';
import fs from 'fs';
import path from 'path';
import * as utils from './utils';

const ANCHOR_NAV_SCRIPT = `
<script>
(function () {
  var vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  document.addEventListener('click', function (e) {
    var target = e.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    if (!target) return;
    var href = target.getAttribute('href');
    if (!href) return;
    if (href.charAt(0) === '#' && href.length > 1) {
      var id = decodeURIComponent(href.slice(1));
      var el = document.getElementById(id) || document.getElementsByName(id)[0];
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    if (href.indexOf('//') === 0) return;
    var schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(href);
    var isWindowsDrive = /^[a-z]:[\\\\/]/i.test(href);
    if (schemeMatch && !isWindowsDrive && schemeMatch[1].toLowerCase() !== 'file') {
      return;
    }
    if (vscodeApi) {
      e.preventDefault();
      e.stopPropagation();
      vscodeApi.postMessage({ type: 'openRelativeLink', href: href });
    }
  }, true);
})();
</script>
`;

export class MarkdownHtmlViewerProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'markdown-html.viewer';
  private static readonly activePanels = new Map<string, Set<vscode.WebviewPanel>>();
  private static activeFilePath: string | undefined;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MarkdownHtmlViewerProvider();
    return vscode.window.registerCustomEditorProvider(
      MarkdownHtmlViewerProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      },
    );
  }

  public static getActiveFilePath(): string | undefined {
    return MarkdownHtmlViewerProvider.activeFilePath;
  }

  public static refreshFile(filePath: string): void {
    const key = path.normalize(filePath).toLowerCase();
    const panels = MarkdownHtmlViewerProvider.activePanels.get(key);
    if (!panels || panels.size === 0) {
      return;
    }
    const html = MarkdownHtmlViewerProvider.loadHtml(filePath);
    for (const panel of panels) {
      panel.webview.html = html;
    }
  }

  private static loadHtml(filePath: string): string {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.includes('</body>')) {
        return raw.replace('</body>', ANCHOR_NAV_SCRIPT + '\n</body>');
      }
      return raw + ANCHOR_NAV_SCRIPT;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `<!DOCTYPE html><html><body><p>Failed to load ${path.basename(filePath)}: ${msg}</p></body></html>`;
    }
  }

  public openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): vscode.CustomDocument {
    return {
      uri,
      dispose: () => {},
    };
  }

  public resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): void {
    const filePath = document.uri.fsPath;
    const key = path.normalize(filePath).toLowerCase();

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.dirname(filePath))],
    };

    let set = MarkdownHtmlViewerProvider.activePanels.get(key);
    if (!set) {
      set = new Set();
      MarkdownHtmlViewerProvider.activePanels.set(key, set);
    }
    set.add(webviewPanel);
    if (webviewPanel.active) {
      MarkdownHtmlViewerProvider.activeFilePath = filePath;
    }

    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        MarkdownHtmlViewerProvider.activeFilePath = filePath;
      } else if (MarkdownHtmlViewerProvider.activeFilePath === filePath) {
        MarkdownHtmlViewerProvider.activeFilePath = undefined;
      }
    });

    webviewPanel.webview.html = MarkdownHtmlViewerProvider.loadHtml(filePath);

    const messageDisposable = webviewPanel.webview.onDidReceiveMessage(async (msg: unknown) => {
      if (!msg || typeof msg !== 'object') {
        return;
      }
      const record = msg as { type?: unknown; href?: unknown };
      if (record.type !== 'openRelativeLink' || typeof record.href !== 'string') {
        return;
      }
      const rawPath = record.href.split('#')[0].split('?')[0].trim();
      if (!rawPath) {
        return;
      }
      let decoded = rawPath;
      try {
        decoded = decodeURIComponent(rawPath);
      } catch {
        // Keep rawPath when URI decoding fails.
      }
      let candidate = utils.stripFileProtocol(decoded);
      if (!path.isAbsolute(candidate) && !path.win32.isAbsolute(candidate)) {
        candidate = path.resolve(path.dirname(filePath), candidate);
      }
      if (fs.existsSync(candidate)) {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(candidate));
      }
    });

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath)),
    );
    const reload = () => {
      webviewPanel.webview.html = MarkdownHtmlViewerProvider.loadHtml(filePath);
    };
    watcher.onDidChange(reload);
    watcher.onDidCreate(reload);

    webviewPanel.onDidDispose(() => {
      messageDisposable.dispose();
      watcher.dispose();
      if (MarkdownHtmlViewerProvider.activeFilePath === filePath) {
        MarkdownHtmlViewerProvider.activeFilePath = undefined;
      }
      const panels = MarkdownHtmlViewerProvider.activePanels.get(key);
      if (panels) {
        panels.delete(webviewPanel);
        if (panels.size === 0) {
          MarkdownHtmlViewerProvider.activePanels.delete(key);
        }
      }
    });
  }
}

