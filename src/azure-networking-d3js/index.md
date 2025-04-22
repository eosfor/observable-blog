---
title: 'Visualizing Azure Networking using D3js'
date: 2024-04-29T16:26:08-07:00
section: Azure
---

A picture worth a thousand words. When you work with a complex networking infrastructure, it would be great to have a bird's-eye view of it. In this article, I want to discuss how this can be achieved using PowerShell, Jupyter notebooks, and [d3js](https://d3js.org/)

We are already familiar with the .NET Interactive kernel and Jupyter notebooks. Now, we want to introduce a new tool - [d3js](https://d3js.org/). In a few words, it is a powerful visualization framework for JS. Among other features, it can help visualize graph and network structures using a force-aware algorithm. Basically, what we need to do is to build our own graph of dependencies between various networking elements, and then transform this data in such a way that it can be consumed by d3js.

First thing we are going to do is to use the preview version of the [PSQuickGraph](https://www.powershellgallery.com/packages/PSQuickGraph/1.1) module, which lets us generate graph structures dynamically.

```powershell
Install-Module -Name PSQuickGraph -AllowPrerelease -RequiredVersion "2.0.2-alpha"
Import-Module PSQuickGraph -RequiredVersion "2.0.2"
```

Now we can initialize the graph and collect our networking elements from Azure

```powershell
$g = New-Graph

# pull necessary data
$vnets = Get-AzVirtualNetwork
$nics = Get-AzNetworkInterface
```

Next, we need to process our data and build a graph out of it. We basically scan our `$vnets` and `$nics` arrays, add their elements as vertices and connect them with directed edges, when they are related: VNETs include Subnets, and NICs are attached to Subnets.

```powershell
# add vnets and peerings to the graph
$vnets | ForEach-Object {
    $currentVnet = $_
    $vnetVertex = [PSGraph.Model.PSVertex]::new($currentVnet.Id, $currentVnet)
    Add-Vertex -Graph $g -Vertex $vnetVertex
    $currentVnet.Subnets | % {
        $currentSubnet = $_
        $subnetVertex = [PSGraph.Model.PSVertex]::new($currentSubnet.Id, $currentSubnet)
        Add-Edge -Graph $g -From $vnetVertex -To $subnetVertex
    }
}

foreach ($v in $g.Vertices){
    foreach($p in $v.OriginalObject.VirtualNetworkPeerings) {
        foreach ($rvn in $p.RemoteVirtualNetwork) {
            $targetVertex = $g.Vertices.Where({$_.Label -eq $rvn.id})[0]
            Add-Edge -From $v -To $targetVertex -Graph $g
        }
    }
}

# add NICs to the graph
$nics | ForEach-Object {
    $vnetID = $_.IpConfigurations[0].Subnet.Id
    $targetVertex = $g.Vertices.Where({$_.Label -eq $vnetID})[0]
    Add-Edge -Graph $g -From ([PSGraph.Model.PSVertex]::new($_.name, $_)) -To $targetVertex
}

```

At this point we want to use a bit of JS and D3 magic, to visualize the graph. The JS piece adds a few nice UI features, like a list of elements, so we can search for a specific node in a graph, or highlight a node and other directly connected nodes when clicked.

This is how it looks like:

```js
const srcnodes = await FileAttachment("./data/idList.json").json();
const srclinks = await FileAttachment("./data/linkList.json").json();
display(srcnodes)
display(srclinks)
```

```js
function drag(simulation) {

  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
}
```


```js
const width = 800;
const height = 1000;
const color = d3.scaleOrdinal(d3.schemeObservable10);

// Copy the data to protect against mutation by d3.forceSimulation.
const links = srclinks.map((d) => Object.create(d));
const nodes = srcnodes.map((d) => Object.create(d));

// Create a simulation for the nodes with several forces.
const linkForce = d3.forceLink(links).id(d => d.id).distance(50).strength(1);
const chargeForce = d3.forceManyBody().strength(-100);
const centerForce = d3.forceCenter(width / 2, height / 2);
const collideForce = d3.forceCollide().radius(d => d.radius).iterations(2);

const simulation = d3.forceSimulation(nodes)
    .force("link", linkForce)
    .force("charge", chargeForce)
    .force("center", centerForce)
    .force("collide", collideForce)
    .on("tick", ticked)

const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto;");

const link = svg.append("g")
    .attr("stroke", "var(--theme-foreground-faint)")
    .attr("stroke-opacity", 0.6)
  .selectAll("line")
  .data(links)
  .join("line")
    .attr("stroke-width", (d) => Math.sqrt(d.value));

const node = svg.append("g")
    .attr("stroke", "var(--theme-background)")
    .attr("stroke-width", 1.5)
  .selectAll("circle")
  .data(nodes)
  .join("circle")
    .attr("r", 5)
    .attr("fill", (d) => d.color)
    .call(drag(simulation));

node.append("title")
    .text((d) => d.id);

function ticked() {
  link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

  node
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y);
}

display(svg.node());
```


You can see the whole thing in a ready-to use [jupyter notebook](https://github.com/eosfor/scripting-notes/blob/main/notebooks/en/vnet-topology-visualization-d3js.ipynb).

# Watch this demo

Here’s a short video showing how to interact with the graph.

<iframe 
  width="560" 
  height="315" 
  src="https://www.youtube.com/embed/qnWar8mPbfg" 
  title="Visualizing Traffic Flow through Azure Firewall Using PowerShell, Jupyter, and d3js" 
  frameborder="0" 
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
  allowfullscreen>
</iframe>