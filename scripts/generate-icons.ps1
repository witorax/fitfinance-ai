Add-Type -AssemblyName System.Drawing

function New-AppIcon {
    param(
        [int]$Size,
        [string]$OutPath,
        [bool]$Rounded = $true
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)

    # Degrade diagonal : indigo -> violet -> cyan (couleurs de l'app)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 99, 102, 241),
        [System.Drawing.Color]::FromArgb(255, 34, 211, 238),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $blend = New-Object System.Drawing.Drawing2D.ColorBlend
    $blend.Colors = @(
        [System.Drawing.Color]::FromArgb(255, 99, 102, 241),
        [System.Drawing.Color]::FromArgb(255, 139, 92, 246),
        [System.Drawing.Color]::FromArgb(255, 34, 211, 238)
    )
    $blend.Positions = @(0.0, 0.5, 1.0)
    $brush.InterpolationColors = $blend

    if ($Rounded) {
        $radius = [int]($Size * 0.2)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $path.AddArc(0, 0, $d, $d, 180, 90)
        $path.AddArc($Size - $d, 0, $d, $d, 270, 90)
        $path.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
        $path.AddArc(0, $Size - $d, $d, $d, 90, 90)
        $path.CloseFigure()
        $g.FillPath($brush, $path)
    } else {
        $g.FillRectangle($brush, $rect)
    }

    # Lettre "A" (Aiden) en blanc, grasse, centree
    $fontSize = [single]($Size * 0.55)
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = [System.Drawing.Brushes]::White
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textRect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size * 1.05)
    $g.DrawString("A", $font, $textBrush, $textRect, $format)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "icons"
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

New-AppIcon -Size 512 -OutPath (Join-Path $iconsDir "icon-512.png")
New-AppIcon -Size 192 -OutPath (Join-Path $iconsDir "icon-192.png")
New-AppIcon -Size 180 -OutPath (Join-Path $iconsDir "apple-touch-icon.png")
New-AppIcon -Size 32  -OutPath (Join-Path $iconsDir "favicon-32.png") -Rounded $false
New-AppIcon -Size 16  -OutPath (Join-Path $iconsDir "favicon-16.png") -Rounded $false

Write-Host "Icones generees dans $iconsDir"
