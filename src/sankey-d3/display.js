const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const d3co = await import("https://cdn.jsdelivr.net/npm/d3-color@3.1.0/+esm");
const d3a = await import("https://cdn.jsdelivr.net/npm/d3-array@3.2.4/+esm");
const d3c = await import("https://cdn.jsdelivr.net/npm/d3-collection@1.0.7/+esm");
const d3p = await import("https://cdn.jsdelivr.net/npm/d3-path@3.1.0/+esm")
const d3sh = await import("https://cdn.jsdelivr.net/npm/d3-shape@3.2.0/+esm");
const d3sa = await import("https://cdn.jsdelivr.net/npm/d3-sankey@0/+esm");
const d3f = await import("https://cdn.jsdelivr.net/npm/d3-fetch@3.0.1/+esm");


const width = 1000;
const height = 2000;

var data = await d3f.json("data/data.json");

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
        .selectAll("rect")
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

    // Drawing links with gradient
    svg.append("g")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.5)
        .selectAll("path")
        .data(graph.links)
        .join("path")
        .attr("d", d3sa.sankeyLinkHorizontal())
        .attr("stroke", (d, i) => `url(#gradient${i})`)
        .attr("stroke-width", d => Math.max(1, d.width))
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
