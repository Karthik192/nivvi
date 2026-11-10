. "$PSScriptRoot\android-ui.ps1"
$output=Join-Path $projectRoot 'docs\review\phase3'
Adb-Run @('reverse','tcp:8081','tcp:8081') | Out-Null
Adb-Run @('shell','am','force-stop','com.nivvi.app.dev') | Out-Null
Adb-Run @('shell',"am start -W -a android.intent.action.VIEW -d 'exp+nivvi://?__expo_url=http%3A%2F%2F127.0.0.1%3A8081&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1' -p com.nivvi.app.dev") | Out-Null
Expect-Text 'Small steps.' 20; Tap-Text 'Skip introduction'; Expect-Text 'A little clarity starts here.'
Fill-Field 'Email address' 'preview@example.com' 4
Fill-Field 'Sample password' 'Preview123' 4
Hide-Keyboard; Tap-Text 'Enter preview' 4; Expect-Text 'A little more clarity.'
Tap-Text '+ Add expense' 4; Expect-Text 'Add expense'
Fill-Field 'Amount in rupees' '10' 4; Hide-Keyboard
Scroll-Top; Tap-Text 'Back'; Expect-Text 'Leave these changes?'; Write-Output 'PASS: header guard'; Tap-Text 'Cancel'; Expect-Text 'Add expense'
Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
Expect-Text 'Leave these changes?'; Write-Output 'PASS: hardware guard'; Capture-Ui 'unsaved-changes'; Tap-Text 'Discard changes'; Expect-Text 'A little more clarity.'
Open-Route '/transaction?type=expense'; Expect-Text 'Add expense'
Fill-Field 'Amount in rupees' '10' 4; Hide-Keyboard
Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
Expect-Text 'Leave these changes?'; Tap-Text 'Discard changes'; Expect-Text 'A little more clarity.'
Check-Runtime
@{status='passed';checks=@('Header back, cancel, Android Back and discard','Deep-linked unsaved form returns to Home after confirmation')} | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $output 'native-back.json') -Encoding UTF8
'PASS: header and Android Back preserve dirty forms; deep links retain a return route.'
