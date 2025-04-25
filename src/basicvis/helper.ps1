<#
.SYNOPSIS
Retrieves a list of XML URLs for recent Form 4 insider filings from the SEC for a specified CIK.

.DESCRIPTION
This function queries the SEC EDGAR submissions API for a given company identified by its CIK (Central Index Key),
and returns a list of links to XML versions of Form 4 insider trading reports filed within the past N days.

.PARAMETER CIK
The Central Index Key (CIK) of the company. Defaults to Microsoft Corporation (0000789019).

.PARAMETER DaysBack
Number of days in the past to include filings. Defaults to 100 days.

.OUTPUTS
[PSCustomObject] with the following fields:
- FilingDate
- ReportDate
- XmlUrl

.EXAMPLE
Get-RecentSecForm4XmlUrls -CIK "0000320193" -DaysBack 30
Retrieves recent Form 4 XML links for Apple Inc. over the past 30 days.

.EXAMPLE
Get-RecentSecForm4XmlUrls
Returns recent Form 4 filings for Microsoft Corporation from the past 100 days.

.NOTES
A custom User-Agent header is required to access the SEC data endpoints.
#>

function Get-RecentSecForm4XmlUrls {
    param (
        [string]$CIK = "0000789019",
        [int]$DaysBack = 100
    )

    $headers = @{
        "User-Agent" = "PowerShellScript/1.0 (eosfor@gmail.com)"
        "Accept-Encoding" = "gzip, deflate"
    }

    $url = "https://data.sec.gov/submissions/CIK$CIK.json"
    $data = Invoke-RestMethod -Uri $url -Headers $headers

    $cikTrimmed = $CIK.TrimStart("0")
    $cutoffDate = (Get-Date).AddDays(-$DaysBack)

    $results = @()

    for ($i = 0; $i -lt $data.filings.recent.form.Length; $i++) {
        $formType = $data.filings.recent.form[$i]
        if ($formType -ne "4") { continue }

        $filingDate = Get-Date $data.filings.recent.filingDate[$i]
        if ($filingDate -lt $cutoffDate) { continue }

        $accessionNumber = $data.filings.recent.accessionNumber[$i]
        $primaryDoc = $data.filings.recent.primaryDocument[$i]
        $reportDate = $data.filings.recent.reportDate[$i]

        $folder = $accessionNumber -replace "-", ""
        $xmlFileName = [System.IO.Path]::GetFileNameWithoutExtension($primaryDoc) + ".xml"
        $xmlUrl = "https://www.sec.gov/Archives/edgar/data/$cikTrimmed/$folder/$xmlFileName"

        $results += [PSCustomObject]@{
            FilingDate = $filingDate.ToString("yyyy-MM-dd")
            ReportDate = $reportDate
            XmlUrl     = $xmlUrl
        }
    }

    return $results
}

<#
.SYNOPSIS
Converts a Form 4 XML document into a structured PowerShell object representing insider transactions.

.DESCRIPTION
This function takes an object with an XmlUrl (typically output from Get-RecentSecForm4XmlUrls), downloads the Form 4 XML,
and extracts detailed information about the issuer, insider, role, transaction type, number of shares, price,
ownership nature, and any associated footnotes.

.PARAMETER InputObject
An object containing XmlUrl, FilingDate, and ReportDate fields. Usually piped from Get-RecentSecForm4XmlUrls.

.OUTPUTS
[PSCustomObject] with the following fields:
- FilingDate
- ReportDate
- Issuer
- InsiderName
- InsiderRole
- SecurityTitle
- TransactionDate
- TransactionCode
- SharesTransacted
- PricePerShare
- SharesOwnedAfterTxn
- OwnershipType
- IndirectOwnershipNature
- Footnote
- XmlUrl

.EXAMPLE
Get-RecentSecForm4XmlUrls -CIK "0000789019" | Convert-Form4XmlToRecord
Returns parsed insider transactions for Microsoft Corporation.

.NOTES
Only non-derivative transactions are processed. If the XML cannot be downloaded, a warning is displayed.
#>

function Convert-Form4XmlToRecord {
    [CmdletBinding()]
    param (
        [Parameter(ValueFromPipeline = $true)]
        [pscustomobject]$InputObject
    )

    process {
        $headers = @{
            "User-Agent" = "PowerShellScript/1.0 (eosfor@gmail.com)"
        }

        try {
            [xml]$doc = Invoke-WebRequest -Uri $InputObject.XmlUrl -Headers $headers -UseBasicParsing
        }
        catch {
            Write-Warning "Download failed: $($InputObject.XmlUrl)"
            return
        }

        $issuer = $doc.ownershipDocument.issuer.issuerName
        $owner = $doc.ownershipDocument.reportingOwner.reportingOwnerId.rptOwnerName
        $ownerRelationship = $doc.ownershipDocument.reportingOwner.reportingOwnerRelationship

        # Get all role flags where value is '1'
        $relationshipProps = ($ownerRelationship | Get-Member -MemberType Properties | Where-Object {
            $ownerRelationship.$($_.Name) -eq "1"
        }).Name

        # Join multiple roles if needed
        $relationship = if ($relationshipProps.Count -gt 1) {
            $relationshipProps -join ";"
        } else {
            $relationshipProps
        }

        # Собираем footnotes в хештаблицу
        $footnotes = @{}
        if ($doc.ownershipDocument.footnotes -and $doc.ownershipDocument.footnotes.footnote) {
            $rawFootnotes = $doc.ownershipDocument.footnotes.footnote
            if ($rawFootnotes -is [System.Array]) {
                foreach ($f in $rawFootnotes) {
                    $footnotes[$f.id] = $f.'#text' ?? $f.InnerText
                }
            } else {
                $footnotes[$rawFootnotes.id] = $rawFootnotes.'#text' ?? $rawFootnotes.InnerText
            }
        }

        $transactions = $doc.ownershipDocument.nonDerivativeTable.nonDerivativeTransaction
        foreach ($txn in $transactions) {
            $note = $null
            if ($txn.footnoteId) {
                $ids = if ($txn.footnoteId -is [System.Array]) {
                    $txn.footnoteId | ForEach-Object { $_.id }
                } else {
                    @($txn.footnoteId.id)
                }
                $note = ($ids | ForEach-Object { $footnotes[$_] }) -join "; "
            }

            [PSCustomObject]@{
                FilingDate              = $InputObject.FilingDate
                ReportDate              = $InputObject.ReportDate
                Issuer                  = $issuer
                InsiderName             = $owner
                InsiderRole             = $relationship
                SecurityTitle           = $txn.securityTitle.value
                TransactionDate         = $txn.transactionDate.value
                TransactionCode         = $txn.transactionCoding.transactionCode
                SharesTransacted        = $txn.transactionAmounts.transactionShares.value
                PricePerShare           = $txn.transactionAmounts.transactionPricePerShare.value
                SharesOwnedAfterTxn     = $txn.postTransactionAmounts.sharesOwnedFollowingTransaction.value
                OwnershipType           = $txn.ownershipNature.directOrIndirectOwnership.value
                IndirectOwnershipNature = $txn.ownershipNature.natureOfOwnership.value
                Footnote                = $note
                XmlUrl                  = $InputObject.XmlUrl
            }
        }
    }
}