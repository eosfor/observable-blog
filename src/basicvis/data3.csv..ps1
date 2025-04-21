. src/basicvis/helper.ps1

$allData = 
Get-RecentSecForm4XmlUrls -CIK "0000789019" -DaysBack 107 |
    Convert-Form4XmlToRecord

$data3 = $allData |
    # Filter transactions with shares > 0 and valid date format (YYYY-MM-DD)
    Where-Object {
        $_.SharesTransacted -gt 0 -and
        $_.TransactionDate -match '^\d{4}-\d{2}-\d{2}$'
    } |

    # Process each valid transaction
    ForEach-Object {
        $value = $null              # Holds calculated total value (shares * price)
        $display = "unknown"     # Default display if value is unknown

        # Calculate total value if price is valid and > 0
        if ([double]::TryParse($_.PricePerShare, [ref]$null) -and [double]$_.PricePerShare -gt 0) {
            $value = [math]::Round([double]$_.SharesTransacted * [double]$_.PricePerShare, 2)
            $display = "$value"     # Use calculated value for display
        }

        # Return a simplified transaction record
        [PSCustomObject]@{
            Insider            = $_.InsiderName
            TransactionDate    = $_.TransactionDate
            TransactionCode    = $_.TransactionCode
            SharesTransacted   = [int]$_.SharesTransacted
            TotalValue         = $value
            TotalValueDisplay  = $display
        }
    }

$data3 | ConvertTo-Csv