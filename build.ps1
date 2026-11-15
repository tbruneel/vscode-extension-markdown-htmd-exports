<#
.SYNOPSIS
    Type-checks, bundles, and packages this VS Code extension into a Marketplace-ready .vsix archive under package\.
.PARAMETER Install
    Installs the built .vsix package into Microsoft VS Code after packaging.
#>
[CmdletBinding()]
param(
    [switch]$Install
)

$ErrorActionPreference = 'Stop'

$repoRoot     = $PSScriptRoot
$repoName     = Split-Path -Leaf $repoRoot
$manifestPath = Join-Path $repoRoot 'package.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "package.json not found in '$repoRoot'."
}

$pkg = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($field in @('name', 'publisher', 'version')) {
    if ([string]::IsNullOrWhiteSpace([string]$pkg.$field)) {
        throw "package.json is missing required '$field' field."
    }
}

if (-not [string]::IsNullOrWhiteSpace([string]$pkg.icon)) {
    $iconRel  = ([string]$pkg.icon) -replace '\\', '/'
    $iconPath = Join-Path $repoRoot ($iconRel -replace '/', '\')
    if (-not (Test-Path -LiteralPath $iconPath -PathType Leaf)) {
        throw "Missing icon file referenced by package.json: '$iconRel'"
    }
}

function New-MarketplaceReadme {
    param([string]$SourceReadmePath)

    $text = [System.IO.File]::ReadAllText($SourceReadmePath, [System.Text.UTF8Encoding]::new($false))
    $linkMap = [ordered]@{
        '](https://github.com/tbruneel/vscode-extension-markdown-alerts)'                   = '](https://marketplace.visualstudio.com/items?itemName=tbruneel.markdown-alerts)'
        '](https://github.com/tbruneel/vscode-extension-markdown-stylesheets)'              = '](https://marketplace.visualstudio.com/items?itemName=tbruneel.markdown-stylesheets)'
        '](https://github.com/tbruneel/vscode-extension-markdown-htmd-exports)'             = '](https://marketplace.visualstudio.com/items?itemName=tbruneel.markdown-htmd-exports)'
        '](https://github.com/tbruneel/vscode-extension-markdown-htmd-exports-antigravity)' = '](https://marketplace.visualstudio.com/items?itemName=tbruneel.markdown-htmd-exports-antigravity)'
        '*(this repo)*'                                                                     = '*(this extension)*'
    }
    foreach ($entry in $linkMap.GetEnumerator()) {
        $text = $text.Replace($entry.Key, $entry.Value)
    }
    return $text
}

$tempReadmePath = $null
Push-Location $repoRoot
try {
    if ($pkg.scripts -and ($pkg.scripts.check -or $pkg.scripts.build)) {
        if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules') -PathType Container)) {
            npm ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
        }
    }

    if ($pkg.scripts -and $pkg.scripts.check) {
        npm run check
        if ($LASTEXITCODE -ne 0) { throw "npm run check failed with exit code $LASTEXITCODE." }
    }

    if ($pkg.scripts -and $pkg.scripts.build) {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE." }
    }

    $packageDir = Join-Path $repoRoot 'package'
    if (-not (Test-Path -LiteralPath $packageDir -PathType Container)) {
        New-Item -Path $packageDir -ItemType Directory -Force | Out-Null
    }

    $vsixPath = Join-Path $packageDir "$repoName-v$($pkg.version).vsix"
    if (Test-Path -LiteralPath $vsixPath -PathType Leaf) {
        Remove-Item -LiteralPath $vsixPath -Force
    }

    $tempReadmePath = Join-Path $packageDir 'marketplace-readme.md'
    $marketplaceReadme = New-MarketplaceReadme -SourceReadmePath (Join-Path $repoRoot 'readme.md')
    [System.IO.File]::WriteAllText($tempReadmePath, $marketplaceReadme, [System.Text.UTF8Encoding]::new($false))

    # Intentionally omit --no-dependencies so .vscodeignore preserves highlight.js/styles/** themes
    npx @vscode/vsce package --readme-path package/marketplace-readme.md --githubBranch main -o $vsixPath
    if ($LASTEXITCODE -ne 0) { throw "vsce package failed with exit code $LASTEXITCODE." }

    Write-Host "[BUILD] Packaged VS Code Marketplace archive: $vsixPath" -ForegroundColor Green

    if ($Install) {
        code --install-extension $vsixPath --force
        if ($LASTEXITCODE -ne 0) { throw "code --install-extension failed with exit code $LASTEXITCODE." }
        Write-Host "[BUILD] Installed extension into Microsoft VS Code: $($pkg.publisher).$($pkg.name) v$($pkg.version)" -ForegroundColor Cyan
    }
} finally {
    if ($tempReadmePath -and (Test-Path -LiteralPath $tempReadmePath -PathType Leaf)) {
        Remove-Item -LiteralPath $tempReadmePath -Force
    }
    Pop-Location
}
