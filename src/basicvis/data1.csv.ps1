. src/basicvis/helper.ps1

$allData = Import-Csv -Path "x.allData.csv"

$data = $allData |
Select-Object Issuer, TransactionDate, SharesTransacted, TransactionCode |
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