param([ValidateSet('all','auth','ledger','planning','states','captures','session')][string]$Section = 'all')
. "$PSScriptRoot\android-ui.ps1"
$output=Join-Path $projectRoot 'docs\review\phase3'
New-Item -ItemType Directory -Force $output | Out-Null
$results=[System.Collections.Generic.List[string]]::new()
$initialScale=(Adb-Run @('shell','settings','get','system','font_scale')).Trim()
function Passed([string]$Message){$results.Add($Message); Write-Output "PASS: $Message"}
function Dismiss-Notice { $node=Ui-Node (Read-Ui) 'Dismiss message'; if($node){Tap-Node $node} }
try {
    if($Section -in @('all','auth')) {
        Adb-Run @('shell','settings','put','system','font_scale','1.0') | Out-Null
        Adb-Run @('reverse','tcp:8081','tcp:8081') | Out-Null
        Adb-Run @('shell','am','force-stop','com.nivvi.app.dev') | Out-Null
        Adb-Run @('shell',"am start -W -a android.intent.action.VIEW -d 'exp+nivvi://?__expo_url=http%3A%2F%2F127.0.0.1%3A8081&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1' -p com.nivvi.app.dev") | Out-Null
        Expect-Text 'Small steps.' 20
        Capture-Ui 'onboarding-light'
        Tap-Text 'Continue' 4; Expect-Text 'From chai breaks'
        Tap-Text 'Back' 4; Expect-Text 'Small steps.'
        Scroll-Top; Tap-Text 'Skip introduction'
        Expect-Text 'A little clarity starts here.'
        Capture-Ui 'login-light'
        Tap-Text 'Enter preview' 4; Expect-Text 'Enter an email like'
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Forgot password?' 4; Expect-Text 'A fresh start, gently.'
        Fill-Field 'Email address' 'preview@example.com' 4
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Preview password reset' 4; Expect-Text 'No email was sent'
        Capture-Ui 'password-reset'
        Tap-Text 'Back to sign in' 5
        Tap-Text 'Create a preview profile' 5; Expect-Text 'Make room for a little progress.'
        Fill-Field 'Preview name' 'Preview explorer' 4
        Fill-Field 'Email address' 'preview@example.com' 4
        Fill-Field 'Sample password' 'Preview123' 5
        Fill-Field 'Confirm sample password' 'Preview123' 5
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Capture-Ui 'registration'
        Tap-Text 'Create preview profile' 6; Expect-Text 'A little more clarity.'
        Passed 'Onboarding navigation, login validation, truthful reset feedback and registration preview'
    }
    if($Section -in @('all','ledger')) {
        Open-Route '/transaction?type=expense'; Expect-Text 'Add expense'
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Scroll-Top; Capture-Ui 'expense-light'
        Fill-Field 'Amount in rupees' '125.50' 4
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Add or change details' 6
        Fill-Field 'Merchant or payee' 'QA coffee' 5
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Add expense to preview' 10; Expect-Text 'QA coffee'
        Capture-Ui 'transaction-detail'
        Tap-Text 'Edit entry' 5; Expect-Text 'Edit transaction'
        Fill-Field 'Amount in rupees' '130.75' 4
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Update preview entry' 10; Expect-Text '130.75'
        Open-Route '/home'; Scroll-Top; Expect-Text '17,680.75'
        Open-Route '/transactions'; Scroll-Top
        Fill-Field 'Search transactions' 'QA coffee' 5
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'QA coffee' 5; Expect-Text '130.75'
        Tap-Text 'Delete entry' 6; Expect-Text 'Remove this entry?'; Tap-Text 'Delete entry'
        Expect-Text 'The little details.'
        Passed 'Expense create/edit updates Home totals; search finds it; confirmed delete removes it'
        Open-Route '/transaction?type=income'; Expect-Text 'Add income'
        Fill-Field 'Amount in rupees' '200'
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Add income to preview' 8; Expect-Text 'Income'
        Open-Route '/transaction-detail?id=shopping'; Expect-Text 'Everyday essentials'
        Tap-Text 'Record a refund' 5; Expect-Text 'Add refund'
        Fill-Field 'Amount in rupees' '99999'
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Add refund to preview' 10; Expect-Text 'remaining refundable amount'
        Passed 'Income entry and refund cap validation through native controls'
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        $backTree=Read-Ui
        if(-not $backTree.OuterXml.Contains('Leave these changes?')){Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null}
        Expect-Text 'Leave these changes?'; Tap-Text 'Discard changes'
        Open-Route '/transaction?id=missing'; Expect-Text 'Entry unavailable'
        Passed 'Unsaved form protection and invalid transaction route'
    }
    if($Section -in @('all','planning')) {
        Open-Route '/categories?create=true'; Expect-Text 'Make it your own.'
        Fill-Field 'Category name' 'QA category' 4
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Add category' 8; Expect-Text 'A place for every little thing.'
        Open-Route '/goal'; Expect-Text 'Something to look forward to'
        Fill-Field 'Goal name' 'QA weekend' 3
        Fill-Field 'Target amount' '100' 4
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Create goal' 6; Expect-Text 'QA weekend'
        Fill-Field 'Contribution amount' '100' 8
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Add contribution' 5; Scroll-Top; Dismiss-Notice; Expect-Text 'You reached your goal.'
        Capture-Ui 'goal-reached'
        Open-Route '/budgets'; Expect-Text 'A plan for your month'
        Fill-Field 'Monthly limit' '100' 10
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Save budget' 12; Hide-Keyboard; Expect-Text 'Category limits must fit'
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        $budgetBackTree=Read-Ui
        if(-not $budgetBackTree.OuterXml.Contains('Leave these changes?')){Scroll-Top; Tap-Text 'Back'}
        Expect-Text 'Leave these changes?'; Tap-Text 'Discard changes'
        Passed 'Custom category, goal creation/contribution/milestone and budget validation'
    }
    if($Section -in @('all','states')) {
        Open-Route '/preview-tools'; Expect-Top 'Room to try things.'
        Tap-Text 'Loading preview' 4; Expect-Text 'Loading your overview'
        Capture-Ui 'loading-state'; Tap-Text 'Finish loading preview'
        Open-Route '/preview-tools'; Expect-Top 'Room to try things.'; Tap-Text 'Error preview' 5; Expect-Text 'We couldn'
        Capture-Ui 'error-state'; Tap-Text 'Try again'; Expect-Text 'Room in your budget'
        Open-Route '/preview-tools'; Expect-Top 'Room to try things.'; Tap-Text 'Empty demo' 8; Expect-Text 'Empty this demo?'; Tap-Text 'Empty demo'
        Open-Route '/home'; Dismiss-Notice; Expect-Text 'A plan for your month'; Capture-Ui 'empty-state'
        Open-Route '/preview-tools'; Expect-Top 'Room to try things.'; Tap-Text 'Reset sample data' 8; Expect-Text 'Restore the starting samples?'; Tap-Text 'Reset sample data'
        Passed 'Recoverable loading/error, empty data and sample reset'
    }
    if($Section -in @('all','captures')) {
        foreach($theme in @('light','dark')) {
            Open-Route '/settings'; Scroll-Top; Tap-Text "$($theme.Substring(0,1).ToUpper())$($theme.Substring(1)) theme" 4
            Open-Route '/home'; Expect-Top 'A little more clarity.'; Dismiss-Notice; Capture-Ui "home-$theme"
            Open-Route '/transaction?type=expense'; Expect-Text 'Add expense'
            Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
            Expect-Top 'A quick note for future you.'; Capture-Ui "expense-$theme"
            Open-Route '/transactions'; Expect-Top 'The little details.'; Capture-Ui "history-$theme"
            Open-Route '/insights'; Expect-Top 'Find your rhythm.'; Capture-Ui "insights-$theme"
        }
        Open-Route '/settings'; Scroll-Top; Tap-Text 'Reduce decorative motion' 8
        Expect-Text 'Reduced motion is active.'
        Open-Route '/home'; Scroll-Top
        Adb-Run @('shell','settings','put','system','font_scale','2.0') | Out-Null
        Expect-Text 'A little more clarity.'; Capture-Ui 'home-system-font-200'
        Tap-Text 'Goals'; Expect-Text 'goal' 8
        Capture-Ui 'goals-system-font-200'
        Adb-Run @('shell','settings','put','system','font_scale','1.0') | Out-Null
        Passed 'Four product screens in both themes; reduced motion and 200% Android text navigation'
    }
    if($Section -in @('all','session')) {
        Open-Route '/profile'; Expect-Text 'A little space for you.'
        Fill-Field 'Preview name' 'QA explorer' 5
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Save preview name' 5; Expect-Text 'Profile updated in this preview.'
        Scroll-Top; Capture-Ui 'profile'
        Tap-Text 'Sign out of preview' 12; Expect-Text 'Leave and reset this preview?'
        Tap-Text 'Sign out and reset preview'; Expect-Text 'A little clarity starts here.'
        Fill-Field 'Email address' 'preview@example.com' 5
        Fill-Field 'Sample password' 'Preview123' 5
        Adb-Run @('shell','input','keyevent','KEYCODE_BACK') | Out-Null
        Tap-Text 'Enter preview' 5; Expect-Text 'A little more clarity.'
        Passed 'Profile editing, confirmed sign-out and valid sign-in through native controls'
    }
    Check-Runtime
    @{section=$Section;status='passed';checks=@($results);device='Pixel_7 API34 x86_64';date=(Get-Date).ToString('o')} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $output "native-$Section.json") -Encoding UTF8
} catch {
    @{section=$Section;status='failed';checks=@($results);error=$_.Exception.Message} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $output "native-$Section.json") -Encoding UTF8
    throw
} finally {
    if($initialScale -eq 'null' -or -not $initialScale){ Adb-Run @('shell','settings','delete','system','font_scale') | Out-Null } else { Adb-Run @('shell','settings','put','system','font_scale',$initialScale) | Out-Null }
}
