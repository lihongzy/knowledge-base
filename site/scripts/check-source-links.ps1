param([string]$BaseUrl = 'http://127.0.0.1:3001')

$ErrorActionPreference = 'Stop'
$notePath = '/notes/30-resources/tools/video-scraper/%E4%BB%8E0%E5%BC%80%E5%A7%8B%E7%9A%84%E5%BC%82%E4%B8%96%E7%95%8C-%E5%8D%95%E5%AD%A3%E7%9B%B4%E9%93%BE%E4%B8%8B%E8%BD%BD/'
$note = Invoke-WebRequest ($BaseUrl.TrimEnd('/') + $notePath) -UseBasicParsing -TimeoutSec 60
foreach ($file in @('scratch.js', 'downloadVideo.js')) {
    $pattern = 'href="([^"]*/' + [regex]::Escape($file) + '/?)"'
    $match = [regex]::Match($note.Content, $pattern)
    if (-not $match.Success -or -not $match.Groups[1].Value.StartsWith('/code/')) {
        throw "Source link does not point to the code viewer: $file"
    }
    $source = Invoke-WebRequest ($BaseUrl.TrimEnd('/') + $match.Groups[1].Value) -UseBasicParsing -TimeoutSec 60
    if ($source.StatusCode -ne 200 -or $source.Content -notmatch 'class="source-code"' -or $source.Content -notmatch '复制源码') {
        throw "Code viewer did not render: $file"
    }
    Write-Output "PASS $file opens in the code viewer"
}
