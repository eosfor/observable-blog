. src/basicvis/helper.ps1

$allData = Import-Csv -Path "x.allData.csv"

$data2 = $allData |
    # Filter only transactions with non-zero number of shares
    Where-Object { $_.SharesTransacted -gt 0 } |

    # Group by InsiderName and TransactionCode (e.g., "John Smith|S")
    Group-Object { "$($_.InsiderName)|$($_.TransactionCode)" } |

    ForEach-Object {
        $parts = $_.Name -split '\|'     # Split group name into [InsiderName, TransactionCode]
        $group = $_.Group                # Access the actual group of transactions

        # Filter only those deals with valid numeric and positive price per share
        $validDeals = $group | Where-Object {
            [double]::TryParse($_.PricePerShare, [ref]$null) -and [double]$_.PricePerShare -gt 0
        }

        # Sum all shares transacted in the group
        $sharesSum = ($group | Measure-Object -Property SharesTransacted -Sum).Sum

        # Calculate total value by summing (Shares × Price) across valid deals
        $totalValue = ($validDeals | ForEach-Object {
            [double]$_.SharesTransacted * [double]$_.PricePerShare
        }) | Measure-Object -Sum | Select-Object -ExpandProperty Sum

        # Display value only if valid (not null or NaN)
        $valueDisplay = if ($totalValue -and $totalValue -gt 0 -and -not [double]::IsNaN($totalValue)) {
            [math]::Round($totalValue, 2)
        } else {
            "unknown"
        }

        # Return summary object for each (InsiderName, TransactionCode) group
        [PSCustomObject]@{
            Issuer             = $group[0].Issuer
            Insider            = $parts[0]
            TransactionCode    = $parts[1]
            Count              = $_.Count
            TotalShares        = [math]::Round($sharesSum, 2)
            TotalValue         = if ($valueDisplay -is [string]) { $null } else { $valueDisplay }
            TotalValueDisplay  = "$valueDisplay"
        }
    }

$data2 | ConvertTo-Csv