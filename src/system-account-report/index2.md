---
title: Visualizing Azure Permissions and Groups with PowerShell and Vega
section: Azure
date: 2025-04-28T20:00:00-07:00
---

```js
import * as vega from "vega";
import embed from "vega-embed";
```


Managing Azure access can quickly become overwhelming: dozens of groups, hundreds of users, thousands of permissions. A simple, dynamic **tree visualization** instantly reveals structure, gaps, and potential risks.  
In this post, we’ll explore how to build such a visualization directly inside **.NET Interactive Jupyter Notebooks**, using pure **Vega JSON specs** — no JavaScript coding required.

---

## ✨ Why Vega?

While libraries like `d3.js` offer ultimate flexibility, [**Vega**](https://vega.github.io) provides a declarative way to define powerful, interactive charts using only JSON.  
This makes it ideal for integrating into scripting-heavy environments like PowerShell notebooks.

---

## 📄 Preparing the Data for Visualization

Before we dive into visualizations, let's briefly touch on an important nuance:  
**Vega requires a flat representation of hierarchical data.**

While Azure group memberships or role assignments naturally form a deep tree structure, Vega expects the tree in a **tabular "id → parent" format**.

Otherwise, transforms like `stratify`, `tree`, and `treelinks` won’t know how to connect nodes and generate layout.

Example of what Vega expects:

```json
[
  { "id": "root", "parent": null },
  { "id": "group-A", "parent": "root" },
  { "id": "user-John", "parent": "group-A" },
  { "id": "user-Delenn", "parent": "group-A" }
]
```

To transform Azure data into this format, you can use a simple recursive PowerShell function:

```pwsh
$inputPath = "data/prodScopesAndPermissions.json"
$outputPath = "data/prodScopesAndPermissions_flat.json"

# reding JSON
$tree = Get-Content $inputPath -Raw | ConvertFrom-Json

# init result and ID counter
$flattened = @()
$idCounter = 0

function Flatten-Tree {
    param(
        [Parameter(Mandatory)] $Node,
        [Parameter()] $ParentId,
        [ref] $FlatList,
        [ref] $IdCounter
    )

    # increment ID
    $IdCounter.Value++

    # save current ID
    $currentId = $IdCounter.Value

    $FlatList.Value += [pscustomobject]@{
        id     = $currentId
        name   = $Node.name
        parent = $ParentId
    }

    foreach ($child in $Node.children) {
        Flatten-Tree -Node $child -ParentId $currentId -FlatList $FlatList -IdCounter $IdCounter
    }
}

# Run
Flatten-Tree -Node $tree -FlatList ([ref]$flattened) -IdCounter ([ref]$idCounter)

# Export results
$flattened | ConvertTo-Json -Depth 5 | Out-File $outputPath -Force

Write-Output "Flattened data saved to $outputPath"
```

---

## 🧹 Group Membership View

The first visualization shows **which users belong to which groups**.

Starting from Azure Active Directory, we collect user and group data via PowerShell scripts, transform it into a hierarchical structure, and render it with Vega.

Here’s how to display the **Groups and Members** view:

<details>
    <summary>Vega spec to show groups and user + it's invocation in .NET Interactive Jupyter notebooks with PowerShell</summary>

```pwsh
@"
{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "description": "Groups and Users view.",
  "width": 600,
  "height": 400,
  "padding": 5,
  "signals": [
    {"name": "labels", "value": true, "bind": {"input": "checkbox"}}
  ],
  "data": [
    {
      "name": "tree",
      "url": "permissionsData/userGroupData.json",
      "type": "json",
      "transform": [
        {"type": "stratify", "key": "id", "parentKey": "parent"},
        {
          "type": "tree",
          "method": "tidy",
          "size": [{"signal": "height"}, {"signal": "width - 100"}],
          "separation": "false",
          "as": ["y", "x", "depth", "children"]
        }
      ]
    },
    {
      "name": "links",
      "source": "tree",
      "transform": [
        {"type": "treelinks"},
        {
          "type": "linkpath",
          "orient": "horizontal",
          "shape": "diagonal"
        }
      ]
    }
  ],
  "scales": [
    {
      "name": "color",
      "type": "ordinal",
      "domain": [0, 1, 2],
      "range": ["#5e4fa2", "#3288bd", "#66c2a5"]
    }
  ],
  "marks": [
    {
      "type": "path",
      "from": {"data": "links"},
      "encode": {
        "update": {"path": {"field": "path"}, "stroke": {"value": "#ccc"}}
      }
    },
    {
      "type": "symbol",
      "from": {"data": "tree"},
      "encode": {
        "enter": {"size": {"value": 100}, "stroke": {"value": "#fff"}},
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "fill": {"scale": "color", "field": "depth"}
        }
      }
    },
    {
      "type": "text",
      "from": {"data": "tree"},
      "encode": {
        "enter": {
          "text": {"field": "name"},
          "fontSize": {"value": 9},
          "baseline": {"value": "middle"}
        },
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "dx": {"signal": "datum.children ? -7 : 7"},
          "align": {"signal": "datum.children ? 'right' : 'left'"},
          "opacity": {"signal": "labels ? 1 : 0"}
        }
      }
    }
  ]
}
"@ | Out-Display -MimeType "application/vnd.vega.v5+json"
```
</details>

```js
const url1 = await FileAttachment("data/userGroupData_flat.json").url()
const url2 = await FileAttachment("data/prodScopesAndPermissions_flat.json").url()
```
<div id="my-vega-chart1" style="width: 800px; height: 450px;"></div>

```js
const spec = {
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "description": "An example of Cartesian layouts for a node-link diagram of hierarchical data.",
  "width": 600,
  "height": 400,
  "padding": 5,
  "signals": [
    {"name": "labels", "value": true, "bind": {"input": "checkbox"}}
  ],
  "data": [
    {
      "name": "tree",
      "url": url1,
      "type": "json",
      "transform": [
        {"type": "stratify", "key": "id", "parentKey": "parent"},
        {
          "type": "tree",
          "method": "tidy",
          "size": [{"signal": "height"}, {"signal": "width - 100"}],
          "separation": "false",
          "as": ["y", "x", "depth", "children"]
        }
      ]
    },
    {
      "name": "links",
      "source": "tree",
      "transform": [
        {"type": "treelinks"},
        {
          "type": "linkpath",
          "orient": "horizontal",
          "shape": "diagonal"
        }
      ]
    }
  ],
  "scales": [
    {
      "name": "color",
      "type": "ordinal",
      "domain": [0, 1, 2],
      "range": ["#5e4fa2", "#3288bd", "#66c2a5"]
    }
  ],
  "marks": [
    {
      "type": "path",
      "from": {"data": "links"},
      "encode": {
        "update": {"path": {"field": "path"}, "stroke": {"value": "#ccc"}}
      }
    },
    {
      "type": "symbol",
      "from": {"data": "tree"},
      "encode": {
        "enter": {"size": {"value": 100}, "stroke": {"value": "#fff"}},
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "fill": {"scale": "color", "field": "depth"}
        }
      }
    },
    {
      "type": "text",
      "from": {"data": "tree"},
      "encode": {
        "enter": {
          "text": {"field": "name"},
          "fontSize": {"value": 9},
          "baseline": {"value": "middle"}
        },
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "dx": {"signal": "datum.children ? -7 : 7"},
          "align": {"signal": "datum.children ? 'right' : 'left'"},
          "opacity": {"signal": "labels ? 1 : 0"}
        }
      }
    }
  ]
};

embed("#my-vega-chart1", spec);
```
---

## 🛡️ Permissions View

The second visualization reveals **which users, groups, and service principals** have specific permissions across Azure resources.

<details>
    <summary>Vega spec to show Group and User Permissions + it's invocation in a notebook with PowerShell</summary>

```pwsh
@"
{
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "description": "User and Group Permissions.",
  "width": 600,
  "height": 1200,
  "padding": 5,
  "signals": [
    {"name": "labels", "value": true, "bind": {"input": "checkbox"}}
  ],
  "data": [
    {
      "name": "tree",
      "url": "permissionsData/prodScopesAndPermissions.json",
      "type": "json",
      "transform": [
        {"type": "stratify", "key": "id", "parentKey": "parent"},
        {
          "type": "tree",
          "method": "tidy",
          "size": [{"signal": "height"}, {"signal": "width - 100"}],
          "separation": "false",
          "as": ["y", "x", "depth", "children"]
        }
      ]
    },
    {
      "name": "links",
      "source": "tree",
      "transform": [
        {"type": "treelinks"},
        {
          "type": "linkpath",
          "orient": "horizontal",
          "shape": "diagonal"
        }
      ]
    }
  ],
  "scales": [
    {
      "name": "color",
      "type": "ordinal",
      "domain": [0, 1, 2],
      "range": ["#5e4fa2", "#3288bd", "#66c2a5"]
    }
  ],
  "marks": [
    {
      "type": "path",
      "from": {"data": "links"},
      "encode": {
        "update": {"path": {"field": "path"}, "stroke": {"value": "#ccc"}}
      }
    },
    {
      "type": "symbol",
      "from": {"data": "tree"},
      "encode": {
        "enter": {"size": {"value": 100}, "stroke": {"value": "#fff"}},
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "fill": {"scale": "color", "field": "depth"}
        }
      }
    },
    {
      "type": "text",
      "from": {"data": "tree"},
      "encode": {
        "enter": {
          "text": {"field": "name"},
          "fontSize": {"value": 9},
          "baseline": {"value": "middle"}
        },
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "dx": {"signal": "datum.children ? -7 : 7"},
          "align": {"signal": "datum.children ? 'right' : 'left'"},
          "opacity": {"signal": "labels ? 1 : 0"}
        }
      }
    }
  ]
}
"@ | Out-Display -MimeType "application/vnd.vega.v5+json"
```

</details>

<div id="my-vega-chart2" style="width: 800px; height: 600px;"></div>

```js
const spec2 = {
  "$schema": "https://vega.github.io/schema/vega/v5.json",
  "description": "An example of Cartesian layouts for a node-link diagram of hierarchical data.",
  "width": 700,
  "height": 1100,
  "padding": 5,
  "signals": [
    {"name": "labels", "value": true, "bind": {"input": "checkbox"}}
  ],
  "data": [
    {
      "name": "tree",
      "url": url2,
      "type": "json",
      "transform": [
        {"type": "stratify", "key": "id", "parentKey": "parent"},
        {
          "type": "tree",
          "method": "tidy",
          "size": [{"signal": "height"}, {"signal": "width - 100"}],
          "separation": "false",
          "as": ["y", "x", "depth", "children"]
        }
      ]
    },
    {
      "name": "links",
      "source": "tree",
      "transform": [
        {"type": "treelinks"},
        {
          "type": "linkpath",
          "orient": "horizontal",
          "shape": "diagonal"
        }
      ]
    }
  ],
  "scales": [
    {
      "name": "color",
      "type": "ordinal",
      "domain": [0, 1, 2],
      "range": ["#5e4fa2", "#3288bd", "#66c2a5"]
    }
  ],
  "marks": [
    {
      "type": "path",
      "from": {"data": "links"},
      "encode": {
        "update": {"path": {"field": "path"}, "stroke": {"value": "#ccc"}}
      }
    },
    {
      "type": "symbol",
      "from": {"data": "tree"},
      "encode": {
        "enter": {"size": {"value": 100}, "stroke": {"value": "#fff"}},
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "fill": {"scale": "color", "field": "depth"}
        }
      }
    },
    {
      "type": "text",
      "from": {"data": "tree"},
      "encode": {
        "enter": {
          "text": {"field": "name"},
          "fontSize": {"value": 9},
          "baseline": {"value": "middle"}
        },
        "update": {
          "x": {"field": "x"},
          "y": {"field": "y"},
          "dx": {"signal": "datum.children ? -7 : 7"},
          "align": {"signal": "datum.children ? 'right' : 'left'"},
          "opacity": {"signal": "labels ? 1 : 0"}
        }
      }
    }
  ]
};

embed("#my-vega-chart2", spec2);
```
---

## 🚀 Results

With just two JSON files and a little Observable or .NET Interactive magic, you can instantly **visualize complex Azure access models** — and finally see how your users, groups, service principals, and role assignments interconnect.

---

## 📋 What's next?

You could extend this setup to:

- Flag overprivileged accounts
- Spot orphaned groups and service principals
- Track changes in permissions over time
- Build role-based security reviews

---

Basically, if you can extract the data — you can visualize it.

And as usual for notebooks, you can open them in a Github Codespace and try them out:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/eosfor/scripting-notes)

Good luck! 🚀

---