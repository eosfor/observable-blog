. src/basicvis/helper.ps1

$CIKs = "0000789019", "0000320193", "0001318605", "0001288776", "0001352010" # who is that?
$allData = $CIKs | % { Get-RecentSecForm4XmlUrls -CIK $_  -DaysBack ((Get-Date).DayOfYear) } | Convert-Form4XmlToRecord

New-Item -ItemType Directory -Path ./tmp
$allData | Export-Csv -Path "tmp/x.allData.csv" -NoTypeInformation -Force | Out-Null
$allData | ConvertTo-Csv