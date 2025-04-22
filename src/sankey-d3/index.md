---
title: 'Visualizing Traffic Flow through Azure Firewall Using PowerShell, Jupyter, and d3js'
date: 2024-05-02T21:36:03-07:00
section: Azure
---

Hello again. This time, let's look at how to visualize traffic flowing through Azure Firewall using PowerShell, Jupyter, and D3.js.

Actually, it's relatively straightforward. As usual, we just need to extract data from Azure, prepare it, and "feed" it to the JavaScript library. The first part is very simple. We send a request to Log Analytics, and that's it. It contains all the necessary data.

```powershell
$query = @"
AZFWApplicationRule | where TimeGenerated >= $dateFilter
"@

$data = Invoke-AzOperationalInsightsQuery -WorkspaceId $WorkspaceID -Query $query -ErrorAction Stop | Select-Object -ExpandProperty Results

$sourceIpGroups = $data | Group-Object SourceIp

$dataSet = 
foreach ($group in $sourceIpGroups) {
    $source = $group.Name
    $targets = $group.Group | Group-Object DestinationIp, Action

    foreach($target in $targets) {
        [PSCustomObject]@{
            source = $source;
            sourceName = $source
            target = $target.Group[0].DestinationIp
            action = $target.Group[0].Action
            value = $target.Count
        }
    }
}
```

Now, the transformation part. Data for the library should be approximately in this format. It's simply a list of vertices and a list of edges, with an additional attribute - `value`. The attribute contains the "weight" of the edge, actually some value showing the "strength" of the connection.

```json
{
    "nodes": [
        {
            "name": "Agricultural 'waste'"
        },
        {
            "name": "Bio-conversion"
        },
        {
            "name": "Liquid"
        },
        {
            "name": "Losses"
        }
    ],
    "links": [
        {
            "source": 0,
            "target": 1,
            "value": 124.729
        },
        {
            "source": 1,
            "target": 2,
            "value": 0.597
        },
        {
            "source": 1,
            "target": 3,
            "value": 26.862
        },
        {
            "source": 1,
            "target": 4,
            "value": 280.322
        }
    ]
}
```

Thus, we need to transform our data into this form:

```powershell
$nodes = ($data.source + $data.target) | Select-Object -Unique

$links = $data | % {
    [pscustomobject]@{
        source = $nodes.IndexOf($_.source)
        target = $nodes.IndexOf($_.target)
        value = $_.value
    }
}

[pscustomobject]@{
    nodes = $nodes | % { [pscustomobject]@{name = $_} }
    links = $links
} | ConvertTo-Json -Depth 10 | out-file "traffic-data/data.json"
```

Here we simply combine the list of sources and destinations of traffic into a single list of vertices, remove non-unique entries. Then we form a list of connections in the format we need, and combine these two lists into a single object. And we export the result in json.
Finally, we can read this file in JavaScript and, without much ado, visualize it.

```js run=false
const width = 800;
const height = 2000;

var data = await d3f.json("traffic-data/data.json");

// Create the SVG container.
const svg = d3.select('#graph-container')
    .append('svg')
    .attr("width", width)
    .attr("height", height)
    .call(d3.zoom().on("zoom", (event) => {
        svg.attr("transform", event.transform);
    }))
    .append("g");

drawSankey();

function drawSankey() {
    var sankey = d3sa.sankey()
        .nodeAlign(d3sa.sankeyLeft)
        .nodeWidth(20)
        .nodePadding(20)
        .extent([[1, 50], [width - 1, height - 5]]);
    
    var graph = sankey(data)

    const color = d3.scaleOrdinal(d3.schemeSet3);

    // Drawing nodes
    const rect = svg.append("g")
        .attr("stroke", "#000")
        .selectAll

("rect")
        .data(graph.nodes)
        .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0 >= 3 ? d.y1 - d.y0 : 3)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => color(d.name));
    
    rect.append("title")
        .text(d => `${d.name}\n${d.targetLinks.length > 0 ? d.targetLinks.map(o => o.source.name).join("\n") : ""}`);

    // Creating gradients for links
    const defs = svg.append("defs");
    graph.links.forEach((link, i) => {
        gradient = defs.append("linearGradient")
            .attr("id", "gradient" + i)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", link.source.x1)
            .attr("x2", link.target.x0);

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", color(link.source.name));

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", color(link.target.name));
    });

    // Drawing links with gradient
    svg.append("g")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.5)
        .selectAll("path")
        .data(graph.links)
        .join("path")
        .attr("d", d3sa.sankeyLinkHorizontal())
        .attr("stroke", (d, i) => `url(#gradient${i})`)
        .attr("stroke-width", d => Math.max 1, d.width))
        .append("title")
        .text(d => `${d.source.name} → ${d.target.name}`);

    // Drawing labels for the nodes
    svg.append("g")
        .selectAll("text")
        .data(graph.nodes)
        .join("text")
        .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
        .attr("font-size", "15px")
        .text(d => d.name);
}
```

The result is approximately as follows:

```js
// Загрузка данных
const data = await FileAttachment("./data/data.json").json(); //await d3.json("./data/data.json");
display(data)
```

```js
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
const width = 600;
const height = 2000;

// Создание SVG
const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto;");

// Добавляем <g> с трансформом для масштабирования
const g = svg.append("g");

svg.call(d3.zoom().on("zoom", (event) => {
    g.attr("transform", event.transform);
}));

drawSankey();

function drawSankey() {
    const mySankey = sankey()
        .nodeWidth(20)
        .nodePadding(20)
        .extent([[1, 50], [width - 1, height - 5]]);

    const graph = mySankey(data);
    const color = d3.scaleOrdinal(d3.schemeSet3);

    // Рисуем узлы
    const rect = g.append("g")
        .attr("stroke", "#000")
        .selectAll("rect")
        .data(graph.nodes)
        .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => Math.max(3, d.y1 - d.y0))
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => color(d.name));

    rect.append("title")
        .text(d =>
            `${d.name}\n` +
            (d.targetLinks.length > 0
                ? d.targetLinks.map(o => o.source.name).join("\n")
                : "")
        );

    // Градиенты для связей
    const defs = g.append("defs");
    graph.links.forEach((link, i) => {
        const gradient = defs.append("linearGradient")
            .attr("id", "gradient" + i)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", link.source.x1)
            .attr("x2", link.target.x0);

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", color(link.source.name));

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", color(link.target.name));
    });

    // Связи
    g.append("g")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.5)
        .selectAll("path")
        .data(graph.links)
        .join("path")
        .attr("d", sankeyLinkHorizontal())
        .attr("stroke", (d, i) => `url(#gradient${i})`)
        .attr("stroke-width", d => Math.max(1, d.width))
        .append("title")
        .text(d => `${d.source.name} → ${d.target.name}`);

    // Подписи узлов
    g.append("g")
        .selectAll("text")
        .data(graph.nodes)
        .join("text")
        .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
        .attr("font-size", "15px")
        .text(d => d.name);
}

display(svg.node());
```

You can see the whole thing in a ready-to use [jupyter notebook](https://github.com/eosfor/scripting-notes/blob/main/notebooks/en/traffic-through-AzureFW-d3js.ipynb).


# Watch this demo

Here’s a short video showing how to interact with the graph.

<iframe 
  width="560" 
  height="315" 
  src="https://www.youtube.com/embed/0RDeLdTq4Is" 
  title="Visualizing Traffic Flow through Azure Firewall Using PowerShell, Jupyter, and d3js" 
  frameborder="0" 
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
  allowfullscreen>
</iframe>