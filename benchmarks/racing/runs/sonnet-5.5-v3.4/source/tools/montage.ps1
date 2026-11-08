param([string]$Out, [int]$Cols, [int]$TileW, [string[]]$Files)
Add-Type -AssemblyName System.Drawing
$imgs = $Files | ForEach-Object { [System.Drawing.Image]::FromFile((Resolve-Path $_)) }
$TileH = [int]($TileW * $imgs[0].Height / $imgs[0].Width)
$rows = [math]::Ceiling($imgs.Count / $Cols)
$bmp = New-Object System.Drawing.Bitmap ($TileW * $Cols), ($TileH * $rows)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
for ($i = 0; $i -lt $imgs.Count; $i++) { $g.DrawImage($imgs[$i], ($i % $Cols) * $TileW, [math]::Floor($i / $Cols) * $TileH, $TileW, $TileH) }
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $imgs | ForEach-Object { $_.Dispose() }
