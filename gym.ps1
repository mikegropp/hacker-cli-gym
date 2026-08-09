[CmdletBinding(PositionalBinding = $false)]
param(
    [Parameter(Position = 0)]
    [string]$Action = 'start',

    [Parameter(Position = 1)]
    [string]$Selector
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

$script:Root = $PSScriptRoot
$script:CatalogPath = Join-Path $script:Root 'curriculum\powershell.json'
$script:StateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'HackerCliGym'
$script:Workspace = Join-Path $script:StateRoot 'hacker-cli-gym-workspace'
$script:ProgressPath = Join-Path $script:StateRoot 'powershell-progress.json'
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:LastOutput = ''
$script:LastExitCode = 0
$script:NavigateTo = $null

if (-not (Test-Path $script:CatalogPath -PathType Leaf)) {
    throw "PowerShell curriculum not found at $script:CatalogPath"
}

$script:Catalog = Get-Content $script:CatalogPath -Raw | ConvertFrom-Json
$script:Lessons = @($script:Catalog.lessons | Sort-Object order)
$script:TotalLessons = $script:Lessons.Count
$script:CommandCount = [int]$script:Catalog.command_count
$script:StagesPerCommand = [int]$script:Catalog.stages_per_command

function Initialize-State {
    New-Item -ItemType Directory -Path $script:StateRoot,$script:Workspace -Force | Out-Null
    if (-not (Test-Path $script:ProgressPath -PathType Leaf)) {
        [IO.File]::WriteAllText($script:ProgressPath, '{"completed":{}}', $script:Utf8NoBom)
    }
    try {
        $script:Progress = Get-Content $script:ProgressPath -Raw | ConvertFrom-Json
    }
    catch {
        throw "Progress file is invalid JSON: $script:ProgressPath"
    }
    if ($null -eq $script:Progress.completed) {
        $script:Progress | Add-Member -MemberType NoteProperty -Name completed -Value ([pscustomobject]@{})
    }
}

function Save-Progress {
    $json = $script:Progress | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($script:ProgressPath, $json, $script:Utf8NoBom)
}

function Get-CompletionProperty([string]$Id) {
    return $script:Progress.completed.PSObject.Properties[$Id]
}

function Test-Completed([string]$Id) {
    return $null -ne (Get-CompletionProperty $Id)
}

function Get-TotalXp {
    $sum = 0
    foreach ($property in $script:Progress.completed.PSObject.Properties) {
        $sum += [int]$property.Value.points
    }
    return $sum
}

function Complete-Lesson($Lesson, [int]$Attempts, [int]$Hints) {
    $score = [Math]::Max(20, 110 - (10 * [Math]::Max(1, $Attempts)) - (15 * $Hints))
    $existing = Get-CompletionProperty $Lesson.id
    $oldScore = 0
    if ($null -ne $existing) { $oldScore = [int]$existing.Value.points }
    $best = [Math]::Max($oldScore, $score)
    $record = [pscustomobject]@{
        points = $best
        attempts = $Attempts
        hints = $Hints
        completed_at = (Get-Date).ToString('o')
    }
    $script:Progress.completed | Add-Member -MemberType NoteProperty -Name $Lesson.id -Value $record -Force
    Save-Progress
    return ($best - $oldScore)
}

function Get-Lesson([string]$Target) {
    if ([string]::IsNullOrWhiteSpace($Target)) { return $null }

    $exact = $script:Lessons | Where-Object id -eq $Target | Select-Object -First 1
    if ($null -ne $exact) { return $exact }

    $number = 0
    if ([int]::TryParse($Target, [ref]$number)) {
        return $script:Lessons | Where-Object order -eq $number | Select-Object -First 1
    }

    $matches = @($script:Lessons | Where-Object command -eq $Target | Sort-Object stage)
    if ($matches.Count -gt 0) {
        foreach ($match in $matches) {
            if (-not (Test-Completed $match.id)) { return $match }
        }
        return $matches[0]
    }
    return $null
}

function Get-NextLesson($Lesson) {
    return $script:Lessons | Where-Object order -eq ([int]$Lesson.order + 1) | Select-Object -First 1
}

function Get-PreviousLesson($Lesson) {
    return $script:Lessons | Where-Object order -eq ([int]$Lesson.order - 1) | Select-Object -First 1
}

function Get-NextIncomplete {
    foreach ($lesson in $script:Lessons) {
        if (-not (Test-Completed $lesson.id)) { return $lesson }
    }
    return $null
}

function Resolve-WorkspacePath([string]$RelativePath) {
    if ([string]::IsNullOrWhiteSpace($RelativePath) -or [IO.Path]::IsPathRooted($RelativePath)) {
        throw "Unsafe curriculum path: $RelativePath"
    }
    $parts = $RelativePath -split '[\\/]'
    if ($parts -contains '..') { throw "Unsafe curriculum path: $RelativePath" }
    $full = [IO.Path]::GetFullPath((Join-Path $script:Workspace ($parts -join [IO.Path]::DirectorySeparatorChar)))
    $prefix = $script:Workspace.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Curriculum path escapes the workspace: $RelativePath"
    }
    return $full
}

function Reset-Workspace($Lesson) {
    New-Item -ItemType Directory -Path $script:Workspace -Force | Out-Null
    Get-ChildItem $script:Workspace -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction Stop

    foreach ($directory in @($Lesson.directories)) {
        $path = Resolve-WorkspacePath ([string]$directory)
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }

    foreach ($property in $Lesson.files.PSObject.Properties) {
        $path = Resolve-WorkspacePath $property.Name
        $parent = Split-Path $path -Parent
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        [IO.File]::WriteAllText($path, [string]$property.Value, $script:Utf8NoBom)
    }

    Set-Location $script:Workspace
    foreach ($setupCommand in @($Lesson.setup)) {
        if ([string]::IsNullOrWhiteSpace([string]$setupCommand)) { continue }
        $setupBlock = [scriptblock]::Create([string]$setupCommand)
        $setupResult = @(& $setupBlock *>&1)
        if (-not $?) {
            $detail = ($setupResult | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
            throw "Cannot prepare fixture for $($Lesson.id): $detail"
        }
    }
}

function Convert-ResultToText($Item) {
    if ($null -eq $Item) { return '' }
    if ($Item -is [System.Management.Automation.ErrorRecord]) { return $Item.ToString() }
    if ($Item -is [System.Management.Automation.WarningRecord]) { return $Item.Message }
    if ($Item -is [System.Management.Automation.VerboseRecord]) { return $Item.Message }
    if ($Item -is [System.Management.Automation.DebugRecord]) { return $Item.Message }
    if ($Item -is [System.Management.Automation.InformationRecord]) { return [string]$Item.MessageData }
    return [string]$Item
}

function Invoke-GymCommand([string]$Command, [switch]$Quiet) {
    $script:LastOutput = ''
    $script:LastExitCode = 0
    $results = @()
    try {
        $block = [scriptblock]::Create($Command)
        $results = @(. $block *>&1)
        $succeeded = $?
        if (-not $succeeded) { $script:LastExitCode = 1 }
    }
    catch {
        $results += $_
        $script:LastExitCode = 1
    }

    $lines = @($results | ForEach-Object { Convert-ResultToText $_ })
    $script:LastOutput = $lines -join "`n"
    if (-not $Quiet) {
        foreach ($line in $lines) { Write-Output $line }
        Write-Host "[exit $($script:LastExitCode)]" -ForegroundColor DarkGray
    }
}

function Normalize-Text([string]$Text, [string]$Mode = 'trim') {
    if ($null -eq $Text) { $Text = '' }
    $normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
    if ($Mode -eq 'exact') { return $normalized }
    return $normalized.Trim()
}

function Get-FileText([string]$RelativePath) {
    $path = Resolve-WorkspacePath $RelativePath
    if (-not (Test-Path $path -PathType Leaf)) { return $null }
    return [IO.File]::ReadAllText($path)
}

function Test-Checks($Lesson, [switch]$Show) {
    $passedAll = $true
    foreach ($check in @($Lesson.checks)) {
        $passed = $false
        $type = [string]$check.type
        switch ($type) {
            'stdout' {
                $normalizeProperty = $check.PSObject.Properties['normalize']
                $mode = if ($null -ne $normalizeProperty) { [string]$normalizeProperty.Value } else { 'trim' }
                $passed = (Normalize-Text $script:LastOutput $mode) -ceq (Normalize-Text ([string]$check.expected) $mode)
            }
            'stdout-contains' { $passed = $script:LastOutput.IndexOf([string]$check.expected, [StringComparison]::OrdinalIgnoreCase) -ge 0 }
            'stdout-not-contains' { $passed = $script:LastOutput.IndexOf([string]$check.expected, [StringComparison]::OrdinalIgnoreCase) -lt 0 }
            'output-contains' { $passed = $script:LastOutput.IndexOf([string]$check.expected, [StringComparison]::OrdinalIgnoreCase) -ge 0 }
            'stdout-regex' { $passed = $script:LastOutput -match [string]$check.expected }
            'stdout-nonempty' { $passed = -not [string]::IsNullOrWhiteSpace($script:LastOutput) }
            'exit-code' { $passed = $script:LastExitCode -eq [int]$check.expected }
            'path-exists' {
                $path = Resolve-WorkspacePath ([string]$check.path)
                $kindProperty = $check.PSObject.Properties['kind']
                $kind = if ($null -ne $kindProperty) { [string]$kindProperty.Value } else { 'file' }
                if ($kind -eq 'directory') { $passed = Test-Path $path -PathType Container }
                else { $passed = Test-Path $path -PathType Leaf }
            }
            'path-not-exists' { $passed = -not (Test-Path (Resolve-WorkspacePath ([string]$check.path))) }
            'file-content' {
                $actual = Get-FileText ([string]$check.path)
                $passed = $null -ne $actual -and (Normalize-Text $actual) -ceq (Normalize-Text ([string]$check.expected))
            }
            'file-content-contains' {
                $actual = Get-FileText ([string]$check.path)
                $passed = $null -ne $actual -and $actual.IndexOf([string]$check.expected, [StringComparison]::OrdinalIgnoreCase) -ge 0
            }
            'file-equals' {
                $left = Resolve-WorkspacePath ([string]$check.path)
                $right = Resolve-WorkspacePath ([string]$check.other_path)
                $passed = (Test-Path $left -PathType Leaf) -and (Test-Path $right -PathType Leaf) -and ((Get-FileHash $left).Hash -eq (Get-FileHash $right).Hash)
            }
            default { throw "Unsupported check type '$type' in $($Lesson.id)" }
        }

        if (-not $passed) { $passedAll = $false }
        if ($Show) {
            $marker = if ($passed) { 'PASS' } else { 'TRY ' }
            $color = if ($passed) { 'Green' } else { 'Yellow' }
            Write-Host "[$marker] $($check.description)" -ForegroundColor $color
        }
    }
    return $passedAll
}

function Show-Lesson($Lesson) {
    Clear-Host
    Write-Host 'HACKER CLI GYM' -ForegroundColor Cyan
    Write-Host ("PowerShell rep {0:D3}/{1} | command {2:D3}/{3} | stage {4}/{5}: {6}" -f [int]$Lesson.order,$script:TotalLessons,[int]$Lesson.command_order,$script:CommandCount,[int]$Lesson.stage,$script:StagesPerCommand,$Lesson.stage_name)
    Write-Host ''
    Write-Host "$($Lesson.command) — $($Lesson.title)" -ForegroundColor White
    Write-Host $Lesson.focus
    Write-Host ''
    Write-Host 'EXAMPLE' -ForegroundColor Cyan
    Write-Host $Lesson.example
    if (-not [string]::IsNullOrWhiteSpace([string]$Lesson.example_output)) {
        Write-Host "=> $($Lesson.example_output)" -ForegroundColor DarkGray
    }
    Write-Host ''
    Write-Host 'MISSION' -ForegroundColor Cyan
    Write-Host $Lesson.task
    Write-Host ''
    Write-Host 'Type any PowerShell approach. Use :hint, :check, :reset, :next, :previous, or :go.' -ForegroundColor DarkGray
    Write-Host ''
}

function Show-SessionHelp {
    $text = @'
:hint          show the next hint, then the reference approach
:example       show the example again
:lesson        redraw the lesson
:files         list the disposable workspace
:reset         restore the lesson fixture
:check         grade current workspace and last output again
:next          move to the next rep
:previous      move to the previous rep
:go TARGET     jump by number, command, or lesson ID
:status        show XP and completion
:quit          leave the gym
'@
    Write-Host $text
}

function Show-Status {
    $completed = $script:Progress.completed.PSObject.Properties.Count
    $xp = Get-TotalXp
    $level = [Math]::Floor($xp / 500) + 1
    Write-Host "PowerShell progress: $completed/$script:TotalLessons reps | XP $xp | level $level"
}

function Start-LessonSession($InitialLesson) {
    $lesson = $InitialLesson
    while ($null -ne $lesson) {
        $attempts = 0
        $hintsUsed = 0
        $hintIndex = 0
        $completedHere = $false
        Reset-Workspace $lesson
        Show-Lesson $lesson
        if (Test-Completed $lesson.id) { Write-Host 'Already completed; your best score will be retained.' -ForegroundColor DarkGray }

        while ($true) {
            $shownPath = (Get-Location).Path
            if ($shownPath.StartsWith($script:Workspace, [StringComparison]::OrdinalIgnoreCase)) {
                $shownPath = '~' + $shownPath.Substring($script:Workspace.Length)
            }
            $command = Read-Host ("gym[{0}] {1}>" -f $lesson.order,$shownPath)
            if ([string]::IsNullOrWhiteSpace($command)) { continue }

            if ($command -eq ':hint') {
                $hints = @($lesson.hints)
                if ($hintIndex -lt $hints.Count) {
                    Write-Host "Hint $($hintIndex + 1): $($hints[$hintIndex])" -ForegroundColor Yellow
                    $hintIndex++; $hintsUsed++
                }
                elseif ($hintIndex -eq $hints.Count) {
                    Write-Host "Reference approach: $($lesson.solution)" -ForegroundColor Yellow
                    $hintIndex++; $hintsUsed++
                }
                else { Write-Host 'All hints have been shown.' }
                continue
            }
            if ($command -eq ':example') { Write-Host $lesson.example; continue }
            if ($command -eq ':lesson') { Show-Lesson $lesson; continue }
            if ($command -eq ':files') { Get-ChildItem $script:Workspace -Recurse -Force | Select-Object FullName,Length; continue }
            if ($command -eq ':help') { Show-SessionHelp; continue }
            if ($command -eq ':status') { Show-Status; continue }
            if ($command -eq ':reset') { Reset-Workspace $lesson; Write-Host 'Workspace restored.'; continue }
            if ($command -eq ':check') {
                Write-Host 'CHECK' -ForegroundColor Cyan
                $passed = Test-Checks $lesson -Show
                if ($passed -and -not $completedHere) {
                    $gained = Complete-Lesson $lesson $attempts $hintsUsed
                    $completedHere = $true
                    Write-Host "REP COMPLETE | +$gained XP" -ForegroundColor Green
                }
                continue
            }
            if ($command -eq ':next') {
                $lesson = Get-NextLesson $lesson
                break
            }
            if ($command -eq ':previous' -or $command -eq ':prev') {
                $previous = Get-PreviousLesson $lesson
                if ($null -eq $previous) { Write-Host 'This is PowerShell rep 001; there is no previous rep.' }
                else { $lesson = $previous; break }
                continue
            }
            if ($command -eq ':go') { Write-Host 'Usage: :go <number|command|lesson-id>'; continue }
            if ($command.StartsWith(':go ')) {
                $target = Get-Lesson $command.Substring(4).Trim()
                if ($null -eq $target) { Write-Host 'Unknown rep target.' -ForegroundColor Yellow }
                else { $lesson = $target; break }
                continue
            }
            if ($command -eq ':quit' -or $command -eq ':q') { return }
            if ($command.StartsWith(':')) { Write-Host 'Unknown gym control. Use :help.'; continue }

            $attempts++
            Invoke-GymCommand $command
            Write-Host 'CHECK' -ForegroundColor Cyan
            $passed = Test-Checks $lesson -Show
            if ($passed) {
                if (-not $completedHere) {
                    $gained = Complete-Lesson $lesson $attempts $hintsUsed
                    $completedHere = $true
                    Write-Host "REP COMPLETE | +$gained XP" -ForegroundColor Green
                }
                $next = Get-NextLesson $lesson
                if ($null -ne $next) { Write-Host "Use :next for rep $($next.order), or :go to jump elsewhere." -ForegroundColor DarkGray }
            }
            else { Write-Host 'Any valid approach can pass. Keep working or use :hint.' -ForegroundColor DarkGray }
        }
    }
}

function Test-Catalog {
    if ([int]$script:Catalog.catalog_version -ne 2) { return $false }
    if ($script:Catalog.track -ne 'powershell' -or $script:Catalog.platform -ne 'windows' -or $script:Catalog.shell -ne 'powershell') { return $false }
    if ($script:TotalLessons -ne 500 -or $script:CommandCount -ne 100 -or $script:StagesPerCommand -ne 5) { return $false }
    if (@($script:Lessons.id | Sort-Object -Unique).Count -ne 500) { return $false }
    if (@($script:Lessons.task | Sort-Object -Unique).Count -ne 500) { return $false }
    if (@($script:Lessons.command | Sort-Object -Unique).Count -ne 100) { return $false }
    foreach ($group in $script:Lessons | Group-Object command) {
        if ($group.Count -ne 5) { return $false }
        if ((@($group.Group.stage | Sort-Object) -join ',') -ne '1,2,3,4,5') { return $false }
        if (@($group.Group.solution | Sort-Object -Unique).Count -ne 5) { return $false }
    }
    return $true
}

function Test-Navigation {
    $first = Get-Lesson '1'
    $byCommand = Get-Lesson 'Get-Help'
    $last = Get-Lesson 'powershell-get-timezone-5'
    return $first.id -eq 'powershell-get-help' -and $byCommand.command -eq 'Get-Help' -and $last.order -eq 500 -and $null -eq (Get-PreviousLesson $first) -and $null -eq (Get-NextLesson $last)
}

function Test-ReferenceSolutions {
    Write-Host -NoNewline 'Checking PowerShell curriculum structure... '
    if (-not (Test-Catalog)) { Write-Host 'FAIL' -ForegroundColor Red; return $false }
    Write-Host 'PASS' -ForegroundColor Green
    Write-Host -NoNewline 'Checking lesson navigation... '
    if (-not (Test-Navigation)) { Write-Host 'FAIL' -ForegroundColor Red; return $false }
    Write-Host 'PASS' -ForegroundColor Green

    $failures = 0
    Write-Host "Running all $script:TotalLessons PowerShell reference approaches..."
    foreach ($lesson in $script:Lessons) {
        try {
            Reset-Workspace $lesson
            Invoke-GymCommand ([string]$lesson.solution) -Quiet
            $passed = Test-Checks $lesson
        }
        catch {
            $passed = $false
            $script:LastOutput = $_.ToString()
            $script:LastExitCode = 1
        }
        if ($passed) {
            Write-Host ("  PASS {0:D3} {1}" -f [int]$lesson.order,$lesson.command) -ForegroundColor Green
        }
        else {
            $failures++
            Write-Host ("  FAIL {0:D3} {1}" -f [int]$lesson.order,$lesson.command) -ForegroundColor Red
            Write-Host "       solution: $($lesson.solution)"
            Write-Host "       output: $script:LastOutput"
            Write-Host "       exit: $script:LastExitCode"
        }
    }
    if ($failures -gt 0) {
        Write-Host "$failures reference approach(es) failed." -ForegroundColor Red
        return $false
    }
    Write-Host "All $script:TotalLessons PowerShell reference approaches passed." -ForegroundColor Green
    return $true
}

function Show-List {
    foreach ($lesson in $script:Lessons) {
        $mark = if (Test-Completed $lesson.id) { 'x' } else { ' ' }
        Write-Output ("[{0}] {1:D3} command {2:D3} stage {3}/5 {4,-28} {5}" -f $mark,[int]$lesson.order,[int]$lesson.command_order,[int]$lesson.stage,$lesson.command,$lesson.title)
    }
}

function Show-Help {
    $text = @"
Hacker CLI Gym — 500 outcome-graded PowerShell exercises on Windows

Usage:
  .\gym.ps1 start                 start the next unfinished rep
  .\gym.ps1 run Get-ChildItem     run by command, number, or lesson ID
  .\gym.ps1 list                  list all 500 PowerShell reps
  .\gym.ps1 status                show progress, XP, and level
  .\gym.ps1 test                  execute all reference approaches
  .\gym.ps1 help                  show this help
"@
    Write-Host $text
}

Initialize-State

switch ($Action.ToLowerInvariant()) {
    'start' {
        $lesson = Get-NextIncomplete
        if ($null -eq $lesson) { Write-Host 'All 500 PowerShell reps are complete.'; Show-Status }
        else { Start-LessonSession $lesson }
    }
    'daily' {
        $lesson = Get-NextIncomplete
        if ($null -eq $lesson) { Write-Host 'All 500 PowerShell reps are complete.'; Show-Status }
        else { Start-LessonSession $lesson }
    }
    'run' {
        if ([string]::IsNullOrWhiteSpace($Selector)) { throw 'Usage: .\gym.ps1 run <number|command|lesson-id>' }
        $lesson = Get-Lesson $Selector
        if ($null -eq $lesson) { throw "Unknown rep '$Selector'." }
        Start-LessonSession $lesson
    }
    'list' { Show-List }
    'status' { Show-Status }
    'test' { if (-not (Test-ReferenceSolutions)) { exit 1 } }
    'help' { Show-Help }
    '-h' { Show-Help }
    '--help' { Show-Help }
    default { throw "Unknown action '$Action'. Use .\gym.ps1 help." }
}
