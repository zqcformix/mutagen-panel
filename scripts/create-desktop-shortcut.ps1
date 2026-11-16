$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Get-Item -LiteralPath (Join-Path $projectRoot 'mutagen-panel启动.bat')
$icon = Get-Item -LiteralPath (Join-Path $projectRoot 'public\mutagen-panel.ico')
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop) {
    throw 'Windows desktop folder could not be found.'
}

$shortcutPath = Join-Path $desktop ($launcher.Name + '.lnk')
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher.FullName
$shortcut.Arguments = ''
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = $icon.FullName + ',0'
$shortcut.Description = 'Mutagen sync panel'
$shortcut.Save()

Write-Host "Desktop shortcut created: $shortcutPath"
