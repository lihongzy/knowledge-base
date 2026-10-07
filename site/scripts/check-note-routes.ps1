param([string]$BaseUrl = 'http://127.0.0.1:3001')

$ErrorActionPreference = 'Stop'
$routes = @(
    '/notes/30-resources/tools/git/git%E5%91%BD%E4%BB%A4%E7%BB%83%E4%B9%A0/',
    '/notes/30-resources/tools/git/git%E4%BD%BF%E7%94%A8%E6%89%8B%E5%86%8C/',
    '/notes/30-resources/tools/hello-agents/source-notes/chapter1-first-agent/'
)

foreach ($route in $routes) {
    $response = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + $route) -UseBasicParsing -TimeoutSec 30
    if ($response.StatusCode -ne 200 -or $response.Content -match 'missing param' -or $response.Content -notmatch 'class="prose"') {
        throw "Note route failed to render: $route"
    }
    Write-Output "PASS $route"
}
