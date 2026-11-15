import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const EXT_KEY = 'HKCU\\Software\\Classes\\.htmd';
const PROG_ID = 'MarkdownHTML.htmd';
const PROG_ID_KEY = 'HKCU\\Software\\Classes\\MarkdownHTML.htmd';
const FRIENDLY_NAME = 'Markdown HTML Document';
const HTML_USER_CHOICE_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.html\\UserChoice';
const FILE_EXTS_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.htmd';
const TOASTS_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ApplicationAssociationToasts';

function execReg(args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    execFile('reg.exe', args, { windowsHide: true }, (error, stdout) => {
      if (error) {
        const exitCode = typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
          ? ((error as unknown) as { code: number }).code
          : 1;
        resolve({ code: exitCode, stdout: stdout || '' });
        return;
      }
      resolve({ code: 0, stdout: stdout || '' });
    });
  });
}

async function queryRegSz(key: string, valueName?: string): Promise<string | undefined> {
  const args = valueName ? ['query', key, '/v', valueName] : ['query', key, '/ve'];
  const result = await execReg(args);
  if (result.code !== 0) {
    return undefined;
  }
  const match = /\s+REG_(?:EXPAND_)?SZ\s+(.+?)\r?$/m.exec(result.stdout);
  if (!match) {
    return undefined;
  }
  const val = match[1].trim();
  if (!val || val === '(value not set)') {
    return undefined;
  }
  return val;
}

async function resolveDefaultHtmlBrowser(): Promise<{ icon: string; command: string }> {
  const progId = await queryRegSz(HTML_USER_CHOICE_KEY, 'ProgId');
  if (progId) {
    const [icon, command] = await Promise.all([
      queryRegSz(`HKCR\\${progId}\\DefaultIcon`),
      queryRegSz(`HKCR\\${progId}\\shell\\open\\command`),
    ]);
    if (command) {
      return { icon: icon || '', command };
    }
  }

  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const chromePath = path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe');
  if (fs.existsSync(chromePath)) {
    return {
      icon: `${chromePath},10`,
      command: `"${chromePath}" --single-argument %1`,
    };
  }

  const edgePath = path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe');
  if (fs.existsSync(edgePath)) {
    return {
      icon: `${edgePath},13`,
      command: `"${edgePath}" --single-argument %1`,
    };
  }

  return {
    icon: '',
    command: 'cmd.exe /c start "" "%1"',
  };
}

function notifyShellAssociationChanged(): Promise<void> {
  const psCommand =
    'Add-Type -Namespace Win32 -Name Shell -MemberDefinition ' +
    '\'[DllImport("shell32.dll")] public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);\'; ' +
    '[Win32.Shell]::SHChangeNotify(0x08000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)';
  const notifyShell = new Promise<void>((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psCommand],
      { windowsHide: true },
      () => resolve(),
    );
  });
  const ie4uinit = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'ie4uinit.exe');
  const flushIconCache = new Promise<void>((resolve) => {
    execFile(ie4uinit, ['-show'], { windowsHide: true }, () => resolve());
  });
  return Promise.all([notifyShell, flushIconCache]).then(() => undefined);
}

async function hasRegKey(key: string): Promise<boolean> {
  const res = await execReg(['query', key]);
  return res.code === 0;
}

async function hasConflictingFileExtsState(): Promise<boolean> {
  const userChoice = await queryRegSz(`${FILE_EXTS_KEY}\\UserChoice`, 'ProgId');
  if (userChoice) {
    return false;
  }
  return hasRegKey(`${FILE_EXTS_KEY}\\OpenWithList`);
}

async function cleanConflictingFileExtsState(): Promise<void> {
  const userChoice = await queryRegSz(`${FILE_EXTS_KEY}\\UserChoice`, 'ProgId');
  if (!userChoice && (await hasRegKey(FILE_EXTS_KEY))) {
    await execReg(['delete', FILE_EXTS_KEY, '/f']);
  }
  await execReg(['delete', TOASTS_KEY, '/v', 'Applications\\chrome.exe_.htmd', '/f']);
  await execReg(['add', TOASTS_KEY, '/v', `${PROG_ID}_.htmd`, '/t', 'REG_DWORD', '/d', '0', '/f']);
}

async function setRegSz(key: string, valueName: string | undefined, value: string, logWarn?: (msg: string) => void): Promise<boolean> {
  const args = valueName
    ? ['add', key, '/v', valueName, '/t', 'REG_SZ', '/d', value, '/f']
    : ['add', key, '/ve', '/t', 'REG_SZ', '/d', value, '/f'];
  const res = await execReg(args);
  if (res.code !== 0) {
    logWarn?.(`reg.exe add failed for ${key} (${valueName || '(Default)'}) with exit code ${res.code}`);
    return false;
  }
  return true;
}

/**
 * Ensures `.htmd` is registered under per-user HKCU\Software\Classes on Windows
 * with `Content Type = text/html` and the user's active HTML browser command/icon.
 * Returns true if registry keys were created or updated, false otherwise.
 */
export async function ensureWindowsHtmdAssociation(
  logInfo?: (msg: string) => void,
  logWarn?: (msg: string) => void,
): Promise<boolean> {
  if (process.platform !== 'win32') {
    return false;
  }

  const [extDefault, contentType, hasConflict] = await Promise.all([
    queryRegSz(EXT_KEY),
    queryRegSz(EXT_KEY, 'Content Type'),
    hasConflictingFileExtsState(),
  ]);

  if (extDefault && extDefault !== PROG_ID) {
    logInfo?.(`Skipping .htmd registration; custom association already set (${extDefault}).`);
    return false;
  }

  if (extDefault === PROG_ID && !hasConflict && contentType === 'text/html') {
    return false;
  }

  const { icon, command } = await resolveDefaultHtmlBrowser();

  const writes: Promise<boolean>[] = [
    setRegSz(EXT_KEY, undefined, PROG_ID, logWarn),
    setRegSz(EXT_KEY, 'Content Type', 'text/html', logWarn),
    setRegSz(EXT_KEY, 'PerceivedType', 'text', logWarn),
    setRegSz(`${EXT_KEY}\\OpenWithProgids`, PROG_ID, '', logWarn),
    setRegSz(PROG_ID_KEY, undefined, FRIENDLY_NAME, logWarn),
    setRegSz(`${PROG_ID_KEY}\\shell\\open\\command`, undefined, command, logWarn),
  ];
  if (icon) {
    writes.push(setRegSz(`${PROG_ID_KEY}\\DefaultIcon`, undefined, icon, logWarn));
  }

  const results = await Promise.all(writes);
  if (!results.every(Boolean)) {
    return false;
  }

  if (hasConflict || !extDefault) {
    await cleanConflictingFileExtsState();
  }

  await notifyShellAssociationChanged();
  logInfo?.('Registered per-user Windows .htmd file association (text/html).');
  return true;
}
