[CmdletBinding()]
param(
    [switch]$PersistProgress
)

$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'Windows Sandbox is available only on Windows.'
}

$sandboxExecutable = Join-Path $env:WINDIR 'System32\WindowsSandbox.exe'
if (-not (Test-Path -LiteralPath $sandboxExecutable -PathType Leaf)) {
    throw @'
Windows Sandbox is not installed. It is available on supported Pro, Enterprise,
and Education editions. Enable "Windows Sandbox" in Windows Features, restart,
and run this launcher again.
'@
}

$repositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sandboxRepository = 'C:\Users\WDAGUtilityAccount\Desktop\HackerCliGym'
$mappedFolders = @"
    <MappedFolder>
      <HostFolder>$([Security.SecurityElement]::Escape($repositoryRoot))</HostFolder>
      <SandboxFolder>$sandboxRepository</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
"@

$commandParts = @("Set-Location '$sandboxRepository'")
if ($PersistProgress) {
    $hostState = Join-Path $env:LOCALAPPDATA 'HackerCliGymSandbox'
    [void](New-Item -ItemType Directory -Path $hostState -Force)
    $sandboxState = 'C:\Users\WDAGUtilityAccount\Desktop\HackerCliGymState'
    $mappedFolders += @"
    <MappedFolder>
      <HostFolder>$([Security.SecurityElement]::Escape($hostState))</HostFolder>
      <SandboxFolder>$sandboxState</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
"@
    $commandParts += "`$env:HACKER_CLI_GYM_STATE_ROOT = '$sandboxState'"
}
$commandParts += "& '.\gym.ps1' start"

$innerCommand = $commandParts -join '; '
$logonCommand = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command `"&amp; { $innerCommand }`""
$configurationPath = Join-Path $env:TEMP 'hacker-cli-gym.wsb'
$configuration = @"
<Configuration>
  <VGpu>Disable</VGpu>
  <Networking>Default</Networking>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <PrinterRedirection>Disable</PrinterRedirection>
  <ProtectedClient>Enable</ProtectedClient>
  <MappedFolders>
$mappedFolders  </MappedFolders>
  <LogonCommand>
    <Command>$logonCommand</Command>
  </LogonCommand>
</Configuration>
"@

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($configurationPath, $configuration, $utf8WithoutBom)

Write-Host 'Starting Hacker CLI Gym in Windows Sandbox...'
if ($PersistProgress) {
    Write-Host "Progress will persist in $hostState"
} else {
    Write-Host 'This session is fully disposable. Use -PersistProgress to retain progress.'
}
[void](Start-Process -FilePath $sandboxExecutable -ArgumentList "`"$configurationPath`"")
