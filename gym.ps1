[CmdletBinding(PositionalBinding = $false)]
param(
    [Parameter(Position = 0)]
    [string]$Action = 'start',

    [Parameter(Position = 1)]
    [string]$Selector,

    [Parameter(Position = 2)]
    [string]$Path,

    [string]$Section,
    [Alias('Command')]
    [string]$CommandName,
    [switch]$Unfinished,
    [switch]$Due
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

$script:GymVersion = '2.0.0'
$script:ProgressSchemaVersion = 3
$script:Root = $PSScriptRoot
$script:CatalogPath = Join-Path $script:Root 'curriculum\powershell.json'
$defaultStateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'HackerCliGym'
$script:StateRoot = if ([string]::IsNullOrWhiteSpace($env:HACKER_CLI_GYM_STATE_ROOT)) { $defaultStateRoot } else { [IO.Path]::GetFullPath($env:HACKER_CLI_GYM_STATE_ROOT) }
$script:Workspace = Join-Path $script:StateRoot 'hacker-cli-gym-workspace'
$script:ProgressPath = Join-Path $script:StateRoot 'powershell-progress.json'
$script:OriginalLocation = (Get-Location).Path
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:LastOutput = ''
$script:LastError = ''
$script:LastExitCode = 0
$script:LastCommandExecuted = $false
$script:Nonce = ''
$script:LearnerRunspace = $null
$script:ReviewMode = $false
$script:UseColor = [string]::IsNullOrEmpty($env:NO_COLOR)

if (-not (Test-Path $script:CatalogPath -PathType Leaf)) {
    throw "PowerShell curriculum not found at $script:CatalogPath"
}

$script:Catalog = [IO.File]::ReadAllText($script:CatalogPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$script:Lessons = @($script:Catalog.lessons | Sort-Object order)
$script:TotalLessons = $script:Lessons.Count
$script:CommandCount = [int]$script:Catalog.command_count
$script:StagesPerCommand = [int]$script:Catalog.stages_per_command

function Write-Gym {
    param(
        [AllowEmptyString()]
        [string]$Text = '',
        [Nullable[ConsoleColor]]$Color,
        [switch]$NoNewline
    )
    $arguments = @{}
    if ($NoNewline) { $arguments.NoNewline = $true }
    if ($script:UseColor -and $null -ne $Color) { $arguments.ForegroundColor = [ConsoleColor]$Color }
    Write-Host $Text @arguments
}

function Add-ObjectProperty($Object, [string]$Name, $Value) {
    if ($null -eq $Object.PSObject.Properties[$Name]) {
        $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value
    }
}

function New-ProgressDocument {
    return [pscustomobject]@{
        schema_version = $script:ProgressSchemaVersion
        track = 'powershell'
        completed = [pscustomobject]@{}
        activity = @()
        settings = [pscustomobject]@{ daily_goal = 3 }
    }
}

function Test-ProgressDocument($Document) {
    if ($null -eq $Document) { return $false }
    if ($Document -isnot [pscustomobject]) { return $false }
    $track = $Document.PSObject.Properties['track']
    if ($null -ne $track -and $track.Value -ne 'powershell') { return $false }
    $schema = $Document.PSObject.Properties['schema_version']
    if ($null -ne $schema) {
        $schemaNumber = 0
        if (-not [int]::TryParse([string]$schema.Value, [ref]$schemaNumber) -or $schemaNumber -lt 1 -or $schemaNumber -gt $script:ProgressSchemaVersion) { return $false }
    }
    if ($null -eq $Document.PSObject.Properties['completed']) { return $false }
    if ($null -eq $Document.completed -or $Document.completed -isnot [pscustomobject]) { return $false }
    foreach ($record in @($Document.completed.PSObject.Properties)) {
        if ($null -eq $record.Value -or $record.Value -isnot [pscustomobject]) { return $false }
        foreach ($name in @('points','attempts','hints_used','mastery_level','interval_days','review_count','lapses')) {
            $value = $record.Value.PSObject.Properties[$name]
            if ($null -ne $value) {
                $number = 0
                if (-not [int]::TryParse([string]$value.Value, [ref]$number) -or $number -lt 0) { return $false }
            }
        }
        foreach ($name in @('assisted','ever_assisted','target_command_observed')) {
            $value = $record.Value.PSObject.Properties[$name]
            if ($null -ne $value -and $value.Value -isnot [bool]) { return $false }
        }
        $status = $record.Value.PSObject.Properties['status']
        if ($null -ne $status -and [string]$status.Value -notin @('introduced','mastered')) { return $false }
        $due = $record.Value.PSObject.Properties['review_due']
        if ($null -ne $due) {
            $parsedDue = [datetime]::MinValue
            if (-not [datetime]::TryParseExact([string]$due.Value, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$parsedDue)) { return $false }
        }
    }
    $activity = $Document.PSObject.Properties['activity']
    if ($null -ne $activity -and $null -ne $activity.Value) {
        if ($activity.Value -isnot [Array] -and $activity.Value -isnot [Collections.IList]) { return $false }
        foreach ($entry in @($activity.Value)) {
            $dateProperty = $entry.PSObject.Properties['date']
            if ($null -eq $dateProperty -or [string]$dateProperty.Value -notmatch '^\d{4}-\d{2}-\d{2}$') { return $false }
            $parsedDate = [datetime]::MinValue
            if (-not [datetime]::TryParseExact([string]$dateProperty.Value, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$parsedDate)) { return $false }
        }
    }
    $settings = $Document.PSObject.Properties['settings']
    if ($null -ne $settings -and $null -ne $settings.Value) {
        if ($settings.Value -isnot [pscustomobject]) { return $false }
        $goalProperty = $settings.Value.PSObject.Properties['daily_goal']
        if ($null -ne $goalProperty) {
            $goal = 0
            if (-not [int]::TryParse([string]$goalProperty.Value, [ref]$goal) -or $goal -lt 1 -or $goal -gt 10) { return $false }
        }
    }
    return $true
}

function Write-JsonAtomic($Document, [string]$Destination, [switch]$KeepBackup) {
    $directory = Split-Path $Destination -Parent
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $destinationItem = Get-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
    if ($null -ne $destinationItem) {
        $destinationAttributes = [IO.File]::GetAttributes($Destination)
        if (($destinationAttributes -band [IO.FileAttributes]::Directory) -ne 0 -or ($destinationAttributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing to replace a directory or reparse point with JSON: $Destination"
        }
    }
    $temporary = Join-Path $directory (([IO.Path]::GetFileName($Destination)) + '.tmp-' + [Guid]::NewGuid().ToString('N'))
    $backup = $Destination + '.bak'
    try {
        [IO.File]::WriteAllText($temporary, ($Document | ConvertTo-Json -Depth 16), $script:Utf8NoBom)
        if (Test-Path $Destination -PathType Leaf) {
            if (Test-Path $backup -PathType Leaf) { Remove-Item $backup -Force }
            try {
                [IO.File]::Replace($temporary, $Destination, $backup, $true)
            }
            catch {
                if ($KeepBackup) { Copy-Item $Destination $backup -Force }
                Move-Item $temporary $Destination -Force
            }
            if (-not $KeepBackup -and (Test-Path $backup -PathType Leaf)) {
                Remove-Item $backup -Force
            }
        }
        else {
            Move-Item $temporary $Destination -Force
        }
    }
    finally {
        if (Test-Path $temporary -PathType Leaf) { Remove-Item $temporary -Force }
    }
}

function Save-Progress {
    Ensure-SafeStateRoot
    $progressItem = Get-Item -LiteralPath $script:ProgressPath -Force -ErrorAction SilentlyContinue
    if ($null -ne $progressItem) {
        $attributes = [IO.File]::GetAttributes($script:ProgressPath)
        if (($attributes -band [IO.FileAttributes]::Directory) -ne 0 -or ($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            Remove-WorkspaceEntrySafely $script:ProgressPath
        }
    }
    Write-JsonAtomic $script:Progress $script:ProgressPath -KeepBackup
}

function Get-CompletionProperty([string]$Id) {
    return $script:Progress.completed.PSObject.Properties[$Id]
}

function Test-Completed([string]$Id) {
    return $null -ne (Get-CompletionProperty $Id)
}

function Get-RecordValue($Record, [string]$Name, $Default) {
    if ($null -eq $Record) { return $Default }
    $property = $Record.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) { return $Default }
    return $property.Value
}

function Initialize-CompletionRecord($Record, [string]$Today) {
    $hints = [int](Get-RecordValue $Record 'hints_used' (Get-RecordValue $Record 'hints' 0))
    Add-ObjectProperty $Record 'hints_used' $hints
    Add-ObjectProperty $Record 'status' $(if ($hints -gt 0) { 'introduced' } else { 'mastered' })
    Add-ObjectProperty $Record 'assisted' ($hints -gt 0)
    Add-ObjectProperty $Record 'ever_assisted' ($hints -gt 0)
    Add-ObjectProperty $Record 'mastery_level' $(if ($hints -gt 0) { 1 } else { 2 })
    Add-ObjectProperty $Record 'interval_days' $(if ($hints -gt 0) { 1 } else { 3 })
    Add-ObjectProperty $Record 'review_due' $Today
    Add-ObjectProperty $Record 'review_count' 0
    Add-ObjectProperty $Record 'lapses' 0
    Add-ObjectProperty $Record 'target_command_observed' $false
    Add-ObjectProperty $Record 'completed_at' (Get-Date).ToString('o')
    Add-ObjectProperty $Record 'last_completed_at' ([string](Get-RecordValue $Record 'completed_at' (Get-Date).ToString('o')))
}

function Migrate-Progress {
    $today = (Get-Date).ToString('yyyy-MM-dd')
    Add-ObjectProperty $script:Progress 'schema_version' $script:ProgressSchemaVersion
    $script:Progress.schema_version = $script:ProgressSchemaVersion
    Add-ObjectProperty $script:Progress 'track' 'powershell'
    Add-ObjectProperty $script:Progress 'completed' ([pscustomobject]@{})
    Add-ObjectProperty $script:Progress 'activity' @()
    if ($null -eq $script:Progress.activity) { $script:Progress.activity = @() }
    Add-ObjectProperty $script:Progress 'settings' ([pscustomobject]@{ daily_goal = 3 })
    if ($null -eq $script:Progress.settings) { $script:Progress.settings = [pscustomobject]@{} }
    Add-ObjectProperty $script:Progress.settings 'daily_goal' 3

    foreach ($property in @($script:Progress.completed.PSObject.Properties)) {
        Initialize-CompletionRecord $property.Value $today
    }

    foreach ($lesson in $script:Lessons) {
        $legacyProperty = $lesson.PSObject.Properties['legacy_ids']
        if ($null -eq $legacyProperty -or $null -eq $legacyProperty.Value) { continue }
        if (-not (Test-Completed $lesson.id)) {
            foreach ($legacyId in @($legacyProperty.Value)) {
                $old = Get-CompletionProperty ([string]$legacyId)
                if ($null -eq $old) { continue }
                $copy = $old.Value | ConvertTo-Json -Depth 16 | ConvertFrom-Json
                Initialize-CompletionRecord $copy $today
                $copy.status = 'introduced'
                $copy.assisted = $true
                $copy.ever_assisted = $true
                $copy.mastery_level = 1
                $copy.interval_days = 1
                $copy.review_due = $today
                Add-ObjectProperty $copy 'migrated_from' ([string]$legacyId)
                $script:Progress.completed | Add-Member -MemberType NoteProperty -Name $lesson.id -Value $copy -Force
                break
            }
        }
        foreach ($legacyId in @($legacyProperty.Value)) {
            $script:Progress.completed.PSObject.Properties.Remove([string]$legacyId)
        }
    }
}

function Initialize-State {
    Ensure-SafeStateRoot
    New-Item -ItemType Directory -Path $script:Workspace -Force | Out-Null
    $existingProgress = Get-Item -LiteralPath $script:ProgressPath -Force -ErrorAction SilentlyContinue
    if ($null -ne $existingProgress) {
        $attributes = [IO.File]::GetAttributes($script:ProgressPath)
        $isUnsafeType = ($attributes -band [IO.FileAttributes]::Directory) -ne 0 -or ($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
        $isOversized = -not $isUnsafeType -and $existingProgress.Length -gt 16MB
        if ($isUnsafeType -or $isOversized) {
            if ($isOversized) {
                $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
                $preserved = Join-Path $script:StateRoot "powershell-progress.corrupt-$stamp.json"
                Move-Item -LiteralPath $script:ProgressPath -Destination $preserved
                Write-Gym "Warning: oversized progress was preserved at $preserved; a clean record was created." Yellow
            }
            else {
                $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
                $preserved = Join-Path $script:StateRoot "powershell-progress.corrupt-special-$stamp"
                Move-Item -LiteralPath $script:ProgressPath -Destination $preserved
                Write-Gym "Warning: an unsafe directory or reparse point was preserved at $preserved; a clean record was created." Yellow
            }
            $script:Progress = New-ProgressDocument
            Save-Progress
            return
        }
    }
    if (-not (Test-Path $script:ProgressPath -PathType Leaf)) {
        $script:Progress = New-ProgressDocument
        Save-Progress
        return
    }

    try {
        $candidate = [IO.File]::ReadAllText($script:ProgressPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
        if (-not (Test-ProgressDocument $candidate)) { throw 'Progress has an unsupported shape.' }
        $script:Progress = $candidate
        Migrate-Progress
        Save-Progress
    }
    catch {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $preserved = Join-Path $script:StateRoot "powershell-progress.corrupt-$stamp.json"
        Copy-Item $script:ProgressPath $preserved -Force
        $script:Progress = New-ProgressDocument
        Save-Progress
        Write-Gym "Warning: invalid progress was preserved at $preserved; a clean record was created." Yellow
    }
}

function Get-CompletedCount {
    $count = 0
    foreach ($lesson in $script:Lessons) {
        if (Test-Completed $lesson.id) { $count++ }
    }
    return $count
}

function Get-TotalXp {
    $sum = 0
    foreach ($lesson in $script:Lessons) {
        $property = Get-CompletionProperty $lesson.id
        if ($null -ne $property) { $sum += [int](Get-RecordValue $property.Value 'points' 0) }
    }
    return $sum
}

function Get-Rank([int]$Level) {
    if ($Level -ge 20) { return 'Shellsmith' }
    if ($Level -ge 15) { return 'Administrator' }
    if ($Level -ge 10) { return 'Operator' }
    if ($Level -ge 5) { return 'Navigator' }
    return 'Rookie'
}

function Get-StreakDays {
    $dates = @($script:Progress.activity | ForEach-Object { [string]$_.date } | Where-Object { $_ } | Sort-Object -Unique -Descending)
    if ($dates.Count -eq 0) { return 0 }
    $today = (Get-Date).Date
    $latest = [datetime]::ParseExact($dates[0], 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
    if (($today - $latest.Date).Days -gt 1) { return 0 }
    $streak = 0
    $expected = $latest.Date
    foreach ($text in $dates) {
        $date = [datetime]::ParseExact($text, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
        if ($date.Date -ne $expected) { break }
        $streak++
        $expected = $expected.AddDays(-1)
    }
    return $streak
}

function Get-LessonScore($Lesson, [int]$Attempts, [int]$Hints) {
    $base = 100
    if ([string]$Lesson.difficulty -eq 'intermediate') { $base = 140 }
    elseif ([string]$Lesson.difficulty -eq 'advanced') { $base = 180 }
    $score = $base - (10 * [Math]::Max(0, $Attempts - 1)) - (15 * $Hints)
    return [Math]::Max(25, $score)
}

function Complete-Lesson($Lesson, [int]$Attempts, [int]$Hints, [bool]$SolutionShown, [bool]$TargetObserved) {
    $score = Get-LessonScore $Lesson $Attempts $Hints
    $existing = Get-CompletionProperty $Lesson.id
    $oldScore = 0
    $wasCompleted = $null -ne $existing
    if ($wasCompleted) { $oldScore = [int](Get-RecordValue $existing.Value 'points' 0) }
    $best = [Math]::Max($oldScore, $score)
    $assisted = $Hints -gt 0 -or $SolutionShown
    $now = Get-Date
    $today = $now.ToString('yyyy-MM-dd')
    $priorInterval = 1
    $lapses = 0
    $reviews = 0
    $everAssisted = $assisted
    $priorObserved = $false
    if ($wasCompleted) {
        $priorInterval = [int](Get-RecordValue $existing.Value 'interval_days' 1)
        $lapses = [int](Get-RecordValue $existing.Value 'lapses' 0)
        $reviews = [int](Get-RecordValue $existing.Value 'review_count' 0) + 1
        $everAssisted = [bool](Get-RecordValue $existing.Value 'ever_assisted' $false) -or $assisted
        $priorObserved = [bool](Get-RecordValue $existing.Value 'target_command_observed' $false)
    }

    if ($assisted) {
        $status = 'introduced'
        $mastery = 1
        $interval = 1
    }
    else {
        $status = 'mastered'
        $mastery = 2
        if ($wasCompleted) { $interval = [Math]::Min(30, [Math]::Max(1, $priorInterval * 2)) }
        else { $interval = 3 }
        if ($Attempts -gt 1) {
            $lapses++
            $interval = 1
        }
    }

    $completedAt = if ($wasCompleted) { [string](Get-RecordValue $existing.Value 'completed_at' $now.ToString('o')) } else { $now.ToString('o') }
    $record = [pscustomobject]@{
        completed_at = $completedAt
        last_completed_at = $now.ToString('o')
        attempts = $Attempts
        hints_used = $Hints
        points = $best
        status = $status
        assisted = $assisted
        ever_assisted = $everAssisted
        mastery_level = $mastery
        interval_days = $interval
        review_due = $now.Date.AddDays($interval).ToString('yyyy-MM-dd')
        review_count = $reviews
        lapses = $lapses
        target_command_observed = ($priorObserved -or $TargetObserved)
    }
    $script:Progress.completed | Add-Member -MemberType NoteProperty -Name $Lesson.id -Value $record -Force
    $activity = @($script:Progress.activity) + @([pscustomobject]@{
        lesson_id = [string]$Lesson.id
        date = $today
        completed_at = $now.ToString('o')
        assisted = $assisted
        status = $status
    })
    if ($activity.Count -gt 1000) { $activity = @($activity | Select-Object -Last 1000) }
    $script:Progress.activity = $activity
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
    $matches = @($script:Lessons | Where-Object { $_.command -ieq $Target } | Sort-Object stage)
    if ($matches.Count -gt 0) {
        foreach ($match in $matches) {
            if (-not (Test-Completed $match.id)) { return $match }
        }
        return $matches[0]
    }
    return $null
}

function Get-TargetSuggestions([string]$Target) {
    $needle = $Target.ToLowerInvariant()
    $matches = @($script:Lessons | Where-Object {
        ([string]$_.id).ToLowerInvariant().Contains($needle) -or
        ([string]$_.command).ToLowerInvariant().Contains($needle) -or
        ([string]$_.title).ToLowerInvariant().Contains($needle)
    } | Select-Object -First 5)
    if ($matches.Count -eq 0) {
        $prefix = if ($needle.Length -gt 2) { $needle.Substring(0, 3) } else { $needle }
        $matches = @($script:Lessons | Where-Object { ([string]$_.command).ToLowerInvariant().StartsWith($prefix) } | Select-Object -First 5)
    }
    return @($matches | ForEach-Object { "{0} ({1})" -f $_.command,$_.id } | Sort-Object -Unique)
}

function Write-UnknownTarget([string]$Target) {
    Write-Gym "Unknown rep target '$Target'." Yellow
    $suggestions = @(Get-TargetSuggestions $Target)
    if ($suggestions.Count -gt 0) { Write-Gym ('Try: ' + ($suggestions -join ', ')) DarkGray }
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

function Resolve-TemplateText([string]$Text) {
    if ($null -eq $Text) { return '' }
    return $Text.Replace('{{workspace}}', $script:Workspace).Replace('{{nonce}}', $script:Nonce)
}

function Close-LearnerSession {
    if ($null -ne $script:LearnerRunspace) {
        try { $script:LearnerRunspace.Close() } catch {}
        try { $script:LearnerRunspace.Dispose() } catch {}
        $script:LearnerRunspace = $null
    }
}

function Invoke-RunspaceRaw([string]$Code) {
    $powerShell = [PowerShell]::Create()
    try {
        $powerShell.Runspace = $script:LearnerRunspace
        [void]$powerShell.AddScript($Code)
        return @($powerShell.Invoke())
    }
    finally {
        $powerShell.Dispose()
    }
}

function New-LearnerSession {
    Close-LearnerSession
    # Reuse the real console host while keeping learner session state isolated
    # from this controller. This preserves Get-Host/RawUI behavior on Windows
    # PowerShell 5.1 without dot-sourcing learner code into the gym.
    $script:LearnerRunspace = [RunspaceFactory]::CreateRunspace($Host)
    $script:LearnerRunspace.Open()
    $quotedPath = $script:Workspace.Replace("'", "''")
    [void](Invoke-RunspaceRaw "Microsoft.PowerShell.Management\Set-Location -LiteralPath '$quotedPath'")
}

function Reset-LastResult {
    $script:LastOutput = ''
    $script:LastError = ''
    $script:LastExitCode = 0
    $script:LastCommandExecuted = $false
}

function Remove-WorkspaceEntrySafely([string]$EntryPath) {
    # Never recurse through a junction or symbolic link. A learner can create
    # reparse points in the real workspace, and Windows PowerShell 5.1's
    # Remove-Item -Recurse may otherwise traverse and delete the link target.
    $attributes = [IO.File]::GetAttributes($EntryPath)
    $isDirectory = ($attributes -band [IO.FileAttributes]::Directory) -ne 0
    $isReparsePoint = ($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0

    if ($isReparsePoint) {
        if ($isDirectory) { [IO.Directory]::Delete($EntryPath) }
        else { [IO.File]::Delete($EntryPath) }
        return
    }

    if ($isDirectory) {
        foreach ($child in [IO.Directory]::GetFileSystemEntries($EntryPath)) {
            Remove-WorkspaceEntrySafely $child
        }
        if (($attributes -band [IO.FileAttributes]::ReadOnly) -ne 0) {
            [IO.File]::SetAttributes($EntryPath, ($attributes -band (-bnot [IO.FileAttributes]::ReadOnly)))
        }
        [IO.Directory]::Delete($EntryPath)
        return
    }

    if (($attributes -band [IO.FileAttributes]::ReadOnly) -ne 0) {
        [IO.File]::SetAttributes($EntryPath, ($attributes -band (-bnot [IO.FileAttributes]::ReadOnly)))
    }
    [IO.File]::Delete($EntryPath)
}

function Ensure-SafeStateRoot {
    $stateItem = Get-Item -LiteralPath $script:StateRoot -Force -ErrorAction SilentlyContinue
    if ($null -ne $stateItem) {
        $attributes = [IO.File]::GetAttributes($script:StateRoot)
        $isDirectory = ($attributes -band [IO.FileAttributes]::Directory) -ne 0
        $isReparsePoint = ($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
        if (-not $isDirectory -or $isReparsePoint) {
            Remove-WorkspaceEntrySafely $script:StateRoot
        }
    }
    New-Item -ItemType Directory -Path $script:StateRoot -Force | Out-Null
}

function Get-StateEntrySignature([string]$EntryPath) {
    $item = Get-Item -LiteralPath $EntryPath -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) { return 'missing' }
    $attributes = [IO.File]::GetAttributes($EntryPath)
    if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        return "reparse:$([int]$attributes):$($item.LastWriteTimeUtc.Ticks)"
    }
    if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) {
        return "directory:$([int]$attributes):$($item.LastWriteTimeUtc.Ticks)"
    }
    return "file:$([int]$attributes):$($item.Length):$($item.LastWriteTimeUtc.Ticks)"
}

function Restore-ProgressAfterLearnerCommand {
    Ensure-SafeStateRoot
    Save-Progress
}

function Clear-WorkspaceSafely {
    $workspaceItem = Get-Item -LiteralPath $script:Workspace -Force -ErrorAction SilentlyContinue
    if ($null -ne $workspaceItem) {
        $attributes = [IO.File]::GetAttributes($script:Workspace)
        $isDirectory = ($attributes -band [IO.FileAttributes]::Directory) -ne 0
        $isReparsePoint = ($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
        if (-not $isDirectory -or $isReparsePoint) {
            Remove-WorkspaceEntrySafely $script:Workspace
        }
        else {
            foreach ($child in [IO.Directory]::GetFileSystemEntries($script:Workspace)) {
                Remove-WorkspaceEntrySafely $child
            }
        }
    }
    New-Item -ItemType Directory -Path $script:Workspace -Force | Out-Null
}

function Reset-Workspace($Lesson) {
    Close-LearnerSession
    Ensure-SafeStateRoot
    Microsoft.PowerShell.Management\Set-Location $script:StateRoot
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    Clear-WorkspaceSafely
    $script:Nonce = [Guid]::NewGuid().ToString('N').Substring(0, 12)

    foreach ($directory in @($Lesson.directories)) {
        $path = Resolve-WorkspacePath (Resolve-TemplateText ([string]$directory))
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
    foreach ($property in $Lesson.files.PSObject.Properties) {
        $path = Resolve-WorkspacePath (Resolve-TemplateText $property.Name)
        $parent = Split-Path $path -Parent
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        [IO.File]::WriteAllText($path, (Resolve-TemplateText ([string]$property.Value)), $script:Utf8NoBom)
    }

    Microsoft.PowerShell.Management\Set-Location $script:Workspace
    foreach ($setupCommand in @($Lesson.setup)) {
        if ([string]::IsNullOrWhiteSpace([string]$setupCommand)) { continue }
        $setupBlock = [scriptblock]::Create((Resolve-TemplateText ([string]$setupCommand)))
        $setupResult = @(& $setupBlock *>&1)
        if (-not $?) {
            $detail = ($setupResult | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
            throw "Cannot prepare fixture for $($Lesson.id): $detail"
        }
    }
    New-LearnerSession
    Reset-LastResult
}

function Format-OutputObjects([object[]]$Items) {
    if ($null -eq $Items -or $Items.Count -eq 0) { return '' }
    try {
        $lines = @($Items | Out-String -Stream -Width 200)
        return ($lines -join [Environment]::NewLine).TrimEnd("`r", "`n")
    }
    catch {
        return (($Items | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).TrimEnd("`r", "`n")
    }
}

function Format-InformationStream([object[]]$Items) {
    if ($null -eq $Items -or $Items.Count -eq 0) { return '' }
    $builder = New-Object Text.StringBuilder
    foreach ($item in $Items) {
        [void]$builder.Append([string]$item.MessageData)
        $noNewline = $false
        if ($null -ne $item.MessageData) {
            $property = $item.MessageData.PSObject.Properties['NoNewLine']
            if ($null -ne $property) { $noNewline = [bool]$property.Value }
        }
        if (-not $noNewline) { [void]$builder.AppendLine() }
    }
    return $builder.ToString().TrimEnd("`r", "`n")
}

function Add-NonemptyText([Collections.Generic.List[string]]$List, [string]$Text) {
    if (-not [string]::IsNullOrWhiteSpace($Text)) { $List.Add($Text) }
}

function Invoke-GymCommand([string]$Command, [switch]$Quiet) {
    if ($null -eq $script:LearnerRunspace) { New-LearnerSession }
    Reset-LastResult
    $script:LastCommandExecuted = $true
    $progressSignature = Get-StateEntrySignature $script:ProgressPath
    $powerShell = [PowerShell]::Create()
    $normal = @()
    $errors = @()
    $warnings = @()
    $verbose = @()
    $debug = @()
    $information = @()
    try {
        $powerShell.Runspace = $script:LearnerRunspace
        [void]$powerShell.AddScript("`$global:LASTEXITCODE = 0`n" + $Command)
        $normal = @($powerShell.Invoke())
        $errors = @($powerShell.Streams.Error)
        $warnings = @($powerShell.Streams.Warning)
        $verbose = @($powerShell.Streams.Verbose)
        $debug = @($powerShell.Streams.Debug)
        $informationProperty = $powerShell.Streams.PSObject.Properties['Information']
        if ($null -ne $informationProperty) { $information = @($informationProperty.Value) }
    }
    catch {
        $errors += $_
    }
    finally {
        $powerShell.Dispose()
    }

    Ensure-SafeStateRoot
    $progressSignatureAfter = Get-StateEntrySignature $script:ProgressPath
    Restore-ProgressAfterLearnerCommand
    if ($progressSignatureAfter -cne $progressSignature -and -not $Quiet) {
        Write-Gym 'Controller protection: direct progress changes were discarded.' Yellow
    }

    $normalText = Format-OutputObjects $normal
    $informationText = Format-InformationStream $information
    $warningText = (@($warnings | ForEach-Object { $_.Message }) -join [Environment]::NewLine)
    $verboseText = (@($verbose | ForEach-Object { $_.Message }) -join [Environment]::NewLine)
    $debugText = (@($debug | ForEach-Object { $_.Message }) -join [Environment]::NewLine)
    $errorText = (@($errors | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine)
    $parts = New-Object 'Collections.Generic.List[string]'
    Add-NonemptyText -List $parts -Text $normalText
    Add-NonemptyText -List $parts -Text $informationText
    Add-NonemptyText -List $parts -Text $warningText
    Add-NonemptyText -List $parts -Text $verboseText
    Add-NonemptyText -List $parts -Text $debugText
    $script:LastOutput = ($parts -join [Environment]::NewLine).TrimEnd("`r", "`n")
    $script:LastError = $errorText.TrimEnd("`r", "`n")

    $exitResults = @(Invoke-RunspaceRaw '$global:LASTEXITCODE')
    $nativeExit = 0
    if ($exitResults.Count -gt 0 -and $null -ne $exitResults[0]) { $nativeExit = [int]$exitResults[0] }
    if ($nativeExit -ne 0) { $script:LastExitCode = $nativeExit }
    elseif ($errors.Count -gt 0) { $script:LastExitCode = 1 }
    else { $script:LastExitCode = 0 }

    if (-not $Quiet) {
        if (-not [string]::IsNullOrEmpty($normalText)) { Write-Gym $normalText }
        if (-not [string]::IsNullOrEmpty($informationText)) { Write-Gym $informationText }
        if (-not [string]::IsNullOrEmpty($warningText)) { Write-Gym $warningText Yellow }
        if (-not [string]::IsNullOrEmpty($verboseText)) { Write-Gym $verboseText DarkGray }
        if (-not [string]::IsNullOrEmpty($debugText)) { Write-Gym $debugText DarkGray }
        if (-not [string]::IsNullOrEmpty($script:LastError)) { Write-Gym $script:LastError Red }
        Write-Gym "[exit $($script:LastExitCode)]" DarkGray
    }
}

function Get-LearnerLocation {
    if ($null -eq $script:LearnerRunspace) { return $script:Workspace }
    $result = @(Invoke-RunspaceRaw '(Get-Location).Path')
    if ($result.Count -eq 0) { return $script:Workspace }
    return [string]$result[0]
}

function Normalize-Text([string]$Text, [string]$Mode = 'trim') {
    if ($null -eq $Text) { $Text = '' }
    $normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
    if ($Mode -eq 'exact') { return $normalized }
    return $normalized.Trim()
}

function Get-OutputLineCount([string]$Text) {
    $normalized = Normalize-Text $Text
    if ([string]::IsNullOrEmpty($normalized)) { return 0 }
    return @(($normalized -split "`n") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
}

function Get-FileText([string]$RelativePath) {
    $path = Resolve-WorkspacePath (Resolve-TemplateText $RelativePath)
    if (-not (Test-Path $path -PathType Leaf)) { return $null }
    return [IO.File]::ReadAllText($path)
}

function Get-Preview([string]$Text, [int]$Limit = 180) {
    if ($null -eq $Text) { return '<missing>' }
    $flat = (Normalize-Text $Text) -replace "`n", ' <newline> '
    if ($flat.Length -gt $Limit) { return $flat.Substring(0, $Limit) + '...' }
    if ($flat.Length -eq 0) { return '<empty>' }
    return $flat
}

function Get-CheckDiagnostic($Check, [string]$Type) {
    switch ($Type) {
        'stdout' { return "expected '$(Get-Preview (Resolve-TemplateText ([string]$Check.expected)))'; got '$(Get-Preview $script:LastOutput)'" }
        'stdout-unordered-lines' { return "expected the same unordered lines; got '$(Get-Preview $script:LastOutput)'" }
        'stdout-contains' { return "output is missing '$(Get-Preview (Resolve-TemplateText ([string]$Check.expected)))'" }
        'output-contains' { return "output is missing '$(Get-Preview (Resolve-TemplateText ([string]$Check.expected)))'" }
        'stderr-contains' { return "error output is missing '$(Get-Preview (Resolve-TemplateText ([string]$Check.expected)))'" }
        'stdout-not-contains' { return "output still includes '$(Get-Preview (Resolve-TemplateText ([string]$Check.expected)))'" }
        'stdout-regex' { return "output did not match /$(Resolve-TemplateText ([string]$Check.expected))/" }
        'stdout-nonempty' { return 'the success output stream was empty' }
        'stdout-line-count' { return "expected $($Check.expected) line(s); got $(Get-OutputLineCount $script:LastOutput)" }
        'exit-code' { return "expected exit $($Check.expected); got $script:LastExitCode" }
        'path-exists' { return "missing path '$($Check.path)'" }
        'path-not-exists' { return "path '$($Check.path)' still exists" }
        'file-content' { return "'$($Check.path)' content was '$(Get-Preview (Get-FileText ([string]$Check.path)))'" }
        'file-content-contains' { return "'$($Check.path)' is missing '$(Get-Preview ([string]$Check.expected))'" }
        'file-equals' { return "'$($Check.path)' and '$($Check.other_path)' differ" }
        default { return 'the requested outcome is not present yet' }
    }
}

function Test-Checks($Lesson, [switch]$Show) {
    $passedAll = $true
    $requiresSuccess = $true
    $requiresProperty = $Lesson.PSObject.Properties['requires_success']
    if ($null -ne $requiresProperty) { $requiresSuccess = [bool]$requiresProperty.Value }
    foreach ($check in @($Lesson.checks)) {
        $passed = $false
        $type = [string]$check.type
        switch ($type) {
            'stdout' {
                $normalizeProperty = $check.PSObject.Properties['normalize']
                $mode = if ($null -ne $normalizeProperty) { [string]$normalizeProperty.Value } else { 'trim' }
                $passed = (Normalize-Text $script:LastOutput $mode) -eq (Normalize-Text (Resolve-TemplateText ([string]$check.expected)) $mode)
            }
            'stdout-unordered-lines' {
                $expected = Resolve-TemplateText ([string]$check.expected)
                $actualLines = @((Normalize-Text $script:LastOutput) -split "`n" | ForEach-Object { $_.Trim() } | Sort-Object)
                $expectedLines = @((Normalize-Text $expected) -split "`n" | ForEach-Object { $_.Trim() } | Sort-Object)
                $passed = ($actualLines -join "`n") -eq ($expectedLines -join "`n")
            }
            'stdout-contains' { $passed = $script:LastOutput.IndexOf((Resolve-TemplateText ([string]$check.expected)), [StringComparison]::OrdinalIgnoreCase) -ge 0 }
            'stdout-not-contains' { $passed = $script:LastOutput.IndexOf((Resolve-TemplateText ([string]$check.expected)), [StringComparison]::OrdinalIgnoreCase) -lt 0 }
            'output-contains' {
                $combined = $script:LastOutput + [Environment]::NewLine + $script:LastError
                $passed = $combined.IndexOf((Resolve-TemplateText ([string]$check.expected)), [StringComparison]::OrdinalIgnoreCase) -ge 0
            }
            'stderr-contains' { $passed = $script:LastError.IndexOf((Resolve-TemplateText ([string]$check.expected)), [StringComparison]::OrdinalIgnoreCase) -ge 0 }
            'stdout-regex' { $passed = $script:LastOutput -match (Resolve-TemplateText ([string]$check.expected)) }
            'stdout-nonempty' { $passed = -not [string]::IsNullOrWhiteSpace($script:LastOutput) }
            'stdout-line-count' { $passed = (Get-OutputLineCount $script:LastOutput) -eq [int]$check.expected }
            'exit-code' { $passed = $script:LastExitCode -eq [int]$check.expected }
            'path-exists' {
                $pathValue = Resolve-WorkspacePath (Resolve-TemplateText ([string]$check.path))
                $kindProperty = $check.PSObject.Properties['kind']
                $kind = if ($null -ne $kindProperty) { [string]$kindProperty.Value } else { 'any' }
                if ($kind -eq 'directory') { $passed = Test-Path $pathValue -PathType Container }
                elseif ($kind -eq 'file') { $passed = Test-Path $pathValue -PathType Leaf }
                else { $passed = Test-Path $pathValue }
            }
            'path-not-exists' { $passed = -not (Test-Path (Resolve-WorkspacePath (Resolve-TemplateText ([string]$check.path)))) }
            'file-content' {
                $actual = Get-FileText ([string]$check.path)
                $normalizeProperty = $check.PSObject.Properties['normalize']
                $mode = if ($null -ne $normalizeProperty) { [string]$normalizeProperty.Value } else { 'trim' }
                $passed = $null -ne $actual -and (Normalize-Text $actual $mode) -ceq (Normalize-Text (Resolve-TemplateText ([string]$check.expected)) $mode)
            }
            'file-content-contains' {
                $actual = Get-FileText ([string]$check.path)
                $passed = $null -ne $actual -and $actual.IndexOf((Resolve-TemplateText ([string]$check.expected)), [StringComparison]::OrdinalIgnoreCase) -ge 0
            }
            'file-equals' {
                $left = Resolve-WorkspacePath (Resolve-TemplateText ([string]$check.path))
                $right = Resolve-WorkspacePath (Resolve-TemplateText ([string]$check.other_path))
                $passed = (Test-Path $left -PathType Leaf) -and (Test-Path $right -PathType Leaf) -and ((Get-FileHash $left).Hash -eq (Get-FileHash $right).Hash)
            }
            default { throw "Unsupported check type '$type' in $($Lesson.id)" }
        }

        if ($type -like 'stdout*' -and -not [string]::IsNullOrEmpty($script:LastError)) { $passed = $false }
        if (-not $passed) { $passedAll = $false }
        if ($Show) {
            $marker = if ($passed) { 'PASS' } else { 'TRY ' }
            $color = if ($passed) { [ConsoleColor]::Green } else { [ConsoleColor]::Yellow }
            Write-Gym "[$marker] $($check.description)" $color
            if (-not $passed) { Write-Gym ('       ' + (Get-CheckDiagnostic $check $type)) DarkGray }
        }
    }
    if ($requiresSuccess -and $script:LastExitCode -ne 0) {
        $passedAll = $false
        if ($Show) { Write-Gym "[TRY ] Command must succeed; it exited $script:LastExitCode." Yellow }
    }
    return $passedAll
}

function Test-BlindLesson($Lesson) {
    $mode = $Lesson.PSObject.Properties['mode']
    return $script:ReviewMode -or ($null -ne $mode -and [string]$mode.Value -eq 'capstone')
}

function Show-Lesson($Lesson) {
    if ($env:HACKER_CLI_GYM_CLEAR -eq '1') { Clear-Host }
    $blind = Test-BlindLesson $Lesson
    Write-Gym 'HACKER CLI GYM' Cyan
    Write-Gym ("PowerShell rep {0:D3}/{1} | command {2:D3}/{3} | stage {4}/{5}: {6}" -f [int]$Lesson.order,$script:TotalLessons,[int]$Lesson.command_order,$script:CommandCount,[int]$Lesson.stage,$script:StagesPerCommand,$Lesson.stage_name)
    Write-Gym
    if ($blind) {
        Write-Gym "BLIND TRANSFER - $($Lesson.title)" White
        Write-Gym 'Choose the approach yourself; command and worked example are hidden.' DarkGray
    }
    else {
        Write-Gym "$($Lesson.command) - $($Lesson.title)" White
        Write-Gym (Resolve-TemplateText ([string]$Lesson.focus))
        $prerequisites = $Lesson.PSObject.Properties['prerequisites']
        if ($null -ne $prerequisites -and @($prerequisites.Value).Count -gt 0) {
            Write-Gym ('Prerequisites: ' + (@($prerequisites.Value) -join ', ')) DarkGray
        }
        $introduced = $Lesson.PSObject.Properties['introduced_inline']
        if ($null -ne $introduced -and @($introduced.Value).Count -gt 0) {
            Write-Gym ('Introduced here: ' + (@($introduced.Value) -join ', ')) DarkGray
        }
        Write-Gym
        Write-Gym 'EXAMPLE' Cyan
        Write-Gym (Resolve-TemplateText ([string]$Lesson.example))
        if (-not [string]::IsNullOrWhiteSpace([string]$Lesson.example_output)) {
            Write-Gym ('=> ' + (Resolve-TemplateText ([string]$Lesson.example_output))) DarkGray
        }
        foreach ($line in @($Lesson.breakdown)) { Write-Gym ('  - ' + (Resolve-TemplateText ([string]$line))) DarkGray }
    }
    Write-Gym
    Write-Gym 'MISSION' Cyan
    Write-Gym (Resolve-TemplateText ([string]$Lesson.task))
    Write-Gym
    Write-Gym 'Type any PowerShell approach. Use :help for controls; multiline input is supported.' DarkGray
    Write-Gym
}

function Show-SessionHelp {
    $text = @'
:hint          show the next hint, then the reference approach
:example       repeat the annotated example (hidden in blind review)
:lesson        redraw the lesson
:files         list the disposable workspace
:reset         restore the lesson fixture and session state
:check         grade current workspace and last output again
:shell         enter ungraded exploration; use :return to come back
:next          move to the next rep
:previous      move to the previous rep
:go TARGET     jump by number, command, or lesson ID
:status        show mastery, XP, streak, and section progress
:help          show these session controls
:quit          leave the gym
'@
    Write-Gym $text
}

function Show-Status {
    $completed = Get-CompletedCount
    $introduced = 0
    $mastered = 0
    $dueCount = 0
    $today = (Get-Date).ToString('yyyy-MM-dd')
    foreach ($lesson in $script:Lessons) {
        $property = Get-CompletionProperty $lesson.id
        if ($null -eq $property) { continue }
        if ([string](Get-RecordValue $property.Value 'status' 'mastered') -eq 'introduced') { $introduced++ } else { $mastered++ }
        if ([string](Get-RecordValue $property.Value 'review_due' $today) -le $today) { $dueCount++ }
    }
    $xp = Get-TotalXp
    $level = [Math]::Floor($xp / 500) + 1
    $rank = Get-Rank $level
    $streak = Get-StreakDays
    Write-Gym "PowerShell progress  $completed/$script:TotalLessons reps | $xp XP | Level $level $rank | $streak-day streak" White
    Write-Gym "  Mastered: $mastered | Introduced with help: $introduced | Reviews due: $dueCount"
    foreach ($group in @($script:Lessons | Group-Object section)) {
        $done = 0
        foreach ($lesson in $group.Group) { if (Test-Completed $lesson.id) { $done++ } }
        Write-Gym "  $($group.Name): $done/$($group.Count)"
    }
}

function Read-GymCommand([string]$Prompt) {
    $buffer = ''
    while ($true) {
        $line = Read-Host $(if ([string]::IsNullOrEmpty($buffer)) { $Prompt } else { '>>' })
        if ([string]::IsNullOrEmpty($buffer)) { $buffer = $line } else { $buffer += "`n" + $line }
        if ($buffer.StartsWith(':')) { return $buffer }
        $tokens = $null
        $parseErrors = $null
        [void][System.Management.Automation.Language.Parser]::ParseInput($buffer, [ref]$tokens, [ref]$parseErrors)
        $incomplete = @($parseErrors | Where-Object { $_.IncompleteInput }).Count -gt 0
        if (-not $incomplete) { return $buffer }
    }
}

function Test-TargetCommandInInput([string]$InputText, [string]$TargetCommand) {
    $tokens = $null
    $parseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseInput($InputText, [ref]$tokens, [ref]$parseErrors)
    foreach ($token in @($tokens)) {
        if ([string]$token.Text -ieq $TargetCommand) { return $true }
    }
    return $false
}

function Start-ExplorationShell {
    Write-Gym 'Exploration mode: commands share this lesson session and are not graded automatically. Type :return to resume.' Cyan
    while ($true) {
        $location = Get-LearnerLocation
        $command = Read-GymCommand ("shell $location>")
        if ($command -eq ':return' -or $command -eq ':exit') { return }
        if ($command -eq ':help') { Write-Gym 'Type any PowerShell command, or :return to resume the rep.'; continue }
        if ($command.StartsWith(':')) { Write-Gym 'Exploration controls are :return and :help.' Yellow; continue }
        Invoke-GymCommand $command
    }
}

function Get-DailyQueue([int]$Count) {
    $today = (Get-Date).ToString('yyyy-MM-dd')
    $dueLessons = New-Object Collections.ArrayList
    $newLessons = New-Object Collections.ArrayList
    $earlyLessons = New-Object Collections.ArrayList
    foreach ($lesson in $script:Lessons) {
        $property = Get-CompletionProperty $lesson.id
        if ($null -eq $property) { [void]$newLessons.Add($lesson); continue }
        $dueDate = [string](Get-RecordValue $property.Value 'review_due' $today)
        if ($dueDate -le $today) { [void]$dueLessons.Add($lesson) }
        else { [void]$earlyLessons.Add($lesson) }
    }
    $dueSorted = @($dueLessons | Sort-Object @{Expression={
        $record = (Get-CompletionProperty $_.id).Value
        if ([string](Get-RecordValue $record 'status' 'mastered') -eq 'introduced') { 0 } else { 1 }
    }}, @{Expression={ [string](Get-RecordValue (Get-CompletionProperty $_.id).Value 'review_due' $today) }}, order)
    $newSorted = @($newLessons | Sort-Object order)
    $earlySorted = @($earlyLessons | Sort-Object @{Expression={ [string](Get-RecordValue (Get-CompletionProperty $_.id).Value 'review_due' $today) }}, order)
    $dueIndex = 0; $newIndex = 0; $earlyIndex = 0; $preferReview = $true
    $queue = New-Object Collections.ArrayList
    while ($queue.Count -lt $Count) {
        $lesson = $null; $kind = ''
        if ($preferReview -and $dueIndex -lt $dueSorted.Count) { $lesson = $dueSorted[$dueIndex++]; $kind = 'review' }
        elseif ($newIndex -lt $newSorted.Count) { $lesson = $newSorted[$newIndex++]; $kind = 'new' }
        elseif ($dueIndex -lt $dueSorted.Count) { $lesson = $dueSorted[$dueIndex++]; $kind = 'review' }
        elseif ($earlyIndex -lt $earlySorted.Count) { $lesson = $earlySorted[$earlyIndex++]; $kind = 'early-review' }
        else { break }
        [void]$queue.Add([pscustomobject]@{ lesson = $lesson; kind = $kind })
        $preferReview = -not $preferReview
    }
    return @($queue)
}

function Start-LessonSession($InitialLesson, [object[]]$Queue, [switch]$Daily, [switch]$ForceReview) {
    $queueMode = $null -ne $Queue -and $Queue.Count -gt 0
    $queueIndex = 0
    $dailyCompletedIds = @{}
    $lesson = $InitialLesson
    if ($queueMode) { $lesson = $Queue[0].lesson }
    while ($null -ne $lesson) {
        $attempts = 0
        $hintsUsed = 0
        $hintIndex = 0
        $solutionShown = $false
        $targetObserved = $false
        $completedHere = $false
        if ($queueMode) { $script:ReviewMode = $Queue[$queueIndex].kind -ne 'new' }
        else { $script:ReviewMode = [bool]$ForceReview }
        Reset-Workspace $lesson
        Show-Lesson $lesson
        if ($Daily -and $queueMode) { Write-Gym "DAILY $($queueIndex + 1)/$($Queue.Count) | $($Queue[$queueIndex].kind)" Cyan }
        if (Test-Completed $lesson.id) { Write-Gym 'Already completed; this replay updates its mastery schedule.' DarkGray }

        $moveToNext = $false
        while ($true) {
            $shownPath = Get-LearnerLocation
            if ($shownPath.StartsWith($script:Workspace, [StringComparison]::OrdinalIgnoreCase)) {
                $shownPath = '~' + $shownPath.Substring($script:Workspace.Length)
            }
            $command = Read-GymCommand ("gym[$($lesson.order)] $shownPath>")
            if ([string]::IsNullOrWhiteSpace($command)) { continue }

            if ($command -eq ':hint') {
                $hints = @($lesson.hints)
                if ($hintIndex -lt $hints.Count) {
                    Write-Gym "Hint $($hintIndex + 1): $(Resolve-TemplateText ([string]$hints[$hintIndex]))" Yellow
                    $hintIndex++; $hintsUsed++
                }
                elseif ($hintIndex -eq $hints.Count) {
                    Write-Gym "Reference approach: $(Resolve-TemplateText ([string]$lesson.solution))" Yellow
                    $hintIndex++; $hintsUsed++; $solutionShown = $true
                }
                else { Write-Gym 'All hints have been shown.' }
                continue
            }
            if ($command -eq ':example') {
                if (Test-BlindLesson $lesson) { Write-Gym 'Worked examples stay hidden in blind review. Use :hint for assisted guidance.' }
                else {
                    Write-Gym (Resolve-TemplateText ([string]$lesson.example))
                    foreach ($line in @($lesson.breakdown)) { Write-Gym ('  - ' + (Resolve-TemplateText ([string]$line))) DarkGray }
                }
                continue
            }
            if ($command -eq ':lesson') { Show-Lesson $lesson; continue }
            if ($command -eq ':files') { Get-ChildItem $script:Workspace -Recurse -Force | Select-Object FullName,Length; continue }
            if ($command -eq ':help') { Show-SessionHelp; continue }
            if ($command -eq ':status') { Show-Status; continue }
            if ($command -eq ':shell') { Start-ExplorationShell; continue }
            if ($command -eq ':reset') { Reset-Workspace $lesson; Write-Gym 'Workspace and lesson session restored.'; continue }
            if ($command -eq ':check') {
                Write-Gym 'CHECK' Cyan
                $passed = Test-Checks $lesson -Show
                if ($passed -and $attempts -eq 0) {
                    Write-Gym '[TRY ] Run at least one command before completing this rep.' Yellow
                }
                elseif ($passed -and -not $completedHere) {
                    $gained = Complete-Lesson $lesson $attempts $hintsUsed $solutionShown $targetObserved
                    $completedHere = $true
                    Write-Gym "REP COMPLETE | +$gained XP" Green
                    Write-Gym (Resolve-TemplateText ([string]$lesson.completion)) DarkGray
                    if ($queueMode) { $dailyCompletedIds[[string]$lesson.id] = $true; $moveToNext = $true; break }
                }
                continue
            }
            if ($command -eq ':next') {
                if ($queueMode -and -not $completedHere) { Write-Gym 'Complete this rep before advancing the daily queue, or use :quit to leave.' Yellow; continue }
                if ($queueMode) { $moveToNext = $true }
                else { $lesson = Get-NextLesson $lesson }
                break
            }
            if ($command -eq ':previous' -or $command -eq ':prev') {
                if ($queueMode -and $queueIndex -gt 0) { $queueIndex--; $lesson = $Queue[$queueIndex].lesson; break }
                if ($queueMode) { Write-Gym 'This is the first rep in today''s queue.'; continue }
                $previous = Get-PreviousLesson $lesson
                if ($null -eq $previous) { Write-Gym 'This is PowerShell rep 001; there is no previous rep.' }
                else { $lesson = $previous; break }
                continue
            }
            if ($command -eq ':go') { Write-Gym 'Usage: :go <number|command|lesson-id>'; continue }
            if ($command.StartsWith(':go ')) {
                $targetText = $command.Substring(4).Trim()
                $target = Get-Lesson $targetText
                if ($null -eq $target) { Write-UnknownTarget $targetText }
                else { $queueMode = $false; $lesson = $target; break }
                continue
            }
            if ($command -eq ':quit' -or $command -eq ':q') { return }
            if ($command.StartsWith(':')) { Write-Gym 'Unknown gym control. Use :help.' Yellow; continue }

            $attempts++
            if (Test-TargetCommandInInput $command ([string]$lesson.command)) { $targetObserved = $true }
            Invoke-GymCommand $command
            Write-Gym 'CHECK' Cyan
            $passed = Test-Checks $lesson -Show
            if ($passed) {
                if (-not $completedHere) {
                    $gained = Complete-Lesson $lesson $attempts $hintsUsed $solutionShown $targetObserved
                    $completedHere = $true
                    Write-Gym "REP COMPLETE | +$gained XP" Green
                    Write-Gym (Resolve-TemplateText ([string]$lesson.completion)) DarkGray
                    if ($queueMode) { $dailyCompletedIds[[string]$lesson.id] = $true }
                }
                if ($queueMode) { $moveToNext = $true; break }
                $next = Get-NextLesson $lesson
                if ($null -ne $next) { Write-Gym "Use :next for rep $($next.order), or :go to jump elsewhere." DarkGray }
            }
            else { Write-Gym 'Any valid approach can pass. The diagnostics describe the missing outcome.' DarkGray }
        }

        if ($queueMode -and $moveToNext) {
            $queueIndex++
            if ($queueIndex -ge $Queue.Count) {
                if ($dailyCompletedIds.Count -eq $Queue.Count) { Write-Gym "DAILY COMPLETE | $($dailyCompletedIds.Count)/$($Queue.Count) reps" Green }
                else { Write-Gym "Daily queue ended | $($dailyCompletedIds.Count)/$($Queue.Count) reps completed; skipped reps remain available." Yellow }
                Show-Status
                return
            }
            $lesson = $Queue[$queueIndex].lesson
        }
    }
}

function Test-Catalog {
    if ([int]$script:Catalog.catalog_version -lt 2) { return $false }
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
    $last = $script:Lessons | Sort-Object order | Select-Object -Last 1
    return $first.order -eq 1 -and $byCommand.command -eq 'Get-Help' -and $last.order -eq 500 -and $null -eq (Get-PreviousLesson $first) -and $null -eq (Get-NextLesson $last)
}

function Test-NegativeGrading {
    $synthetic = [pscustomobject]@{
        id = 'synthetic-negative'
        requires_success = $true
        checks = @([pscustomobject]@{ type = 'stdout-nonempty'; description = 'Error text must not count as output.' })
    }
    Invoke-GymCommand "Microsoft.PowerShell.Management\Get-Item '__hacker_cli_gym_missing__' -ErrorAction Stop" -Quiet
    if (Test-Checks $synthetic) { return $false }
    $lineLesson = [pscustomobject]@{
        id = 'synthetic-lines'
        requires_success = $true
        checks = @([pscustomobject]@{ type = 'stdout-line-count'; description = 'Two lines'; expected = 2 })
    }
    Invoke-GymCommand "'alpha','beta'" -Quiet
    if (-not (Test-Checks $lineLesson)) { return $false }
    Invoke-GymCommand "'alpha'" -Quiet
    if (Test-Checks $lineLesson) { return $false }
    $errorLesson = [pscustomobject]@{
        id = 'synthetic-stderr'
        requires_success = $false
        checks = @([pscustomobject]@{ type = 'stderr-contains'; description = 'Error was captured separately.'; expected = '__gym_expected_error__' })
    }
    Invoke-GymCommand "Write-Error '__gym_expected_error__'" -Quiet
    if (-not (Test-Checks $errorLesson)) { return $false }
    $mixedLesson = [pscustomobject]@{
        id = 'synthetic-output'
        requires_success = $false
        checks = @([pscustomobject]@{ type = 'output-contains'; description = 'Combined output accepts diagnostics.'; expected = '__gym_expected_error__' })
    }
    return Test-Checks $mixedLesson
}

function Test-WorkspaceCleanupSafety {
    if ($env:OS -ne 'Windows_NT') { return $true }
    $external = Join-Path $script:StateRoot ('.cleanup-sentinel-' + [Guid]::NewGuid().ToString('N'))
    $sentinel = Join-Path $external 'keep.txt'
    try {
        New-Item -ItemType Directory -Path $external -Force | Out-Null
        [IO.File]::WriteAllText($sentinel, 'must survive workspace cleanup', $script:Utf8NoBom)
        Reset-Workspace $script:Lessons[0]
        $junction = Join-Path $script:Workspace '.external-junction'
        New-Item -ItemType Junction -Path $junction -Target $external -Force | Out-Null
        $readOnlyDirectory = Join-Path $script:Workspace '.readonly-directory'
        New-Item -ItemType Directory -Path $readOnlyDirectory -Force | Out-Null
        [IO.File]::SetAttributes($readOnlyDirectory, [IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReadOnly)
        Reset-Workspace $script:Lessons[0]
        return [IO.File]::Exists($sentinel) -and -not (Test-Path $junction) -and -not (Test-Path $readOnlyDirectory)
    }
    catch {
        $script:LastError = $_.ToString()
        return $false
    }
    finally {
        Close-LearnerSession
        if ([IO.Directory]::Exists($external)) { Remove-WorkspaceEntrySafely $external }
    }
}

function Test-ReferenceSolutions {
    Write-Gym 'Checking PowerShell curriculum structure... ' $null -NoNewline
    if (-not (Test-Catalog)) { Write-Gym 'FAIL' Red; return $false }
    Write-Gym 'PASS' Green
    Write-Gym 'Checking lesson navigation... ' $null -NoNewline
    if (-not (Test-Navigation)) { Write-Gym 'FAIL' Red; return $false }
    Write-Gym 'PASS' Green
    Reset-Workspace $script:Lessons[0]
    Write-Gym 'Checking error-safe and negative grading... ' $null -NoNewline
    if (-not (Test-NegativeGrading)) { Write-Gym 'FAIL' Red; return $false }
    Write-Gym 'PASS' Green
    Write-Gym 'Checking reparse-point-safe workspace cleanup... ' $null -NoNewline
    if (-not (Test-WorkspaceCleanupSafety)) { Write-Gym "FAIL: $script:LastError" Red; return $false }
    Write-Gym 'PASS' Green

    $failures = 0
    Write-Gym "Running baseline and reference checks for all $script:TotalLessons PowerShell reps..."
    foreach ($lesson in $script:Lessons) {
        try {
            Reset-Workspace $lesson
            $baselinePassed = Test-Checks $lesson
            if ($baselinePassed) {
                $failures++
                Write-Gym ("  FAIL {0:D3} {1} (fixture already passes before a learner command)" -f [int]$lesson.order,$lesson.command) Red
                continue
            }
            Invoke-GymCommand (Resolve-TemplateText ([string]$lesson.solution)) -Quiet
            $passed = Test-Checks $lesson
        }
        catch {
            $passed = $false
            $script:LastError = $_.ToString()
            $script:LastExitCode = 1
        }
        if ($passed) {
            Write-Gym ("  PASS {0:D3} {1}" -f [int]$lesson.order,$lesson.command) Green
        }
        else {
            $failures++
            Write-Gym ("  FAIL {0:D3} {1}" -f [int]$lesson.order,$lesson.command) Red
            Write-Gym "       solution: $($lesson.solution)"
            Write-Gym "       output: $script:LastOutput"
            Write-Gym "       error: $script:LastError"
            Write-Gym "       exit: $script:LastExitCode"
        }
    }
    if ($failures -gt 0) {
        Write-Gym "$failures PowerShell test failure(s)." Red
        return $false
    }
    Write-Gym "All $script:TotalLessons PowerShell baseline and reference checks passed." Green
    return $true
}

function Show-List {
    $today = (Get-Date).ToString('yyyy-MM-dd')
    foreach ($lesson in $script:Lessons) {
        if (-not [string]::IsNullOrWhiteSpace($Section) -and -not ([string]$lesson.section).ToLowerInvariant().Contains($Section.ToLowerInvariant())) { continue }
        if (-not [string]::IsNullOrWhiteSpace($CommandName) -and -not ([string]$lesson.command -ieq $CommandName)) { continue }
        if (-not [string]::IsNullOrWhiteSpace($Selector)) {
            $needle = $Selector.ToLowerInvariant()
            if (-not (([string]$lesson.id).ToLowerInvariant().Contains($needle) -or ([string]$lesson.command).ToLowerInvariant().Contains($needle) -or ([string]$lesson.title).ToLowerInvariant().Contains($needle))) { continue }
        }
        $property = Get-CompletionProperty $lesson.id
        if ($Unfinished -and $null -ne $property) { continue }
        if ($Due) {
            if ($null -eq $property -or [string](Get-RecordValue $property.Value 'review_due' '9999-12-31') -gt $today) { continue }
        }
        if ($null -eq $property) { $mark = '[ ]' }
        elseif ([string](Get-RecordValue $property.Value 'review_due' '9999-12-31') -le $today) { $mark = '[R]' }
        elseif ([string](Get-RecordValue $property.Value 'status' 'mastered') -eq 'introduced') { $mark = '[~]' }
        else { $mark = '[x]' }
        Write-Output ("{0} {1:D3}  {2,-28} {3}/5 - {4}" -f $mark,[int]$lesson.order,$lesson.command,[int]$lesson.stage,$lesson.title)
    }
}

function Invoke-ProgressAction([string]$SubAction, [string]$FilePath) {
    if ([string]::IsNullOrWhiteSpace($SubAction)) { throw 'Usage: .\gym.ps1 progress <export|import|reset> [path|CONFIRM]' }
    switch ($SubAction.ToLowerInvariant()) {
        'export' {
            if ([string]::IsNullOrWhiteSpace($FilePath)) { $FilePath = Join-Path (Get-Location) 'powershell-progress.export.json' }
            if ($FilePath -eq '-') { Write-Output ($script:Progress | ConvertTo-Json -Depth 16); return }
            $destination = [IO.Path]::GetFullPath($FilePath)
            Write-JsonAtomic $script:Progress $destination
            Write-Gym "Progress exported to $destination" Green
        }
        'import' {
            if ([string]::IsNullOrWhiteSpace($FilePath)) { throw 'Usage: .\gym.ps1 progress import <path>' }
            $source = [IO.Path]::GetFullPath($FilePath)
            if (-not (Test-Path $source -PathType Leaf)) { throw "Progress import not found: $source" }
            $candidate = [IO.File]::ReadAllText($source, [Text.Encoding]::UTF8) | ConvertFrom-Json
            if (-not (Test-ProgressDocument $candidate)) { throw 'Imported progress has an unsupported shape.' }
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $backup = Join-Path $script:StateRoot "powershell-progress.pre-import-$stamp.json"
            Copy-Item $script:ProgressPath $backup -Force
            $script:Progress = $candidate
            Migrate-Progress
            Save-Progress
            Write-Gym "Progress imported from $source. Previous progress is preserved at $backup" Green
        }
        'reset' {
            if ($FilePath -cne 'CONFIRM') { throw 'Progress reset is destructive. Run .\gym.ps1 progress reset CONFIRM' }
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $backup = Join-Path $script:StateRoot "powershell-progress.reset-$stamp.json"
            Copy-Item $script:ProgressPath $backup -Force
            $script:Progress = New-ProgressDocument
            Save-Progress
            Write-Gym "Progress reset. The previous record is preserved at $backup" Yellow
        }
        default { throw "Unknown progress action '$SubAction'. Use export, import, or reset." }
    }
}

function Show-Doctor {
    $failed = $false
    Write-Gym "Hacker CLI Gym PowerShell doctor ($script:GymVersion)" Cyan
    $isWindowsPowerShell = $env:OS -eq 'Windows_NT' -and $PSVersionTable.PSEdition -eq 'Desktop' -and $PSVersionTable.PSVersion -ge [version]'5.1'
    if ($isWindowsPowerShell) { Write-Gym "[PASS] Windows PowerShell $($PSVersionTable.PSVersion)" Green }
    else { Write-Gym '[FAIL] Windows PowerShell 5.1 is required; PowerShell 7 does not include every Windows-only cmdlet in this catalog.' Red; $failed = $true }
    if (Test-Catalog) { Write-Gym "[PASS] Curriculum: $script:TotalLessons reps, $script:CommandCount commands" Green }
    else { Write-Gym '[FAIL] Curriculum structure is invalid.' Red; $failed = $true }
    try {
        $probe = Join-Path $script:StateRoot ('.doctor-' + [Guid]::NewGuid().ToString('N'))
        [IO.File]::WriteAllText($probe, 'ok', $script:Utf8NoBom)
        Remove-Item $probe -Force
        Write-Gym "[PASS] State directory is writable: $script:StateRoot" Green
    }
    catch { Write-Gym "[FAIL] State directory is not writable: $($_.Exception.Message)" Red; $failed = $true }
    if (Test-ProgressDocument $script:Progress) { Write-Gym "[PASS] Progress schema $($script:Progress.schema_version)" Green }
    else { Write-Gym '[FAIL] Progress document is invalid.' Red; $failed = $true }
    Write-Gym "NO_COLOR: $(if ($script:UseColor) { 'off' } else { 'on' }) | auto-clear: $(if ($env:HACKER_CLI_GYM_CLEAR -eq '1') { 'on' } else { 'off' })" DarkGray
    if ($failed) { return $false }
    Write-Gym 'PowerShell gym is ready.' Green
    return $true
}

function Show-Version {
    Write-Gym "Hacker CLI Gym PowerShell $script:GymVersion | catalog $($script:Catalog.catalog_version) | $script:TotalLessons reps"
}

function Show-Help {
    $text = @"
Hacker CLI Gym - 500 outcome-graded PowerShell exercises on Windows

Usage:
  .\gym.ps1 start                         start the next unfinished rep
  .\gym.ps1 daily [COUNT]                 run a due-review/new-rep queue (default: 3)
  .\gym.ps1 review [TARGET]               run a blind review
  .\gym.ps1 run Get-ChildItem             run by command, number, or lesson ID
  .\gym.ps1 list [-Section NAME] [-Command NAME] [-Unfinished] [-Due]
  .\gym.ps1 status                        show mastery, XP, streak, and sections
  .\gym.ps1 progress export [PATH]
  .\gym.ps1 progress import PATH
  .\gym.ps1 progress reset CONFIRM
  .\gym.ps1 doctor                        validate storage and curriculum
  .\gym.ps1 version                       show runner and catalog versions
  .\gym.ps1 test                          run baseline, negative, and reference tests
  .\gym.ps1 help                          show this help

Set NO_COLOR=1 for uncolored output. Set HACKER_CLI_GYM_CLEAR=1 to clear before lessons.
HACKER_CLI_GYM_STATE_ROOT can redirect disposable state for testing or portable use.
"@
    Write-Gym $text
}

Initialize-State

try {
    switch ($Action.ToLowerInvariant()) {
        'start' {
            $lesson = Get-NextIncomplete
            if ($null -eq $lesson) { Write-Gym 'All 500 PowerShell reps are complete. Use review or run to keep practicing.'; Show-Status }
            else { Start-LessonSession $lesson }
        }
        'daily' {
            $goal = [int]$script:Progress.settings.daily_goal
            if (-not [string]::IsNullOrWhiteSpace($Selector)) {
                if (-not [int]::TryParse($Selector, [ref]$goal) -or $goal -lt 1 -or $goal -gt 10) { throw 'Daily count must be from 1 to 10.' }
            }
            $queue = @(Get-DailyQueue $goal)
            if ($queue.Count -eq 0) { Write-Gym 'No PowerShell reps are available.'; Show-Status }
            else { Write-Gym "Daily session: $($queue.Count) reps, interleaving due review and new work." Cyan; Start-LessonSession $queue[0].lesson $queue -Daily }
        }
        'review' {
            if ([string]::IsNullOrWhiteSpace($Selector)) {
                $reviewQueue = @(Get-DailyQueue 1)
                if ($reviewQueue.Count -eq 0) { throw 'No rep is available to review.' }
                $reviewLesson = $reviewQueue[0].lesson
            }
            else {
                $reviewLesson = Get-Lesson $Selector
                if ($null -eq $reviewLesson) { Write-UnknownTarget $Selector; exit 1 }
            }
            Start-LessonSession $reviewLesson -ForceReview
        }
        'run' {
            if ([string]::IsNullOrWhiteSpace($Selector)) { throw 'Usage: .\gym.ps1 run <number|command|lesson-id>' }
            $lesson = Get-Lesson $Selector
            if ($null -eq $lesson) { Write-UnknownTarget $Selector; exit 1 }
            Start-LessonSession $lesson
        }
        'list' { Show-List }
        'status' { Show-Status }
        'progress' { Invoke-ProgressAction $Selector $Path }
        'doctor' { if (-not (Show-Doctor)) { exit 1 } }
        'version' { Show-Version }
        'test' { if (-not (Test-ReferenceSolutions)) { exit 1 } }
        'help' { Show-Help }
        '-h' { Show-Help }
        '--help' { Show-Help }
        default { throw "Unknown action '$Action'. Use .\gym.ps1 help." }
    }
}
finally {
    Close-LearnerSession
    if (Test-Path $script:OriginalLocation -PathType Container) { Microsoft.PowerShell.Management\Set-Location $script:OriginalLocation }
}
