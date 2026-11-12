param([string]$PgBin='')
$ErrorActionPreference='Stop'
$workspacePath=Split-Path -Parent $PSScriptRoot
$localPath=Join-Path $workspacePath '.local\backend'
New-Item -ItemType Directory -Force $localPath | Out-Null
if(-not $PgBin){$PgBin=Join-Path $workspacePath '.local\tools\postgresql\pgsql\bin'}
if(-not(Test-Path -LiteralPath (Join-Path $PgBin 'initdb.exe'))){throw 'PostgreSQL binaries not found. Pass -PgBin with the installed PostgreSQL bin directory.'}
$dataPath=Join-Path $localPath 'pgdata'
$statePath=Join-Path $localPath 'database-state.json'
function New-Secret {
 $bytes=New-Object byte[] 32
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
 return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}
function New-HexSecret {
 $bytes=New-Object byte[] 32
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
 return [BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant()
}
if(Test-Path -LiteralPath $statePath){$state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json}
else{
 if(Test-Path -LiteralPath $dataPath){throw 'Existing data directory has no matching setup state; refusing to initialize over it.'}
 $state=[pscustomobject]@{admin=(New-Secret);migrator=(New-Secret);app=(New-Secret);access=(New-Secret);jobs=(New-HexSecret);testAccess=(New-Secret);testJobs=(New-HexSecret)}
 $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
 $passwordPath=Join-Path $localPath 'init-password.txt'
 $state.admin | Set-Content -LiteralPath $passwordPath -Encoding Ascii
 & (Join-Path $PgBin 'initdb.exe') -D $dataPath -U nivvi_admin -A scram-sha-256 --pwfile=$passwordPath --encoding=UTF8 --locale=C
 if($LASTEXITCODE -ne 0){throw 'PostgreSQL initialization failed.'}
}
& (Join-Path $PgBin 'pg_ctl.exe') -D $dataPath status | Out-Null
if($LASTEXITCODE -ne 0){
 & (Join-Path $PgBin 'pg_ctl.exe') -D $dataPath -l (Join-Path $localPath 'postgres.log') -o '-p 55432 -h 127.0.0.1' -w start
 if($LASTEXITCODE -ne 0){throw 'PostgreSQL could not start on localhost:55432. Check .local/backend/postgres.log.'}
}
$previousPassword=$env:PGPASSWORD
try{
 $env:PGPASSWORD=$state.admin
 function Invoke-LocalSql([string]$Database,[string]$Sql){
  $sqlPath=Join-Path $localPath 'setup.sql'
  $Sql | Set-Content -LiteralPath $sqlPath -Encoding UTF8
  & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p 55432 -U nivvi_admin -d $Database -v ON_ERROR_STOP=1 -f $sqlPath | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Local database setup SQL failed.'}
 }
 foreach($role in @('nivvi_migrator','nivvi_app')){
  $exists=& (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p 55432 -U nivvi_admin -d postgres -At -c "SELECT 1 FROM pg_roles WHERE rolname='$role'"
  if($LASTEXITCODE -ne 0){throw 'Could not query local roles.'}
  if(-not $exists){$secret=if($role -eq 'nivvi_app'){$state.app}else{$state.migrator};Invoke-LocalSql 'postgres' "CREATE ROLE $role LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '$secret';"}
 }
 foreach($databaseName in @('nivvi_development','nivvi_test')){
  $exists=& (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p 55432 -U nivvi_admin -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname='$databaseName'"
  if(-not $exists){Invoke-LocalSql 'postgres' "CREATE DATABASE $databaseName OWNER nivvi_migrator;"}
  Invoke-LocalSql $databaseName "REVOKE ALL ON DATABASE $databaseName FROM PUBLIC; GRANT CONNECT ON DATABASE $databaseName TO nivvi_app; REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO nivvi_app; ALTER DEFAULT PRIVILEGES FOR ROLE nivvi_migrator IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO nivvi_app; ALTER DEFAULT PRIVILEGES FOR ROLE nivvi_migrator IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO nivvi_app;"
  $test=$databaseName -eq 'nivvi_test'
  $file=if($test){'.env.test.local'}else{'.env.local'}
  $configPath=Join-Path $workspacePath "apps\backend\$file"
  if(-not(Test-Path -LiteralPath $configPath)){
   $mode=if($test){'test'}else{'development'}
   $access=if($test){$state.testAccess}else{$state.access}
   $jobs=if($test){$state.testJobs}else{$state.jobs}
   $mailDirectory=(Join-Path $localPath "mail-$mode").Replace('\','/')
   @"
NODE_ENV=$mode
HOST=127.0.0.1
PORT=3000
DATABASE_URL=postgresql://nivvi_app:$($state.app)@127.0.0.1:55432/$databaseName
DIRECT_DATABASE_URL=postgresql://nivvi_migrator:$($state.migrator)@127.0.0.1:55432/$databaseName
ACCESS_TOKEN_SECRET=$access
JOB_ENCRYPTION_KEY=$jobs
MAIL_MODE=file
MAIL_DIRECTORY=$mailDirectory
MAIL_FROM=noreply@nivvi.local
PUBLIC_APP_URL=http://127.0.0.1:8081/
"@ | Set-Content -LiteralPath $configPath -Encoding Ascii
  }
 }
}finally{$env:PGPASSWORD=$previousPassword}
Write-Output 'Local PostgreSQL ready on 127.0.0.1:55432; dev/test databases and ignored environment files configured. Credentials were not printed.'
