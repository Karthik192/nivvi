param(
    [string]$Adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    [string]$Device = 'emulator-5554'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$output = Join-Path $projectRoot 'docs\review\phase2'
$scratch = Join-Path $projectRoot '.local\android-qa'
New-Item -ItemType Directory -Force -Path $output, $scratch | Out-Null
$results = [System.Collections.Generic.List[string]]::new()

function Invoke-Adb {
    param([string[]]$Arguments)
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $response = & $Adb -s $Device @Arguments 2>&1
        $commandExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($commandExitCode -ne 0) { throw "ADB failed: $($Arguments -join ' ') $response" }
    return $response
}

function Get-Ui {
    for ($dumpAttempt = 0; $dumpAttempt -lt 5; $dumpAttempt++) {
        $dumpResponse = Invoke-Adb -Arguments @('shell', 'uiautomator', 'dump', '/sdcard/nivvi-phase2-ui.xml')
        if (($dumpResponse -join "`n") -match 'dumped to:') { break }
        Start-Sleep -Milliseconds 250
    }
    if (($dumpResponse -join "`n") -notmatch 'dumped to:') {
        throw "Android did not produce a fresh UI hierarchy: $dumpResponse"
    }
    $localPath = Join-Path $scratch 'ui.xml'
    Invoke-Adb -Arguments @('pull', '/sdcard/nivvi-phase2-ui.xml', $localPath) | Out-Null
    $tree = [xml](Get-Content -LiteralPath $localPath -Raw -Encoding UTF8)
    if ($tree.OuterXml -match 'configured linking in multiple places|Render Error|Uncaught Error|Unable to resolve module') {
        throw 'Native UI contains a runtime error. Inspect .local/android-qa/ui.xml and logcat.'
    }
    return $tree
}

function Find-Node {
    param([string]$Label, [xml]$Tree)
    $matchingNodes = @($Tree.SelectNodes('//node') | Where-Object {
        $description = [string]$_.GetAttribute('content-desc')
        $_.text -eq $Label -or $description -eq $Label -or $description.StartsWith("$Label,") -or $description.StartsWith("$Label ")
    })
    $clickable = $matchingNodes | Where-Object { $_.clickable -eq 'true' } | Select-Object -First 1
    if ($clickable) { return $clickable }
    return $matchingNodes | Select-Object -First 1
}

function Tap-Label {
    param([string]$Label)
    $target = $null
    for ($attempt = 0; $attempt -lt 5 -and -not $target; $attempt++) {
        $tree = Get-Ui
        $target = Find-Node -Label $Label -Tree $tree
        if (-not $target) { Start-Sleep -Milliseconds 250 }
    }
    if (-not $target) { throw "UI control not visible: $Label" }
    $coordinates = [regex]::Matches($target.bounds, '\d+') | ForEach-Object { [int]$_.Value }
    $centerX = [int](($coordinates[0] + $coordinates[2]) / 2)
    $centerY = [int](($coordinates[1] + $coordinates[3]) / 2)
    Invoke-Adb -Arguments @('shell', 'input', 'tap', "$centerX", "$centerY") | Out-Null
    Start-Sleep -Milliseconds 350
}

function Assert-Text {
    param([string]$Text, [int]$Attempts = 5)
    for ($attempt = 0; $attempt -lt $Attempts; $attempt++) {
        $tree = Get-Ui
        if ($tree.OuterXml -like "*$Text*") { $results.Add($Text); return }
        Start-Sleep -Milliseconds 250
    }
    throw "Expected native UI text: $Text"
}

function Save-Capture {
    param([string]$Name)
    Start-Sleep -Milliseconds 500
    Invoke-Adb -Arguments @('shell', 'screencap', '-p', '/sdcard/nivvi-phase2.png') | Out-Null
    Invoke-Adb -Arguments @('pull', '/sdcard/nivvi-phase2.png', (Join-Path $output "$Name.png")) | Out-Null
}

function Get-TextHeight {
    param([string]$Label)
    $tree = Get-Ui
    $target = Find-Node -Label $Label -Tree $tree
    if (-not $target) { throw "Text not visible for scaling measurement: $Label" }
    $coordinates = [regex]::Matches($target.bounds, '\d+') | ForEach-Object { [int]$_.Value }
    return $coordinates[3] - $coordinates[1]
}

function Assert-NoRuntimeErrors {
    $nativeProcessId = (Invoke-Adb -Arguments @('shell', 'pidof', 'com.nivvi.app.dev')).Trim()
    $runtimeLog = Invoke-Adb -Arguments @('logcat', '-d', "--pid=$nativeProcessId", '-s', 'ReactNativeJS:E', 'AndroidRuntime:E')
    ($runtimeLog -join "`n") | Set-Content -LiteralPath (Join-Path $output 'runtime-errors.txt') -Encoding UTF8
    if (($runtimeLog -join "`n") -match '\sE\s+(ReactNativeJS|AndroidRuntime)\s*:') {
        throw 'Native runtime logged an error; see docs/review/phase2/runtime-errors.txt.'
    }
    $results.Add('No ReactNativeJS/AndroidRuntime errors for the current app process')
}

function Reveal-Text {
    param([string]$Text)
    for ($attempt = 0; $attempt -lt 4; $attempt++) {
        $tree = Get-Ui
        if ($tree.OuterXml -like "*$Text*") { return }
        Invoke-Adb -Arguments @('shell', 'input', 'swipe', '500', '1800', '500', '900', '400') | Out-Null
    }
    throw "Could not reveal native text by scrolling: $Text"
}

$initialScale = (Invoke-Adb -Arguments @('shell', 'settings', 'get', 'system', 'font_scale')).Trim()
try {
    Invoke-Adb -Arguments @('shell', 'settings', 'put', 'system', 'font_scale', '1.0') | Out-Null
    Invoke-Adb -Arguments @('reverse', 'tcp:8081', 'tcp:8081') | Out-Null
    Invoke-Adb -Arguments @('shell', 'am', 'force-stop', 'com.nivvi.app.dev') | Out-Null
    Invoke-Adb -Arguments @('shell', "am start -W -a android.intent.action.VIEW -d 'exp+nivvi://?__expo_url=http%3A%2F%2F127.0.0.1%3A8081&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1' -p com.nivvi.app.dev") | Out-Null
    Start-Sleep -Seconds 2
    $launchTree = Get-Ui
    if ($launchTree.OuterXml -like '*Open DevTools*') { Tap-Label 'Close' }
    Invoke-Adb -Arguments @('shell', "am start -a android.intent.action.VIEW -d 'nivvi-dev://?__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1' -p com.nivvi.app.dev") | Out-Null
    Assert-Text 'A little, further.' -Attempts 20
    Tap-Label 'Settings'
    Tap-Label 'Light theme'
    Tap-Label 'Studio'
    Assert-Text 'A little, further.'
    Save-Capture 'studio-light'
    Tap-Label 'About this foundation'
    Assert-Text 'A foundation to grow from.'
    Tap-Label 'Back to Studio'
    Assert-Text 'A little, further.'
    Tap-Label 'Motion'
    Assert-Text 'Motion, with purpose.'
    Tap-Label 'Reset progress to 40 percent'
    Assert-Text '40%'
    Tap-Label 'Set progress to 80 percent'
    Assert-Text '80%'
    Save-Capture 'motion'
    Tap-Label 'Settings'
    Assert-Text 'Make room for you.'
    Tap-Label 'Dark theme'
    Assert-Text 'Current resolved theme: dark.'
    Save-Capture 'settings-dark'
    Invoke-Adb -Arguments @('shell', 'input', 'swipe', '500', '1900', '500', '900', '400') | Out-Null
    $settingsTree = Get-Ui
    $motionSwitch = Find-Node -Label 'Reduce decorative motion' -Tree $settingsTree
    if (-not $motionSwitch) { throw 'Reduced motion switch was not exposed in the native UI.' }
    if ($motionSwitch.GetAttribute('checked') -ne 'true') { Tap-Label 'Reduce decorative motion' }
    Assert-Text 'Reduced motion is active.'
    Tap-Label 'Motion'
    Assert-Text 'Motion, with purpose.'
    Reveal-Text 'Reduced motion is active.'
    Assert-Text 'Reduced motion is active.'
    Tap-Label 'Studio'
    Assert-Text 'A little, further.'
    Save-Capture 'studio-dark'
    $normalTitleHeight = Get-TextHeight 'A little, further.'
    $normalTabHeight = Get-TextHeight 'Studio'
    Invoke-Adb -Arguments @('shell', 'settings', 'put', 'system', 'font_scale', '2.0') | Out-Null
    Start-Sleep -Seconds 2
    Assert-Text 'A little, further.'
    $largeTitleHeight = Get-TextHeight 'A little, further.'
    if ($largeTitleHeight -le $normalTitleHeight) { throw 'System font scale did not enlarge native text.' }
    $largeTabHeight = Get-TextHeight 'Studio'
    if ($largeTabHeight -le $normalTabHeight) { throw 'Tab bar did not grow with enlarged labels.' }
    Save-Capture 'studio-system-font-200'
    Tap-Label 'Motion'
    Invoke-Adb -Arguments @('shell', 'input', 'swipe', '500', '800', '500', '1900', '400') | Out-Null
    Invoke-Adb -Arguments @('shell', 'input', 'swipe', '500', '800', '500', '1900', '400') | Out-Null
    Assert-Text '80%'
    $results.Add('Native text and tab bar enlarged at font_scale=2.0; navigation and progress state retained')
    Invoke-Adb -Arguments @('shell', 'settings', 'put', 'system', 'font_scale', '1.0') | Out-Null
    Start-Sleep -Seconds 2
    Tap-Label 'Studio'
    Assert-Text 'A little, further.'
    $restoredTitleHeight = Get-TextHeight 'A little, further.'
    if ($restoredTitleHeight -ge $largeTitleHeight) { throw 'Native text did not shrink after restoring system scale.' }
    $results.Add('Native text shrank at font_scale=1.0 without restarting navigation')
    Assert-NoRuntimeErrors
    $results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'smoke-results.json') -Encoding UTF8
    'PASS: native tab/modal navigation, light/dark selection, progress update and 200% Android system text capture.'
} finally {
    if ($initialScale -eq 'null' -or -not $initialScale) {
        Invoke-Adb -Arguments @('shell', 'settings', 'delete', 'system', 'font_scale') | Out-Null
    } else {
        Invoke-Adb -Arguments @('shell', 'settings', 'put', 'system', 'font_scale', $initialScale) | Out-Null
    }
}
