. src/basicvis/helper.ps1

$allData = 
Get-RecentSecForm4XmlUrls -CIK "0000789019" -DaysBack 107 |
    Convert-Form4XmlToRecord

$data = $allData |
Select-Object TransactionDate, SharesTransacted, TransactionCode |
Where-Object { $_.TransactionCode -in @("S", "P", "F", "A", "M", "G") -and $_.SharesTransacted -gt 0 }

$data = $data | ForEach-Object {
    $action = switch ($_.TransactionCode) {
        "S" { "Sell"; break }
        "F" { "Sell"; break }
        "G" { "Sell"; break }
        "A" { "Buy"; break }
        "P" { "Buy"; break }
        "M" { "Buy"; break }
        default { "Other" }
    }

    $_ | Add-Member -NotePropertyName Action -NotePropertyValue $action -Force -PassThru
}

$data | ConvertTo-Csv