foreach ($t in @('smoke-test','integration-test','cours-test','excel-test','annee-test','impaye-test','fiche-check','card-check','splash-check')) {
  Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep 2
  $out = npx electron "$t.js" 2>&1 | Select-Object -Last 1
  "{0,-18} : {1}" -f $t, ($out | Out-String).Trim()
}