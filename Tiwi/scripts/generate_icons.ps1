param(
    [string]$SourcePath = "c:\Users\imran\Desktop\Tiwlo\Tiwi\assets\tiwi.png",
    [string]$ResPath = "c:\Users\imran\Desktop\Tiwlo\Tiwi\android\app\src\main\res"
)

Add-Type -AssemblyName System.Drawing

function Generate-ResizedImage {
    param(
        [string]$Src,
        [string]$Dst,
        [int]$TargetWidth,
        [int]$TargetHeight,
        [double]$ScaleFactor = 1.0,
        [bool]$IsRound = $false
    )

    $srcImg = [System.Drawing.Image]::FromFile($Src)
    $bmp = New-Object System.Drawing.Bitmap($TargetWidth, $TargetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    if ($IsRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $TargetWidth, $TargetHeight)
        $g.SetClip($path)
    }

    $drawW = [int]($TargetWidth * $ScaleFactor)
    $drawH = [int]($TargetHeight * $ScaleFactor)
    $offsetX = [int](($TargetWidth - $drawW) / 2)
    $offsetY = [int](($TargetHeight - $drawH) / 2)

    $destRect = New-Object System.Drawing.Rectangle($offsetX, $offsetY, $drawW, $drawH)
    $srcRect = New-Object System.Drawing.Rectangle(0, 0, $srcImg.Width, $srcImg.Height)
    $g.DrawImage($srcImg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $srcImg.Dispose()
    $g.Dispose()

    # Ensure parent dir exists
    $parent = [System.IO.Path]::GetDirectoryName($Dst)
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    if (Test-Path $Dst) {
        Remove-Item $Dst -Force
    }

    $bmp.Save($Dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Created: $Dst ($TargetWidth x $TargetHeight)"
}

$densities = @(
    @{ Name = "mipmap-mdpi";    LauncherSize = 48;  ForegroundSize = 108 },
    @{ Name = "mipmap-hdpi";    LauncherSize = 72;  ForegroundSize = 162 },
    @{ Name = "mipmap-xhdpi";   LauncherSize = 96;  ForegroundSize = 216 },
    @{ Name = "mipmap-xxhdpi";  LauncherSize = 144; ForegroundSize = 324 },
    @{ Name = "mipmap-xxxhdpi"; LauncherSize = 192; ForegroundSize = 432 }
)

foreach ($d in $densities) {
    $dir = Join-Path $ResPath $d.Name
    
    # 1. Clean up old .webp files to avoid conflicts
    $webpFiles = @("ic_launcher.webp", "ic_launcher_round.webp", "ic_launcher_foreground.webp")
    foreach ($wf in $webpFiles) {
        $wPath = Join-Path $dir $wf
        if (Test-Path $wPath) {
            Remove-Item $wPath -Force
            Write-Output "Removed old webp: $wPath"
        }
    }

    # 2. Generate ic_launcher.png (Full/Square with rounded corners safe padding)
    $launcherDst = Join-Path $dir "ic_launcher.png"
    Generate-ResizedImage -Src $SourcePath -Dst $launcherDst -TargetWidth $d.LauncherSize -TargetHeight $d.LauncherSize -ScaleFactor 1.0 -IsRound $false

    # 3. Generate ic_launcher_round.png
    $roundDst = Join-Path $dir "ic_launcher_round.png"
    Generate-ResizedImage -Src $SourcePath -Dst $roundDst -TargetWidth $d.LauncherSize -TargetHeight $d.LauncherSize -ScaleFactor 0.95 -IsRound $true

    # 4. Generate ic_launcher_foreground.png (Adaptive icon foreground with 68% safe zone)
    $fgDst = Join-Path $dir "ic_launcher_foreground.png"
    Generate-ResizedImage -Src $SourcePath -Dst $fgDst -TargetWidth $d.ForegroundSize -TargetHeight $d.ForegroundSize -ScaleFactor 0.68 -IsRound $false
}

Write-Output "All Tiwi launcher icons successfully generated from $SourcePath!"
