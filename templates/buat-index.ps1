# Membuat docs\index.html dari templates\index.template.html (dipanggil oleh jalankan-github.bat)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
foreach ($n in 'PAGES_URL','EXEC_URL') {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($n))) { throw "Pengaturan $n kosong." }
}
$tpl   = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'index.template.html')
$judul = (Get-Content -Raw -Encoding UTF8 (Join-Path $root 'teks-judul.txt')).Trim()
$desk  = ((Get-Content -Raw -Encoding UTF8 (Join-Path $root 'teks-deskripsi.txt')).Trim()) -replace '\s+', ' '
$h = { param($s) [System.Net.WebUtility]::HtmlEncode($s) }
$out = $tpl.Replace('{{JUDUL}}', (& $h $judul)).Replace('{{DESKRIPSI}}', (& $h $desk)).Replace('{{PAGES_URL}}', $env:PAGES_URL).Replace('{{EXEC_URL}}', $env:EXEC_URL)
if ($out -match '\{\{[A-Z_]+\}\}') { throw 'Masih ada isian {{...}} yang belum terganti.' }
[System.IO.File]::WriteAllText((Join-Path $root 'docs\index.html'), $out, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'docs\index.html berhasil dibuat.'
