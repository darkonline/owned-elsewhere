# Draws the extension icon (stacked game cases + check mark) and writes icon-16/32/48/128.png
param([string]$OutDir = (Join-Path $PSScriptRoot '..\extension\icons'))
Add-Type -AssemblyName System.Drawing

function RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

$S = 512
$bmp = New-Object System.Drawing.Bitmap $S, $S
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)

# background
$bg = RoundRect 16 16 480 480 104
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point 512, 512), ([System.Drawing.Color]::FromArgb(255, 30, 58, 90)), ([System.Drawing.Color]::FromArgb(255, 15, 25, 38))
$g.FillPath($brush, $bg)

# back case
$c1 = RoundRect 150 92 200 270 26
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 54, 98, 140))), $c1)
# front case
$c2 = RoundRect 104 140 210 280 28
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 102, 192, 244))), $c2)
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 72, 150, 205))), (RoundRect 104 140 36 280 18))

# check badge
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 25, 38))), 262, 262, 216, 216)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 92, 168, 52))), 276, 276, 188, 188)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 30
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
$g.DrawLines($pen, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF 322, 372), (New-Object System.Drawing.PointF 358, 408), (New-Object System.Drawing.PointF 422, 334)))
$g.Dispose()

New-Item -ItemType Directory -Force $OutDir | Out-Null
foreach ($size in 16, 32, 48, 128) {
  $out = New-Object System.Drawing.Bitmap $size, $size
  $gg = [System.Drawing.Graphics]::FromImage($out)
  $gg.InterpolationMode = 'HighQualityBicubic'
  $gg.SmoothingMode = 'AntiAlias'
  $gg.PixelOffsetMode = 'HighQuality'
  $gg.DrawImage($bmp, 0, 0, $size, $size)
  $gg.Dispose()
  $out.Save((Join-Path $OutDir "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
}
$bmp.Save((Join-Path $OutDir '..\..\store\icon-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
'icons written'
