---
title: Visualizing Azure Permissions and Groups with PowerShell and JS
section: Azure
date: 2025-04-27T20:00:00-07:00
---

```js
import {displayGroupTree} from "./components/displayTree.js";
```

```js
const data = FileAttachment("data/userGroupData.json").json();
const prodPermissionData = FileAttachment("data/prodScopesAndPermissions.json").json();
```

Managing Azure access can quickly become overwhelming: dozens of groups, hundreds of users, thousands of permissions. A simple, dynamic **tree visualization** instantly reveals structure, gaps, and potential risks.

If you can extract it — you can visualize it.

## 🧹 Group Membership View

The first visualization shows **which users belong to which groups**:


```js
displayGroupTree(data, 900)
```

## 🛡️ Permissions View

The second visualization shows **who has what permissions** across resources:

```js
displayGroupTree(prodPermissionData, 900)
```


## 🛠️ How the data is collected

The data is generated with two PowerShell scripts:

- one extracts **group memberships**
- another builds **role assignment relationships** between users, groups, and scopes.

---

<details>
    <summary>Script for pulling information on group memberships</summary>

```pwsh
#Requires -Modules Az, ipmgmt


# prepare data for detailed permissions visualization

$subscriptionDetails = @{}
$currentContext = Get-AzContext

$users = Get-AzADUser
$groups = Get-AzADGroup
$servicePrincipals = Get-AzADServicePrincipal
$applications = Get-AzADApplication

Get-AzSubscription | % {
    Select-AzSubscription -SubscriptionObject $_  | out-null
    $subscriptionDetails[$_.Name] = @{
        users = $users
        groups = $groups
        assignments = Get-AzRoleAssignment
        servicePrincipals = $servicePrincipals
        applications = $applications
    }
}

Set-AzContext -Context $currentContext | out-null

# process data for group membership visualization
$userIndex = @{}

$users | % {
    $userIndex[$_.UserPrincipalName] = $_
}

$rootName = 'groupsRoot'
$rootChildren = $groups | % {
    $g = $_
    $members = Get-AzADGroupMember -GroupObjectId $g.Id -WarningAction Ignore

    $children = @($members | % { [pscustomobject]@{name = $userIndex[$_.UserPrincipalName].DisplayName; value = 1 } })

    [pscustomobject]@{
        name = $g.DisplayName
        children = $children
        value = $children.Count
    }
}

[pscustomobject]@{
    name = $rootName
    children = $rootChildren
    value = 1
} | ConvertTo-Json -Depth 10 | Out-File 'src/data/userGroupData.json' -Force

```
</details>

<details>
<summary>Script for the role assignment visual</summary>

```pwsh
#Requires -Modules Az, ipmgmt

# data processing functions

function generateName($o) {
    if ($o -is [Microsoft.Azure.PowerShell.Cmdlets.Resources.MSGraph.Models.ApiV10.MicrosoftGraphUser]) {
        return "user`:$($o.UserPrincipalName)"
    }

    if ($o -is [Microsoft.Azure.PowerShell.Cmdlets.Resources.MSGraph.Models.ApiV10.MicrosoftGraphGroup]) {
        return "group`:$($o.DisplayName)"
    }

    if ($o -is [Microsoft.Azure.PowerShell.Cmdlets.Resources.MSGraph.Models.ApiV10.MicrosoftGraphServicePrincipal]) {
        return "srvPrincipal`:$($o.DisplayName)"
    }

    if ($o -is [Microsoft.Azure.PowerShell.Cmdlets.Resources.MSGraph.Models.ApiV10.MicrosoftGraphApplication]) {
        return "application`:$($o.DisplayName)"
    }
}

function Get-PermissionDetails {
    param(
        $InputObject, # $groups + $users + $servicePrincipals + $applications
        $SubscriptionName
    )

    $users = $InputObject[$SubscriptionName].users
    $groups = $InputObject[$SubscriptionName].groups
    $assignments = $InputObject[$SubscriptionName].assignments
    $servicePrincipals = $InputObject[$SubscriptionName].servicePrincipals
    $applications = $InputObject[$SubscriptionName].applications

    $rootChildren = @(($users + $groups + $servicePrincipals + $applications) | % {
            $id = $_.id
            $name = generateName $_
            $permissions = $assignments | ?  ObjectId -eq $id  | Group-Object -Property Scope
            $children = $permissions | % {
                $rdNames = $_.Group.RoleDefinitionName | % { @([pscustomobject]@{ name = $_; value = 1; children = @() }) }
                [pscustomobject]@{
                    name     = "scope`:$(($_.Name -split "/")[-1])"
                    children = @($rdNames)
                    value    = @($rdNames).Count
                } }
            $ret = [pscustomobject]@{
                name     = $name
                value    = @($children).Count
                children = @($children) #$children.Count -gt 1 ? $children : "[ $children ]"
            }
            $ret
        })

    [pscustomobject]@{
        name     = $SubscriptionName
        children = @($rootChildren) | ? { $_.value -gt 0 }
        value    = @($rootChildren).Count
    }
}


$subscriptionDetails = @{}
$currentContext = Get-AzContext

$users = Get-AzADUser
$groups = Get-AzADGroup
$servicePrincipals = Get-AzADServicePrincipal
$applications = Get-AzADApplication
$assignments = Get-AzRoleAssignment

Get-AzSubscription | % {
    Select-AzSubscription -SubscriptionObject $_  | out-null
    $subscriptionDetails[$_.Name] = @{
        users = $users
        groups = $groups
        assignments = Get-AzRoleAssignment
        servicePrincipals = $servicePrincipals
        applications = $applications
    }
}

Set-AzContext -Context $currentContext | out-null


# process data
Get-PermissionDetails -InputObject $subscriptionDetails -SubscriptionName 'some-subscription-name' | ConvertTo-Json -Depth 100 | Out-File "src/data/prodScopesAndPermissions.json"

```
</details>

<details>
<summary>JavaScript code for the tree visual, based on d3js</summary>

```js run=false
import * as d3 from "npm:d3";

export function displayGroupTree(data, width = 2500, height = 900) {
    console.log(data); // Display data for debugging

    const root = d3.hierarchy(data);
    const dx = 10;
    const dy = width / (root.height + 1);

    const tree = d3.tree().nodeSize([dx, dy]);

    root.sort((a, b) => d3.ascending(a.data.name, b.data.name));
    tree(root);

    let x0 = Infinity;
    let x1 = -x0;
    root.each(d => {
        if (d.x > x1) x1 = d.x;
        if (d.x < x0) x0 = d.x;
    });

    const margin = 20; // save some space for the last line
    height = x1 - x0 + dx * 2 + margin;

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-dy / 3, x0 - dx - margin / 2, width, height])
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

    // Append a group element to manipulate (for zooming purposes)
    const g = svg.append("g")
        .attr("transform", `translate(${dy / 3},${dx})`);

    const link = g.append("g")
        .attr("fill", "none")
        .attr("stroke", "#555")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(root.links())
        .join("path")
        .attr("d", d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x));

    const node = g.append("g")
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 3)
        .selectAll("g")
        .data(root.descendants())
        .join("g")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    node.append("circle")
        .attr("fill", d => d.children ? "#555" : "#999")
        .attr("r", 2.5);

    node.append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d.children ? -6 : 6)
        .attr("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name)
        .attr("stroke", "white")
        .attr("paint-order", "stroke");

    // Add zooming functionality
    svg.call(d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
    }));

    return svg.node();
}
```
</details>

---

# 🚀 Results

With just two JSON files and a little Observable magic, you can instantly **visualize complex Azure access models** — and finally see how your users, groups, service principals, and role assignments interconnect.

---

# 📋 What's next?

You could extend this setup to:

- Flag overprivileged accounts
- Spot orphaned groups and service principals
- Track changes in permissions over time

---