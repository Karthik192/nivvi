# Native UI driver for phase review scripts. No external test dependency.
param([string]$Adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe", [string]$Device = 'emulator-5554')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$scratch = Join-Path $projectRoot '.local\android-qa'
New-Item -ItemType Directory -Force $scratch | Out-Null
function Adb-Run {
    param([string[]]$Arguments)
    for($connectionAttempt=0;$connectionAttempt -lt 4;$connectionAttempt++) {
        $previous = $ErrorActionPreference
        try { $ErrorActionPreference = 'Continue'; $response = & $Adb -s $Device @Arguments 2>&1; $code = $LASTEXITCODE }
        finally { $ErrorActionPreference = $previous }
        if($code -eq 0){ return $response }
        if(($response -join "`n") -notmatch 'device offline|device .+ not found|no devices'){break}
        Start-Sleep -Milliseconds 500
    }
    throw "ADB failed: $($Arguments -join ' ') $response"
}
function Read-Ui {
    for ($attempt = 0; $attempt -lt 6; $attempt++) {
        $response = Adb-Run @('shell','uiautomator','dump','/sdcard/nivvi-phase3.xml')
        if (($response -join "`n") -notmatch 'dumped to:') { Start-Sleep -Milliseconds 250; continue }
        Adb-Run @('pull','/sdcard/nivvi-phase3.xml',(Join-Path $scratch 'phase3-ui.xml')) | Out-Null
        [xml]$tree = Get-Content (Join-Path $scratch 'phase3-ui.xml') -Raw -Encoding UTF8
        if ($tree.OuterXml -match "System UI isn.t responding") {
            $waitNode = $tree.SelectNodes('//node') | Where-Object { $_.GetAttribute('text') -eq 'Wait' } | Select-Object -First 1
            if ($waitNode) { Tap-Node $waitNode; continue }
        }
        if ($tree.OuterXml -match 'configured linking in multiple places|Render Error|Uncaught Error|Unable to resolve module|Nivvi.*isn.t responding') { throw 'App runtime error visible in native UI.' }
        return $tree
    }
    throw 'Android did not produce a fresh UI hierarchy.'
}
function Ui-Node {
    param([xml]$Tree,[string]$Label)
    $nodes = @($Tree.SelectNodes('//node') | Where-Object { $text=$_.GetAttribute('text'); $description=$_.GetAttribute('content-desc'); $_.GetAttribute('class') -ne 'android.widget.EditText' -and ($text -eq $Label -or $description -eq $Label -or $description.StartsWith("$Label,") -or $description.StartsWith("$Label ")) })
    $clickable = $nodes | Where-Object { $_.GetAttribute('clickable') -eq 'true' } | Select-Object -First 1
    if ($clickable) { return $clickable }
    return $nodes | Select-Object -First 1
}
function Tap-Node {
    param($Node)
    $b=[regex]::Matches($Node.GetAttribute('bounds'),'\d+') | ForEach-Object { [int]$_.Value }
    Adb-Run @('shell','input','tap',"$([int](($b[0]+$b[2])/2))","$([int](($b[1]+$b[3])/2))") | Out-Null
    Start-Sleep -Milliseconds 300
}
function Scroll-Top { for($i=0;$i -lt 5;$i++){Adb-Run @('shell','input','swipe','500','700','500','1900','150') | Out-Null} }
function Expect-Top {
    param([string]$Text)
    for($attempt=0;$attempt -lt 4;$attempt++){
        Scroll-Top
        $tree=Read-Ui
        if($tree.OuterXml.Contains($Text)){return}
        Start-Sleep -Milliseconds 500
    }
    throw "Expected page header after navigation: $Text"
}
function Tap-Text {
    param([string]$Label,[int]$Scrolls=0)
    for($i=0;$i -lt [Math]::Max(5,$Scrolls+1);$i++) {
        $tree=Read-Ui; $node=Ui-Node $tree $Label
        if($node){Tap-Node $node; return}
        if($i -lt $Scrolls){Adb-Run @('shell','input','swipe','500','1850','500','750','250') | Out-Null}
    }
    throw "Control not visible: $Label"
}
function Expect-Text {
    param([string]$Text,[int]$Attempts=8)
    for($i=0;$i -lt $Attempts;$i++){ $tree=Read-Ui; if($tree.OuterXml.Contains($Text)){return}; Start-Sleep -Milliseconds 300 }
    throw "Expected native text: $Text"
}
function Hide-Keyboard {
    $ime=Adb-Run @('shell','dumpsys','input_method')
    if(($ime -join "`n") -match '\bmInputShown=true'){Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null; Start-Sleep -Milliseconds 250}
}
function Fill-Field {
    param([string]$Label,[string]$Value,[int]$Scrolls=0)
    Hide-Keyboard
    for($i=0;$i -lt [Math]::Max(5,$Scrolls+1);$i++) {
        $tree=Read-Ui; $node=$tree.SelectNodes('//node') | Where-Object { $_.GetAttribute('class') -eq 'android.widget.EditText' -and $_.GetAttribute('content-desc').StartsWith($Label) } | Select-Object -First 1
        if($node){
            Tap-Node $node
            $focusTree=Read-Ui
            $focused=$focusTree.SelectNodes('//node') | Where-Object {$_.GetAttribute('class') -eq 'android.widget.EditText' -and $_.GetAttribute('content-desc').StartsWith($Label) -and $_.GetAttribute('focused') -eq 'true'} | Select-Object -First 1
            if(-not $focused){Hide-Keyboard; Adb-Run @('shell','input','swipe','500','1700','500','700','250') | Out-Null; continue}
            Adb-Run @('shell','input','keyevent','KEYCODE_MOVE_END') | Out-Null
            $deletes=@('shell','input','keyevent') + @((1..([Math]::Max(1,$focused.GetAttribute('text').Length+2))) | ForEach-Object {'KEYCODE_DEL'})
            Adb-Run $deletes | Out-Null
            if($Value){Adb-Run @('shell','input','text',$Value.Replace(' ','%s')) | Out-Null}
            return
        }
        if($i -lt $Scrolls){Adb-Run @('shell','input','swipe','500','1700','500','700','250') | Out-Null}
    }
    throw "Input not visible: $Label"
}
function Open-Route {
    param([string]$Route)
    Adb-Run @('shell',"am start -a android.intent.action.VIEW -d 'nivvi-dev://$Route' -p com.nivvi.app.dev") | Out-Null
    Start-Sleep -Milliseconds 500
}
function Capture-Ui {
    param([string]$Name)
    Read-Ui | Out-Null
    Adb-Run @('shell','screencap','-p','/sdcard/nivvi-phase3.png') | Out-Null
    Adb-Run @('pull','/sdcard/nivvi-phase3.png',(Join-Path $output "$Name.png")) | Out-Null
}
function Check-Runtime {
    $appProcessId=(Adb-Run @('shell','pidof','com.nivvi.app.dev')).Trim()
    $log=Adb-Run @('logcat','-d',"--pid=$appProcessId",'-s','ReactNativeJS:E','AndroidRuntime:E')
    ($log -join "`n") | Set-Content (Join-Path $output 'runtime-errors.txt') -Encoding UTF8
    if(($log -join "`n") -match '\sE\s+(ReactNativeJS|AndroidRuntime)\s*:'){throw 'Runtime error in current app process. See review artifact.'}
}
