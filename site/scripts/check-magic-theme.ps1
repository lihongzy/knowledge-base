param([string]$BaseUrl = 'http://127.0.0.1:3001')
$ErrorActionPreference = 'Stop'
$routes = @('/', '/topics/agent/', '/topics/novel-scraper/', '/topics/anime-scraper/', '/novels/', '/novels/no-game-no-life/', '/novels/no-game-no-life/002/', '/notes/30-resources/tools/novel-scraper/linovelib-%E5%B0%8F%E8%AF%B4%E7%88%AC%E8%99%AB/')
foreach ($route in $routes) {
  $page = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + $route)
  if ($page.StatusCode -ne 200) { throw "Route failed: $route" }
  if ($page.Content -notmatch 'YUME / STAR ARCHIVE' -or $page.Content -notmatch 'class="starfield"') { throw "Missing shared theme: $route" }
  if ($page.Content -notmatch '<html[^>]*class="light"') { throw "Default theme must be daylight: $route" }
  if ($page.Content -notmatch '当前白天主题，切换到黑夜' -or $page.Content -notmatch '收起侧边栏') { throw "Missing theme/sidebar controls: $route" }
  if ($page.Content -match '<div class="starfield"[^>]*>\s*<div') { throw "Background must mount after hydration: $route" }
  if ([regex]::Matches($page.Content, '<html(?:\s|>)').Count -ne 1 -or [regex]::Matches($page.Content, '<body(?:\s|>)').Count -ne 1) { throw "Nested document: $route" }
  if ([regex]::Matches($page.Content, '<h1(?:\s|>)').Count -ne 1) { throw "Duplicate or missing title: $route" }
  "PASS $route"
}
