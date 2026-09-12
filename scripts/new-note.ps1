[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]$Path,

    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]$Title,

    [switch]$Open
)

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$notesRoot = Join-Path $repositoryRoot 'notes'
$relativePath = $Path.Trim().TrimStart('/', '\').TrimEnd('/', '\')

if ($relativePath -match '(^|[\\\\/])\.\.([\\\\/]|$)') {
    throw 'Path must stay within the notes directory.'
}

$slug = $Title.ToLowerInvariant()
$slug = $slug -replace '[^a-z0-9\\u4e00-\\u9fff]+', '-'
$slug = $slug.Trim('-')
if ([string]::IsNullOrWhiteSpace($slug)) {
    throw 'Title must contain letters, numbers, or Chinese characters.'
}

$targetDirectory = Join-Path $notesRoot $relativePath
$targetFile = Join-Path $targetDirectory "$slug.md"
if (Test-Path -LiteralPath $targetFile) {
    throw "A note already exists at $targetFile"
}

New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
$now = Get-Date -Format 'yyyy-MM-dd'
$templatePath = Join-Path $repositoryRoot 'templates/note.md'
$content = Get-Content -LiteralPath $templatePath -Raw
$content = $content.Replace('{{title}}', $Title).Replace('{{created}}', $now).Replace('{{updated}}', $now)
Set-Content -LiteralPath $targetFile -Value $content -Encoding utf8NoBOM

& (Join-Path $PSScriptRoot 'update-index.ps1')

if ($Open) {
    Invoke-Item -LiteralPath $targetFile
}

Write-Output "Created $targetFile"
