---
title: Counting Other People`s Money with PowerShell
date: 2025-04-20T18:39:14-07:00
section: PowerShell
---

```js
const isMobile = window.matchMedia("(max-width: 767px)").matches;

document.querySelectorAll('.observablehq-pre-container').forEach(el => {
  const pre = el.querySelector("pre");
  if (!pre) return;

  const lineCount = pre.innerText.split("\n").length;

  const shouldCollapse = isMobile || lineCount > 20;
  if (!shouldCollapse) return;

  const wrapper = document.createElement('details');
  wrapper.style.marginBottom = "1rem"; // чтобы не слипалось
  wrapper.open = false;

  const summary = document.createElement('summary');
  summary.textContent = isMobile
    ? `code 📱`
    : `code (${lineCount} lines) 👀`;

  wrapper.appendChild(summary);
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);
});
```

```js
const allData = await FileAttachment("allData.csv").csv()
const uniqueCompanies = [...new Set(allData.map(d => d.Issuer))];

const data1 = await FileAttachment("data1.csv").csv()
const data2 = await FileAttachment("data2.csv").csv()
const data3 = await FileAttachment("data3.csv").csv()
```

You thought PowerShell was just for managing servers? Think again! Today, we`re going to engage in a noble pursuit: **counting other people’s money**. And not just anywhere — we’re diving into the official filings of the U.S. Securities and Exchange Commission (SEC). All from the comfort of the console, with a splash of [Vega](https://vega.github.io) and a hint of analytical mischief.

Our target of curiosity: Form 4, where corporate big shots report their stock transactions:
- Sold something? Gotta report it.
- Gifted shares to the spouse? Still report it.
- Got a bonus in shares? Even if it’s “just a thank you” — report it!

Why do we care? Well… we’re just curious who dumped their shares right before the price tanked 😉

## Pulling data

To do this, we`ll need two trusty PowerShell functions:
- **Get-RecentSecForm4XmlUrls** — our investigator, crawling through the SEC archives to extract URLs to XML filings.
- **Convert-Form4XmlToRecord** — parses the XML and turns it into a proper PowerShell object. Because reading raw XML? Painful. Let the script suffer.

```powershell echo
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
```

📥 Let's fire up our surveillance script and stash the data in a variable named `$allData`. Think of it as “doing a background check,” but legally.

```pwsh
# you can put your CIK here :)
$CIKs = "0000789019", "0000320193", "0001318605", "0001288776", "0001352010" # who is that?
$allData = $CIKs | % { Get-RecentSecForm4XmlUrls -CIK $_  -DaysBack ((Get-Date).DayOfYear) } | Convert-Form4XmlToRecord
```

🧹 Next step — let's clean house. We only care about transactions where money actually moved. If the number of shares is 0 — skip it. We`re here for the real million-dollar moves (or at least a few solid trades).

```pwsh
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
```

🔧 Almost forgot! To make all this work smoothly, we had to contribute a little something to dotnet/interactive. Why? Because the CustomMimeType parameter in Out-Display was… well, kind of there but not really working. Now it works — JSON specs right from the notebook cell, beautiful charts and all. Feel free to thank the author of [PR #3671](https://github.com/dotnet/interactive/pull/3671), and that's, actually, me 😉

## Scatter plot

To make it more fun, we can also add a bit of interactivity to this page :)

```js
const companySelected = view(Inputs.select(uniqueCompanies, {value: "MICROSOFT CORP"}));
```

📈 Scatter Plot — our first visual interrogation:
- X — transaction date
- Y — number of shares
- Color — green (buy) or red (sell)
- Tooltip — who, when, how much, and the SEC code letter

A quick way to spot who knew what and sold just in time 💸

```js
const filteredData1 = data1.filter(d => d.Issuer === companySelected)
```

```js

const chart = await vl.render({
spec:{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Insider Trading Scatter Plot",
  "data": {
    "values" : filteredData1
  },
  "mark": "point",
  "encoding": {
    "x": {
      "field": "TransactionDate",
      "type": "temporal",
      "title": "Transaction Date"
    },
    "y": {
      "field": "SharesTransacted",
      "type": "quantitative",
      "title": "Shares Transacted"
    },
    "color": {
      "field": "Action",
      "type": "nominal",
      "scale": {
        "domain": ["Buy", "Sell"],
        "range": ["green", "red"]
      },
      "title": "Transaction Type"
    },
    "tooltip": [
      {"field": "TransactionDate", "type": "temporal", "title": "Date"},
      {"field": "SharesTransacted", "type": "quantitative", "title": "Shares"},
      {"field": "TransactionCode", "type": "nominal", "title": "Code"}
    ]
  }
}
});

display(chart)
```

## Heat map

🔥 Heatmap — follow the heat to find the insiders:
- X — transaction type
- Y — insider
- Color — green if we know the amount, gray if unknown
- Tooltip — how many trades, shares, and how much total value

Anyone can make mistakes — but heatmaps? They never lie. 💼

```js
const filteredData2 = data2.filter(d => d.Issuer === companySelected)
```

<div class="grid grid-cols-2">
  <div class="card">

 ```js
const chart2 = await vl.render({
spec:{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Heatmap of Insider Transaction Totals",
  "data": {
    "values": filteredData2
  },
  "mark": "rect",
  "encoding": {
    "x": {
      "field": "TransactionCode",
      "type": "nominal",
      "title": "Transaction Type"
    },
    "y": {
      "field": "Insider",
      "type": "nominal",
      "title": "Insider",
      "sort": "-x"
    },
    "color": {
      "condition": {
        "test": "isValid(datum.TotalValue) && datum.TotalValue != ''",
        "field": "TotalValue",
        "type": "quantitative",
        "scale": { "scheme": "greens" }
      },
      "value": "#eeeeee"
    },
    "tooltip": [
      { "field": "Insider", "type": "nominal", "title": "Insider" },
      { "field": "TransactionCode", "type": "nominal", "title": "Transaction Code" },
      { "field": "Count", "type": "quantitative", "title": "Number of Trades" },
      { "field": "TotalShares", "type": "quantitative", "title": "Total Shares" },
      { "field": "TotalValueDisplay", "type": "nominal", "title": "Total Value ($)" }
    ]
  },
  "config": {
    "axis": {
      "labelFontSize": 10,
      "titleFontSize": 12
    },
    "view": {
      "stroke": "transparent"
    }
  }
}
});

display(chart2);
``` 
  
  </div>
  <div class="card">
  
  🔍 `TransactionCode` meaning

| Code | What it means       | How to interpret it                                                   |
|------|----------------------|------------------------------------------------------------------------|
| A    | Award                | Shares granted, usually a bonus. Like a gift card, but in stock.      |
| S    | Sale                 | Sold shares. Sometimes en masse. Often... right before a price drop.  |
| F    | Tax                  | Shares withheld to pay taxes. At least they didn’t keep those.        |
| M    | Option Exercise      | Exercised an option. Buy low, sell high — the corporate dream.        |
| G    | Gift                 | Given away. To family. Or a trust. Or a charity. No judgment here.    |
| P    | Purchase             | Bought shares. With their own money. Respect.                         |
| I    | Discretionary        | Auto-trade via plan. Legit? Depends who you ask.                      |
| C    | Conversion           | Transformed derivatives into common shares. Totally by the book.      |
  
  </div>
</div>

## Bubble chart

🔵 Bubble Chart — where every bubble is a trade, and size shows how big it was. The bigger the bubble — the juicier the deal:
- X — date
- Y — who
- Size — number of shares
- Color — transaction type
- Tooltip — all the dirty details

Makes it pretty obvious who burst the greed bubble first 😄

```js
const filteredData3 = data3.filter(d => d.Issuer === companySelected)
display(filteredData3)
```


```js
const chart3 = await vl.render({
spec:{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Bubble Chart: Insider vs Date vs Transaction Type",
  "data": {
    "values": filteredData3
  },
  "transform": [
    {
      "lookup": "TransactionCode",
      "from": {
        "data": {
          "values": [
            { "code": "A", "label": "Award" },
            { "code": "S", "label": "Sale" },
            { "code": "F", "label": "Tax" },
            { "code": "M", "label": "Exercise" },
            { "code": "G", "label": "Gift" },
            { "code": "P", "label": "Purchase" },
            { "code": "I", "label": "Discretionary" },
            { "code": "C", "label": "Conversion" }
          ]
        },
        "key": "code",
        "fields": ["label"]
      },
      "default": "Unknown"
    }
  ],
  "mark": {
    "type": "circle",
    "opacity": 0.7
  },
  "encoding": {
    "x": {
      "field": "TransactionDate",
      "type": "temporal",
      "title": "Transaction Date"
    },
    "y": {
      "field": "Insider",
      "type": "nominal",
      "title": "Insider",
      "sort": "-x"
    },
    "color": {
      "field": "label",
      "type": "nominal",
      "title": "Transaction Type"
    },
    "size": {
      "field": "SharesTransacted",
      "type": "quantitative",
      "title": "Shares Transacted"
    },
    "tooltip": [
      { "field": "Insider", "type": "nominal", "title": "Insider" },
      { "field": "TransactionDate", "type": "temporal", "title": "Date" },
      { "field": "TransactionCode", "type": "nominal", "title": "Transaction Code" },
      { "field": "SharesTransacted", "type": "quantitative", "title": "Shares Transacted" },
      { "field": "TotalValueDisplay", "type": "nominal", "title": "Total Value ($)" }
    ]
  },
  "config": {
    "axis": {
      "labelFontSize": 10,
      "titleFontSize": 12
    },
    "legend": {
      "labelFontSize": 10,
      "titleFontSize": 12
    },
    "view": {
      "stroke": "transparent"
    }
  }
}
});

display(chart3)
```