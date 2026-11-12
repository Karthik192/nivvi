param([ValidateSet('auth','ledger','planning','session','captures')][string]$Section='auth')
. "$PSScriptRoot\android-ui.ps1"
$output=Join-Path $projectRoot 'docs\review\phase5'
New-Item -ItemType Directory -Force $output | Out-Null
$accountPath=Join-Path $projectRoot '.local\phase5-account.json'
if(Test-Path -LiteralPath $accountPath){$account=Get-Content -LiteralPath $accountPath -Raw | ConvertFrom-Json}
else{$account=[pscustomobject]@{email="phase5-$([guid]::NewGuid().ToString('N'))@example.test";password=[guid]::NewGuid().ToString('N')};$account|ConvertTo-Json|Set-Content -LiteralPath $accountPath -Encoding UTF8}
Adb-Run @('reverse','tcp:8081','tcp:8081') | Out-Null
Adb-Run @('reverse','tcp:3000','tcp:3000') | Out-Null
if($Section -eq 'auth'){
 $account=[pscustomobject]@{email="phase5-$([guid]::NewGuid().ToString('N'))@example.test";password=[guid]::NewGuid().ToString('N')};$account|ConvertTo-Json|Set-Content -LiteralPath $accountPath -Encoding UTF8
 Open-Route '/register';Expect-Text 'Make room for a little progress.'
 Fill-Field 'Your name' 'Phase Five' 4
 Fill-Field 'Email address' $account.email 4
 Fill-Field 'Password' $account.password 5
 Fill-Field 'Confirm password' $account.password 5
 Hide-Keyboard;Tap-Text 'Create account' 5
 Expect-Text 'A little more clarity.' 14
 Capture-Ui 'home-empty-light'
 Write-Output 'PASS: real registration opens the empty account dashboard'
}
if($Section -eq 'ledger'){
 Open-Route '/transaction?type=expense';Expect-Text 'Add expense'
 Fill-Field 'Amount in rupees' '125.50' 4
 Hide-Keyboard;Tap-Text 'Add or change details' 5
 Fill-Field 'Merchant or payee' 'Phase5 coffee' 6
 Hide-Keyboard
 try{
  Adb-Run @('reverse','--remove','tcp:3000') | Out-Null
  Tap-Text 'Save expense' 10;Expect-Text 'Could not reach Nivvi' 12
  Capture-Ui 'expense-network-error';Scroll-Top;Expect-Text '125.50'
 }finally{Adb-Run @('reverse','tcp:3000','tcp:3000') | Out-Null}
 Tap-Text 'Save expense' 10;Expect-Text 'Phase5 coffee' 12
 Capture-Ui 'expense-saved'
 Tap-Text 'Edit entry' 6;Fill-Field 'Amount in rupees' '130.75' 4;Hide-Keyboard
 Tap-Text 'Update entry' 10;Expect-Text '130.75' 12
 Open-Route '/home';Expect-Text '130.75' 12;Capture-Ui 'home-live-light'
 Open-Route '/transactions';Fill-Field 'Search transactions' 'Phase5 coffee' 3;Hide-Keyboard
 Expect-Text 'Phase5 coffee';Capture-Ui 'history-live-light'
 Open-Route '/insights';Expect-Text '130.75' 12;Capture-Ui 'insights-live-light'
 Write-Output 'PASS: failed save retains the draft; retry/edit/search/report use real records'
}
if($Section -eq 'planning'){
 Open-Route '/categories?create=true';Fill-Field 'Category name' 'Phase5 treats' 4;Hide-Keyboard
 Tap-Text 'Add category' 8;Expect-Text 'A place for every little thing.' 12
 Open-Route '/goal';Fill-Field 'Goal name' 'Phase5 weekend' 4;Fill-Field 'Target amount' '1000' 5;Hide-Keyboard
 Tap-Text 'Create goal' 10;Expect-Text 'Phase5 weekend' 12
 Fill-Field 'Contribution amount' '250' 8;Hide-Keyboard;Tap-Text 'Add contribution' 10;Expect-Text '250' 12
 Capture-Ui 'goal-live-light'
 Open-Route '/budgets';Fill-Field 'Monthly limit' '2000' 10;Hide-Keyboard
 Tap-Text 'Save budget' 12;Expect-Text 'Budget updated' 12;Capture-Ui 'budget-live-light'
 Write-Output 'PASS: custom category, savings goal/contribution and monthly budget save online'
}
if($Section -eq 'session'){
 Adb-Run @('shell','am','force-stop','com.nivvi.app.dev') | Out-Null
 Adb-Run @('shell',"am start -W -a android.intent.action.VIEW -d 'exp+nivvi://?__expo_url=http%3A%2F%2F127.0.0.1%3A8081&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1' -p com.nivvi.app.dev") | Out-Null
 Expect-Text 'A little more clarity.' 18;Expect-Text '130.75' 12;Capture-Ui 'restored-session'
 Write-Output 'PASS: process restart restores the secure session and server records'
}
if($Section -eq 'captures'){
 Open-Route '/home';Capture-Ui 'home-live-final'
 Open-Route '/insights';Capture-Ui 'insights-live-final'
 Open-Route '/transactions';Capture-Ui 'history-live-final'
}
