---
title: Counting Other People`s Money with PowerShell
toc: true
---

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

📥 Let's fire up our surveillance script and stash the data in a variable named $allData. Think of it as “doing a background check,” but legally.

```pwsh echo
# you can put your CIK here :)
$allData = Get-RecentSecForm4XmlUrls -CIK "0000789019" ` # who is that?
    -DaysBack 107 | Convert-Form4XmlToRecord
```

🧹 Next step — let's clean house. We only care about transactions where money actually moved. If the number of shares is 0 — skip it. We`re here for the real million-dollar moves (or at least a few solid trades).

```pwsh echo
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

📈 Scatter Plot — our first visual interrogation:
- X — transaction date
- Y — number of shares
- Color — green (buy) or red (sell)
- Tooltip — who, when, how much, and the SEC code letter

A quick way to spot who knew what and sold just in time 💸

```js
const data = await FileAttachment("data1.csv").url()
const chart = await vl.render({
spec:{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Insider Trading Scatter Plot",
  "data": {
    "url": data,
    "format": {type: "csv"}
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

<div class="grid grid-cols-2">
  <div class="card">

 ```js
const data2 = await FileAttachment("data2.csv").url()
const chart2 = await vl.render({
spec:{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Heatmap of Insider Transaction Totals",
  "data": {
    "url": data2,
    "format": {"type": "csv"}
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
const data3 = await FileAttachment("data3.csv").url()
const chart3 = await vl.render({
spec:{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Bubble Chart: Insider vs Date vs Transaction Type",
  "data": {
    "url": data3,
    "format": { "type": "csv" }
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