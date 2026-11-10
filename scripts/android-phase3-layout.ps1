. "$PSScriptRoot\android-ui.ps1"
$output=Join-Path $projectRoot 'docs\review\phase3'
$initialScale=(Adb-Run @('shell','settings','get','system','font_scale')).Trim()
try {
    Open-Route '/transactions'; Expect-Top 'The little details.'
    Expect-Text 'Third Wave Coffee'
    Tap-Text 'Filters and sorting' 4; Tap-Text 'Income' 6
    Scroll-Top; Tap-Text 'Hide filters' 4; Expect-Text '1 entry'
    Scroll-Top; Tap-Text 'Filters and sorting' 4; Tap-Text 'All entries' 6
    Scroll-Top; Tap-Text 'Hide filters' 4
    Fill-Field 'Search transactions' 'Third Wave' 4; Hide-Keyboard; Expect-Text '1 entry'
    Fill-Field 'Search transactions' '' 4; Hide-Keyboard; Expect-Text '8 entries'
    Scroll-Top; Tap-Text 'Add entry' 4; Expect-Text 'Add expense'; Hide-Keyboard
    Scroll-Top; Tap-Text 'Back'
    foreach($theme in @('light','dark')) {
        Open-Route '/settings'; Expect-Top 'Make room for you.'
        Tap-Text "$($theme.Substring(0,1).ToUpper())$($theme.Substring(1)) theme" 4
        Open-Route '/transactions'; Expect-Top 'The little details.'
        Expect-Text 'Third Wave Coffee'; Capture-Ui "history-$theme"
        Open-Route '/insights'; Expect-Top 'Find your rhythm.'
        Adb-Run @('shell','input','swipe','500','1850','500','700','350') | Out-Null
        Expect-Text 'Weekly view'; Capture-Ui "insights-chart-$theme"
    }
    Open-Route '/home'; Expect-Top 'A little more clarity.'
    Adb-Run @('shell','settings','put','system','font_scale','2.0') | Out-Null
    Expect-Top 'A little more clarity.'; Capture-Ui 'home-system-font-200'
    Open-Route '/transaction?type=expense'; Expect-Text 'Add expense'; Hide-Keyboard
    Expect-Top 'A quick note for future you.'; Capture-Ui 'expense-system-font-200'
    Check-Runtime
    @{section='layout';status='passed';checks=@('History entries visible above fold; type filters, search and add action work','Updated History captures, chart detail and settled 200% text captures')} | ConvertTo-Json | Set-Content (Join-Path $output 'native-layout.json') -Encoding UTF8
} catch {
    @{section='layout';status='failed';error=$_.Exception.Message} | ConvertTo-Json | Set-Content (Join-Path $output 'native-layout.json') -Encoding UTF8
    throw
} finally {
    Adb-Run @('shell','settings','put','system','font_scale',$initialScale) | Out-Null
}
