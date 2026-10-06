param(
    [string]$CommitMessage = ('Update classroom app ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')),
    [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskGit = (Get-Command git -ErrorAction Stop).Source
$taskSafeRoot = $taskRoot.Replace('\', '/')
function Invoke-AppGit {
    param([string[]]$GitArgs)
    $taskOutput = & $taskGit -c ("safe.directory=" + $taskSafeRoot) -c core.quotePath=false -C $taskRoot @GitArgs
    if ($LASTEXITCODE -ne 0) { throw ('Git 작업에 실패했습니다: ' + ($GitArgs -join ' ')) }
    return $taskOutput
}
try {
    $taskBranch = (Invoke-AppGit -GitArgs @('branch','--show-current')).Trim()
    if ($taskBranch -ne 'main') { throw 'main 브랜치가 아닙니다. 프로젝트 브랜치를 확인해 주세요.' }
    $taskOrigin = (Invoke-AppGit -GitArgs @('remote','get-url','origin')).Trim()
    if ($taskOrigin -ne 'https://github.com/seongho0674-glitch/-.git') { throw '연결된 GitHub 저장소가 변경되었습니다. origin 주소를 확인해 주세요.' }
    Write-Host '1/3 수정한 앱 파일을 새 버전으로 저장합니다.'
    $taskPaths = @('.gitignore','index.html','vercel.json','README.md','server.py',
        'class-roster.json','실행하기.bat','푸시하기.bat','푸시하기.ps1',
        'css','js','assets','public','.github',
        'tests/test_server.py','tests/test_mock.mjs','tests/test_ui.cjs')
    $taskExisting = @($taskPaths | Where-Object { Test-Path -LiteralPath (Join-Path $taskRoot $_) })
    Invoke-AppGit -GitArgs (@('add','--') + $taskExisting) | Out-Null
    # 실제 학급 기록은 로컬에 보존하고 Git 추적만 해제합니다.
    Invoke-AppGit -GitArgs @('rm','--cached','--ignore-unmatch','--','data/db.json') | Out-Null
    $taskStaged = @(Invoke-AppGit -GitArgs @('diff','--cached','--name-only'))
    foreach ($taskPath in $taskStaged) {
        $taskAllowed = $taskPath -eq 'data/db.json'
        foreach ($taskAllowedPath in $taskPaths) {
            if ($taskPath -eq $taskAllowedPath -or $taskPath.StartsWith($taskAllowedPath + '/')) { $taskAllowed = $true; break }
        }
        if (-not $taskAllowed) { throw ('예상하지 않은 파일이 이미 전송 목록에 있습니다: ' + $taskPath + '. 앱 파일만 전송할 수 있도록 목록을 확인해 주세요.') }
    }
    if ($taskStaged.Count -gt 0) {
        Invoke-AppGit -GitArgs @('commit','-m',$CommitMessage) | ForEach-Object { Write-Host $_ }
    } else {
        Write-Host '새로 저장할 변경 사항은 없습니다. 이미 저장한 최신 버전을 전송합니다.'
    }
    $taskCommit = (Invoke-AppGit -GitArgs @('rev-parse','--short','HEAD')).Trim()
    if ($PrepareOnly) { Write-Host ('새 버전 준비 완료: ' + $taskCommit); exit 0 }
    Write-Host '2/3 GitHub에 최신 버전을 전송합니다.'
    Invoke-AppGit -GitArgs @('push','-u','origin','main') | ForEach-Object { Write-Host $_ }
    Write-Host ('3/3 GitHub 전송 완료: ' + $taskCommit)
    Write-Host 'Vercel의 자동 배포가 시작됩니다. 배포가 완료되면 아래 주소에서 새로고침하세요.'
    Write-Host 'https://classclass-gamma.vercel.app/'
    Write-Host '전송 완료와 배포 완료는 별도 단계입니다. Vercel 배포 실패 시 배포 화면의 오류를 확인해 주세요.'
    exit 0
} catch {
    Write-Host ('오류: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host '새 변경 사항을 전송하지 못했습니다. 위 오류를 확인한 뒤 다시 실행해 주세요.'
    exit 1
}
