import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type VscodeThemePolarity = 'light' | 'dark' | 'hcDark' | 'hcLight';

export interface ActiveVscodeThemeContext {
  bodyClass: string;
  rootVarsStyleTag: string;
}

interface ContributedThemeEntry {
  id?: string;
  label?: string;
  uiTheme?: string;
  path: string;
  extensionPath: string;
}

const DEFAULT_MARKDOWN_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, "Ubuntu", "Droid Sans", sans-serif';
const DEFAULT_MONOSPACE_FONT_FAMILY =
  '"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace';
const DEFAULT_UI_FONT_FAMILY = '"Segoe WPC", "Segoe UI", sans-serif';

/**
 * VS Code ColorRegistry defaults extracted by polarity for all CSS tokens used by
 * vscode-markdown.css, vscode-highlight.css, markdown-preview-layout.css, and markdown-alert.
 */
const POLARITY_COLOR_DEFAULTS: Record<VscodeThemePolarity, Record<string, string>> = {
  light: {
    'editor.background': '#ffffff',
    'editor.foreground': '#333333',
    'textLink.foreground': '#006ab1',
    'textLink.activeForeground': '#006ab1',
    'textPreformat.foreground': '#a31515',
    'textPreformat.background': '#0000001a',
    'textBlockQuote.background': '#f2f2f2',
    'textBlockQuote.border': '#007acc80',
    'textCodeBlock.background': '#dcdcdc66',
    'widget.border': 'transparent',
    'widget.shadow': '#00000029',
    'toolbar.hoverBackground': '#b8b8b850',
    'toolbar.activeBackground': '#a6a6a650',
    'scrollbarSlider.background': '#64646466',
    'scrollbarSlider.hoverBackground': '#646464b3',
    'scrollbarSlider.activeBackground': '#00000099',
    'testing.iconPassed': '#73c991',
    'editorHoverWidget.background': '#f3f3f3',
    'editorHoverWidget.foreground': '#333333',
    'editorHoverWidget.border': '#c8c8c8',
    'editorError.foreground': '#e51400',
    'diffEditor.insertedTextBackground': '#9bb95533',
    'diffEditor.removedTextBackground': '#ff000033',
    'keybindingLabel.background': '#dddddd66',
    'keybindingLabel.foreground': '#555555',
    'keybindingLabel.border': '#cccccc66',
    'keybindingLabel.bottomBorder': '#bbbbbb66',
  },
  dark: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#bbbbbb',
    'textLink.foreground': '#3794ff',
    'textLink.activeForeground': '#3794ff',
    'textPreformat.foreground': '#d7ba7d',
    'textPreformat.background': '#ffffff1a',
    'textBlockQuote.background': '#222222',
    'textBlockQuote.border': '#007acc80',
    'textCodeBlock.background': '#0a0a0a66',
    'widget.border': 'transparent',
    'widget.shadow': '#0000005c',
    'toolbar.hoverBackground': '#5a5d5e50',
    'toolbar.activeBackground': '#63666750',
    'scrollbarSlider.background': '#79797966',
    'scrollbarSlider.hoverBackground': '#646464b3',
    'scrollbarSlider.activeBackground': '#bfbfbf66',
    'testing.iconPassed': '#73c991',
    'editorHoverWidget.background': '#252526',
    'editorHoverWidget.foreground': '#cccccc',
    'editorHoverWidget.border': '#454545',
    'editorError.foreground': '#f14c4c',
    'diffEditor.insertedTextBackground': '#9bb95533',
    'diffEditor.removedTextBackground': '#ff000033',
    'keybindingLabel.background': '#8080802b',
    'keybindingLabel.foreground': '#cccccc',
    'keybindingLabel.border': '#33333399',
    'keybindingLabel.bottomBorder': '#44444499',
  },
  hcDark: {
    'editor.background': '#000000',
    'editor.foreground': '#ffffff',
    'textLink.foreground': '#21a6ff',
    'textLink.activeForeground': '#21a6ff',
    'textPreformat.foreground': '#ffffff',
    'textPreformat.background': 'transparent',
    'textBlockQuote.background': 'transparent',
    'textBlockQuote.border': '#ffffff',
    'textCodeBlock.background': '#000000',
    'widget.border': '#6fc3df',
    'widget.shadow': 'transparent',
    'toolbar.hoverBackground': 'transparent',
    'toolbar.activeBackground': 'transparent',
    'scrollbarSlider.background': '#6fc3df99',
    'scrollbarSlider.hoverBackground': '#6fc3dfcc',
    'scrollbarSlider.activeBackground': '#6fc3df',
    'testing.iconPassed': '#73c991',
    'editorHoverWidget.background': '#0c141f',
    'editorHoverWidget.foreground': '#ffffff',
    'editorHoverWidget.border': '#6fc3df',
    'editorError.foreground': '#f48771',
    'diffEditor.insertedTextBackground': 'transparent',
    'diffEditor.removedTextBackground': 'transparent',
    'keybindingLabel.background': 'transparent',
    'keybindingLabel.foreground': '#ffffff',
    'keybindingLabel.border': '#6fc3df',
    'keybindingLabel.bottomBorder': '#6fc3df',
  },
  hcLight: {
    'editor.background': '#ffffff',
    'editor.foreground': '#292929',
    'textLink.foreground': '#0f4a85',
    'textLink.activeForeground': '#0f4a85',
    'textPreformat.foreground': '#ffffff',
    'textPreformat.background': '#09345f',
    'textBlockQuote.background': '#f2f2f2',
    'textBlockQuote.border': '#292929',
    'textCodeBlock.background': '#f2f2f2',
    'widget.border': '#0f4a85',
    'widget.shadow': 'transparent',
    'toolbar.hoverBackground': 'transparent',
    'toolbar.activeBackground': 'transparent',
    'scrollbarSlider.background': '#6fc3df66',
    'scrollbarSlider.hoverBackground': '#6fc3df99',
    'scrollbarSlider.activeBackground': '#0f4a85',
    'testing.iconPassed': '#007100',
    'editorHoverWidget.background': '#ffffff',
    'editorHoverWidget.foreground': '#292929',
    'editorHoverWidget.border': '#0f4a85',
    'editorError.foreground': '#b5200d',
    'diffEditor.insertedTextBackground': 'transparent',
    'diffEditor.removedTextBackground': 'transparent',
    'keybindingLabel.background': 'transparent',
    'keybindingLabel.foreground': '#292929',
    'keybindingLabel.border': '#0f4a85',
    'keybindingLabel.bottomBorder': '#0f4a85',
  },
};

function getThemePolarity(): { polarity: VscodeThemePolarity; bodyClass: string } {
  const kind = vscode.window.activeColorTheme?.kind;
  switch (kind) {
    case vscode.ColorThemeKind.Light:
      return { polarity: 'light', bodyClass: 'vscode-light' };
    case vscode.ColorThemeKind.HighContrast:
      return { polarity: 'hcDark', bodyClass: 'vscode-high-contrast' };
    case vscode.ColorThemeKind.HighContrastLight:
      return { polarity: 'hcLight', bodyClass: 'vscode-high-contrast vscode-high-contrast-light' };
    case vscode.ColorThemeKind.Dark:
    default:
      return { polarity: 'dark', bodyClass: 'vscode-dark' };
  }
}

/**
 * Strips // and /* * / comments plus trailing commas from VS Code JSONC files
 * while preserving string literals verbatim.
 */
function parseJsonc(raw: string): unknown {
  let noComments = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = i + 1 < raw.length ? raw[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n' || ch === '\r') {
        inLineComment = false;
        noComments += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      } else if (ch === '\n' || ch === '\r') {
        noComments += ch;
      }
      continue;
    }

    if (inString) {
      noComments += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      noComments += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    noComments += ch;
  }

  let clean = '';
  inString = false;
  escaped = false;
  for (let i = 0; i < noComments.length; i++) {
    const ch = noComments[i];
    if (inString) {
      clean += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      clean += ch;
      continue;
    }

    if (ch === ',') {
      let lookahead = i + 1;
      while (lookahead < noComments.length && /\s/.test(noComments[lookahead])) {
        lookahead++;
      }
      if (
        lookahead < noComments.length &&
        (noComments[lookahead] === '}' || noComments[lookahead] === ']')
      ) {
        continue;
      }
    }

    clean += ch;
  }

  return JSON.parse(clean);
}

function readJsoncFile(filePath: string): Record<string, unknown> | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const parsed = parseJsonc(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed theme or localization files.
  }
  return undefined;
}

function localizeString(value: unknown, nlsMap: Record<string, unknown> | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }
  const match = value.match(/^%(.+)%$/);
  if (match && nlsMap) {
    const localized = nlsMap[match[1]];
    if (typeof localized === 'string') {
      return localized;
    }
  }
  return value;
}

function normalizeThemeKey(value: string): string {
  return value.trim().toLowerCase();
}

function getThemeNameVariants(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) {
    return [];
  }
  const variants = new Set<string>([trimmed]);
  if (trimmed.toLowerCase().startsWith('default ')) {
    variants.add(trimmed.slice('default '.length).trim());
  } else {
    variants.add(`Default ${trimmed}`);
  }
  return Array.from(variants);
}

function resolveConfiguredThemeName(
  polarity: VscodeThemePolarity,
  resource?: vscode.Uri,
): string {
  const workbenchCfg = vscode.workspace.getConfiguration('workbench', resource);
  const windowCfg = vscode.workspace.getConfiguration('window', resource);
  const autoDetectHighContrast = windowCfg.get<boolean>('autoDetectHighContrast', true);
  const autoDetectColorScheme = windowCfg.get<boolean>('autoDetectColorScheme', false);

  let preferred: string | undefined;
  if (polarity === 'hcDark' && autoDetectHighContrast) {
    preferred = workbenchCfg.get<string>('preferredHighContrastColorTheme');
  } else if (polarity === 'hcLight' && autoDetectHighContrast) {
    preferred = workbenchCfg.get<string>('preferredHighContrastLightColorTheme');
  } else if (polarity === 'dark' && autoDetectColorScheme) {
    preferred = workbenchCfg.get<string>('preferredDarkColorTheme');
  } else if (polarity === 'light' && autoDetectColorScheme) {
    preferred = workbenchCfg.get<string>('preferredLightColorTheme');
  }

  if (preferred && preferred.trim()) {
    return preferred.trim();
  }

  const configured = workbenchCfg.get<string>('colorTheme');
  if (configured && configured.trim()) {
    return configured.trim();
  }

  switch (polarity) {
    case 'light':
      return 'Default Light Modern';
    case 'hcDark':
      return 'Default High Contrast';
    case 'hcLight':
      return 'Default High Contrast Light';
    case 'dark':
    default:
      return 'Default Dark Modern';
  }
}

function collectExtensionDirs(): Array<{ extensionPath: string; packageJSON?: Record<string, unknown> }> {
  const seen = new Set<string>();
  const results: Array<{ extensionPath: string; packageJSON?: Record<string, unknown> }> = [];

  for (const ext of vscode.extensions?.all || []) {
    if (!ext?.extensionPath) {
      continue;
    }
    const resolved = path.resolve(ext.extensionPath);
    const key = resolved.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        extensionPath: resolved,
        packageJSON: ext.packageJSON as Record<string, unknown> | undefined,
      });
    }
  }

  // Fallback scan of built-in app extensions in case vscode.appRoot wasn't included
  const candidateAppRoots = new Set<string>();
  if (typeof vscode.env?.appRoot === 'string' && vscode.env.appRoot) {
    candidateAppRoots.add(path.join(vscode.env.appRoot, 'extensions'));
  }

  for (const extRoot of candidateAppRoots) {
    if (!fs.existsSync(extRoot)) {
      continue;
    }
    try {
      for (const entry of fs.readdirSync(extRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }
        const resolved = path.resolve(path.join(extRoot, entry.name));
        const key = resolved.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ extensionPath: resolved });
        }
      }
    } catch {
      // Ignore unreadable extension roots.
    }
  }

  return results;
}

function findThemeEntry(themeName: string): ContributedThemeEntry | undefined {
  const wantedVariants = new Set(getThemeNameVariants(themeName).map(normalizeThemeKey));
  if (wantedVariants.size === 0) {
    return undefined;
  }

  let fallbackMatch: ContributedThemeEntry | undefined;

  for (const ext of collectExtensionDirs()) {
    const pkg =
      ext.packageJSON || readJsoncFile(path.join(ext.extensionPath, 'package.json'));
    const contributes = pkg?.contributes as Record<string, unknown> | undefined;
    const themes = contributes?.themes;
    if (!Array.isArray(themes) || themes.length === 0) {
      continue;
    }

    const nlsMap = readJsoncFile(path.join(ext.extensionPath, 'package.nls.json'));

    for (const rawTheme of themes) {
      if (!rawTheme || typeof rawTheme !== 'object') {
        continue;
      }
      const themeObj = rawTheme as Record<string, unknown>;
      const relPath = typeof themeObj.path === 'string' ? themeObj.path : '';
      if (!relPath) {
        continue;
      }

      const rawId = typeof themeObj.id === 'string' ? themeObj.id : '';
      const localizedLabel = localizeString(themeObj.label, nlsMap);
      const idNorm = normalizeThemeKey(rawId);
      const labelNorm = normalizeThemeKey(localizedLabel);

      const entry: ContributedThemeEntry = {
        id: rawId || localizedLabel,
        label: localizedLabel || rawId,
        uiTheme: typeof themeObj.uiTheme === 'string' ? themeObj.uiTheme : undefined,
        path: relPath,
        extensionPath: ext.extensionPath,
      };

      if (
        (idNorm && idNorm === normalizeThemeKey(themeName)) ||
        (labelNorm && labelNorm === normalizeThemeKey(themeName))
      ) {
        return entry;
      }

      if (!fallbackMatch && ((idNorm && wantedVariants.has(idNorm)) || (labelNorm && wantedVariants.has(labelNorm)))) {
        fallbackMatch = entry;
      }
    }
  }

  return fallbackMatch;
}

function loadThemeColorsRecursive(
  themeFilePath: string,
  targetColors: Record<string, string>,
  visited: Set<string>,
  depth = 0,
): void {
  if (depth > 16) {
    return;
  }
  const resolved = path.resolve(themeFilePath);
  const key = resolved.toLowerCase();
  if (visited.has(key)) {
    return;
  }
  visited.add(key);

  const json = readJsoncFile(resolved);
  if (!json) {
    return;
  }

  if (typeof json.include === 'string' && json.include.trim()) {
    const includePath = path.resolve(path.dirname(resolved), json.include.trim());
    loadThemeColorsRecursive(includePath, targetColors, visited, depth + 1);
  }

  const colors = json.colors;
  if (colors && typeof colors === 'object' && !Array.isArray(colors)) {
    for (const [colorKey, colorVal] of Object.entries(colors as Record<string, unknown>)) {
      if (typeof colorVal === 'string') {
        targetColors[colorKey] = colorVal;
      } else if (colorVal === null) {
        targetColors[colorKey] = 'transparent';
      }
    }
  }
}

function sectionMatchesTheme(sectionKey: string, candidateNames: Set<string>): boolean {
  const segmentRegex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = segmentRegex.exec(sectionKey)) !== null) {
    const segmentNorm = normalizeThemeKey(match[1]);
    if (candidateNames.has(segmentNorm)) {
      return true;
    }
  }
  return false;
}

function applyColorCustomizations(
  targetColors: Record<string, string>,
  colorCustomizations: Record<string, unknown> | undefined,
  themeName: string,
  matchedEntry: ContributedThemeEntry | undefined,
): void {
  if (!colorCustomizations || typeof colorCustomizations !== 'object') {
    return;
  }

  const candidateNames = new Set<string>(getThemeNameVariants(themeName).map(normalizeThemeKey));
  if (matchedEntry?.id) {
    for (const v of getThemeNameVariants(matchedEntry.id)) {
      candidateNames.add(normalizeThemeKey(v));
    }
  }
  if (matchedEntry?.label) {
    for (const v of getThemeNameVariants(matchedEntry.label)) {
      candidateNames.add(normalizeThemeKey(v));
    }
  }

  // Global overrides first
  for (const [key, val] of Object.entries(colorCustomizations)) {
    if (key.startsWith('[')) {
      continue;
    }
    if (typeof val === 'string') {
      targetColors[key] = val;
    } else if (val === null) {
      targetColors[key] = 'transparent';
    }
  }

  // Theme-scoped [Theme Name] overrides take precedence
  for (const [key, val] of Object.entries(colorCustomizations)) {
    if (!key.startsWith('[') || !val || typeof val !== 'object' || Array.isArray(val)) {
      continue;
    }
    if (!sectionMatchesTheme(key, candidateNames)) {
      continue;
    }
    for (const [colorKey, colorVal] of Object.entries(val as Record<string, unknown>)) {
      if (typeof colorVal === 'string') {
        targetColors[colorKey] = colorVal;
      } else if (colorVal === null) {
        targetColors[colorKey] = 'transparent';
      }
    }
  }
}

function sanitizeCssValue(value: string): string {
  return value.replace(/[;\r\n<>]/g, '').trim();
}

function collectCssVariables(
  polarity: VscodeThemePolarity,
  resolvedColors: Record<string, string>,
  resource?: vscode.Uri,
): Array<[string, string]> {
  const vars = new Map<string, string>();
  const allowedColorKeys = new Set(Object.keys(POLARITY_COLOR_DEFAULTS[polarity]));

  for (const key of allowedColorKeys) {
    const raw = resolvedColors[key];
    if (raw !== undefined) {
      const sanitized = sanitizeCssValue(raw);
      if (sanitized) {
        vars.set(`--vscode-${key.replace(/\./g, '-')}`, sanitized);
      }
    }
  }

  const editorCfg = vscode.workspace.getConfiguration('editor', resource);
  const mdPreviewCfg = vscode.workspace.getConfiguration('markdown.preview', resource);
  const accessibilityCfg = vscode.workspace.getConfiguration('accessibility', resource);

  const editorFontFamily = sanitizeCssValue(
    editorCfg.get<string>('fontFamily') || DEFAULT_MONOSPACE_FONT_FAMILY,
  );
  const mdFontFamily = sanitizeCssValue(
    mdPreviewCfg.get<string>('fontFamily') || DEFAULT_MARKDOWN_FONT_FAMILY,
  );
  const mdFontSizeNum = mdPreviewCfg.get<number>('fontSize');
  const mdFontSize =
    typeof mdFontSizeNum === 'number' && Number.isFinite(mdFontSizeNum) && mdFontSizeNum > 0
      ? `${mdFontSizeNum}px`
      : '14px';
  const mdLineHeightNum = mdPreviewCfg.get<number>('lineHeight');
  const mdLineHeight =
    typeof mdLineHeightNum === 'number' && Number.isFinite(mdLineHeightNum) && mdLineHeightNum > 0
      ? `${mdLineHeightNum}`
      : '1.6';
  const underlineLinks = accessibilityCfg.get<boolean>('underlineLinks', false);

  vars.set('--vscode-font-family', DEFAULT_UI_FONT_FAMILY);
  vars.set('--vscode-font-weight', 'normal');
  vars.set('--vscode-font-size', '13px');
  vars.set('--vscode-editor-font-family', editorFontFamily);
  vars.set('--monaco-monospace-font', editorFontFamily);
  vars.set('--markdown-font-family', mdFontFamily);
  vars.set('--markdown-font-size', mdFontSize);
  vars.set('--markdown-line-height', mdLineHeight);
  vars.set('--text-link-decoration', underlineLinks ? 'underline' : 'none');

  return Array.from(vars.entries());
}

/**
 * Resolves VS Code's active color theme, workbench.colorCustomizations, and
 * markdown.preview typography onto `:root` (never `body`), so exported `.htmd`
 * files preserve VS Code's theme in browsers while `Markdown HTMD Exports Viewer` inside
 * VS Code still lets `<html>` inline `--vscode-*` variables win for live switching.
 */
export function resolveActiveVscodeThemeContext(resource?: vscode.Uri): ActiveVscodeThemeContext {
  const { polarity, bodyClass } = getThemePolarity();
  const colors: Record<string, string> = { ...POLARITY_COLOR_DEFAULTS[polarity] };

  const activeThemeName = resolveConfiguredThemeName(polarity, resource);
  const matchedEntry = findThemeEntry(activeThemeName);
  if (matchedEntry) {
    const themeFilePath = path.resolve(matchedEntry.extensionPath, matchedEntry.path);
    loadThemeColorsRecursive(themeFilePath, colors, new Set<string>());
  }

  const workbenchCfg = vscode.workspace.getConfiguration('workbench', resource);
  const colorCustomizations = workbenchCfg.get<Record<string, unknown>>('colorCustomizations');
  applyColorCustomizations(colors, colorCustomizations, activeThemeName, matchedEntry);

  const cssVars = collectCssVariables(polarity, colors, resource);
  const declarations = cssVars.map(([name, val]) => `  ${name}: ${val};`).join('\n');
  const rootVarsStyleTag = `<style id="vscode-theme-variables">\n:root {\n${declarations}\n}\n</style>`;

  return {
    bodyClass,
    rootVarsStyleTag,
  };
}
