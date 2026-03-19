# ============================================================
# PostgreSQL postgres 사용자 비밀번호 리셋 스크립트
# 반드시 PowerShell을 "관리자 권한으로 실행" 후 실행하세요
# ============================================================

$pgData = "C:\Program Files\PostgreSQL\18\data"
$pgBin  = "C:\Program Files\PostgreSQL\18\bin"
$hbaFile = "$pgData\pg_hba.conf"

Write-Host "1. pg_hba.conf 를 trust 로 임시 변경..."
$hba = Get-Content $hbaFile
$hba = $hba -replace "host    all             all             127\.0\.0\.1/32            scram-sha-256", "host    all             all             127.0.0.1/32            trust"
$hba = $hba -replace "host    all             all             ::1/128                 scram-sha-256", "host    all             all             ::1/128                 trust"
$hba | Set-Content $hbaFile

Write-Host "2. PostgreSQL 서비스 재시작..."
Restart-Service -Name "postgresql-x64-18" -Force
Start-Sleep -Seconds 3

Write-Host "3. 비밀번호를 'postgres' 로 설정..."
& "$pgBin\psql.exe" -U postgres -h localhost -p 5432 -c "ALTER USER postgres WITH PASSWORD 'postgres';"

Write-Host "4. pg_hba.conf 를 scram-sha-256 으로 복구..."
$hba = Get-Content $hbaFile
$hba = $hba -replace "host    all             all             127\.0\.0\.1/32            trust", "host    all             all             127.0.0.1/32            scram-sha-256"
$hba = $hba -replace "host    all             all             ::1/128                 trust", "host    all             all             ::1/128                 scram-sha-256"
$hba | Set-Content $hbaFile

Write-Host "5. PostgreSQL 서비스 재시작 (scram-sha-256 적용)..."
Restart-Service -Name "postgresql-x64-18" -Force
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "완료! postgres 사용자 비밀번호가 'postgres' 로 설정되었습니다."
Write-Host "이제 npm run test:integration 을 실행할 수 있습니다."
