const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const d3c = await import("https://cdn.jsdelivr.net/npm/d3-color@3.1.0/+esm");
const d3f = await import("https://cdn.jsdelivr.net/npm/d3-fetch@3.0.1/+esm");

const height = 800;
const width = 1000;

let currentPage = 1;
const itemsPerPage = 10;  // You can adjust the number of items per page

let currentFilter = "";

// Specify the color scale.
//const color = d3.scaleOrdinal(d3.schemeCategory10);

const psNodes = await d3f.json("data/idList.json");
const psLinks = await d3f.json("data/linkList.json");


// The force simulation mutates links and nodes, so create a copy
// so that re-evaluating this cell produces the same result.
const links = psLinks.map(d => ({ ...d }));
const nodes = psNodes.map(d => ({ ...d }));

renderNodeList();

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
    .on("end", () => console.log("Simulation ended."));


// Create the SVG container.
const svg = d3.select('#graph-container')
    .append('svg')
    .attr("width", width)
    .attr("height", height)
    .call(d3.zoom().on("zoom", (event) => {
        svg.attr("transform", event.transform);
    }))
    .append("g");

// Add a line for each link.
const link = svg.append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", d => Math.sqrt(d.value));

// Append a group for each node which will contain the circle and text
// Keep track of the currently selected node
let selectedNode = null;

// Append a group for each node which will contain the circle and text
const node = svg.append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
    .on("click", nodeClicked);  // Add the click event listener

// Append circles for each node
node.append("circle")
    .attr("r", d => d.radius)
    .attr("fill", d => d.color)
    .attr("data-node-id", d => d.id);  // Ensure this attribute is set;


// Append the text labels
// Since we want to add the background rectangles before the text, we need to insert them first
node.each(function (d) {
    const node = d3.select(this);
    const rect = node.append("rect")
        .style("fill", "white")
        .style("opacity", 0.7); // The opacity makes the label background semi-transparent

    const text = node.append("text")
        .style("display", "none")
        .attr("x", d.radius + 3)
        .attr("y", ".35em")
        .style("font-size", "12px")
        .style("font-family", "Arial, sans-serif")
        .text(d.displayName)
        .style("pointer-events", "none")
        .style("fill", "black")
        .style("stroke", "black") // Ensuring the fill is set to black
        .attr("data-node-id", d => d.id);

    // Now, set the attributes for the rectangle to properly surround the text
    rect.attr("x", -8)
        .attr("y", -text.node().getBBox().height / 2)
        .attr("width", text.node().getBBox().width + 16) // Adding padding around the text
        .attr("height", text.node().getBBox().height);
});

// Set the position attributes of links and nodes each time the simulation ticks.
function ticked() {
    // Update the link positions
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    // Update the node positions
    node
        .attr("transform", d => `translate(${d.x},${d.y})`);
}

// Reheat the simulation when drag starts, and fix the subject position.
function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

// Update the subject (dragged node) position during drag.
function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

// Restore the target alpha so the simulation cools after dragging ends.
// Unfix the subject position now that it's no longer being dragged.
function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
}

function nodeClicked(event, d) {
    // If the same node is clicked again, hide the labels and clear the selection
    if (selectedNode === d) {
        node.selectAll("text").style("display", "none");
        selectedNode = null;
    } else {
        // Hide all labels
        node.selectAll("text").style("display", "none");

        // Update the selection to the new node
        selectedNode = d;

        // Show the label for the selected node
        d3.select(event.currentTarget).select("text").style("display", "block");

        // Show labels for all adjacent nodes
        links.forEach(link => {
            if (link.source === d || link.target === d) {
                let targetNode = link.source === d ? link.target : link.source;
                d3.select(node.nodes()[targetNode.index]).select("text").style("display", "block");
            }
        });
    }
}

function showLabelsForSelectedNode(d) {
    // Find and display labels for all adjacent nodes
    links.forEach(link => {
        if (link.source === d) {
            d3.select(node.nodes()[link.target.index]).select("text").style("display", "block");
        } else if (link.target === d) {
            d3.select(node.nodes()[link.source.index]).select("text").style("display", "block");
        }
    });
}

function highlightNode(node) {
    // Increase the node's radius and show the label
    svg.selectAll("circle")
        .filter(d => d.id === node.id)
        .attr("r", node.radius * 1.5); // Increase radius by 50%

    svg.selectAll("text")
        .filter(d => d.id === node.id)
        .style("display", "block");
}

function unhighlightNode(node) {
    // Reset the node's radius and hide the label
    svg.selectAll("circle")
        .filter(d => d.id === node.id)
        .attr("r", node.radius);

    svg.selectAll("text")
        .filter(d => d.id === node.id)
        .style("display", "none");
}

// Function to update the list based on the filter
function updateList() {
    const searchTerm = d3.select("#filter-input").property("value").toLowerCase();
    d3.selectAll("#node-list li")
        .style("display", function (d) {
            // Display the list item only if it includes the search term
            return d.displayName.toLowerCase().includes(searchTerm) ? "" : "none";
        });
}

function highlightNodeAndAdjacents(d) {
    // Reset all nodes to default appearance
    d3.selectAll("circle")
        .style("stroke", null)
        .style("fill", d => d.color)
        .attr("r", d => d.radius);

    d3.selectAll("text").style("display", "none");  // Hide all labels

    // Highlight the hovered node by changing its color and size
    d3.select(`circle[data-node-id="${d.id}"]`)
        .style("fill", "red")  // Change color to red
        .style("stroke", "orange")
        .attr("r", d.radius * 1.5);  // Increase the radius
    d3.select(`text[data-node-id="${d.id}"]`).style("display", "block");

    // Highlight and show labels for adjacent nodes
    links.forEach(link => {
        if (link.source.id === d.id || link.target.id === d.id) {
            let targetNode = link.source.id === d.id ? link.target : link.source;
            d3.select(`circle[data-node-id="${targetNode.id}"]`)
                .style("stroke", "orange")
                .attr("r", targetNode.radius * 1.2);  // Slightly increase the radius
            d3.select(`text[data-node-id="${targetNode.id}"]`).style("display", "block");
        }
    });
}


function unhighlightAllNodes() {
    // Reset all nodes to their default appearance
    d3.selectAll("circle")
        .style("stroke", null)
        .attr("r", d => d.radius);
    d3.selectAll("text").style("display", "none");
}

// Function to update the page
function updatePage(page) {
    currentPage = page;
    renderNodeList();
}

// Function to calculate total pages
function totalPages() {
    return Math.ceil(nodes.length / itemsPerPage);
}

// Binding the hover events in the renderNodeList function
function renderNodeList() {
    const filteredNodes = nodes.filter(d => d.displayName.toLowerCase().includes(currentFilter));
    const totalPages = Math.ceil(filteredNodes.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    const nodeList = d3.select("#node-list").selectAll("li")
        .data(filteredNodes.slice(start, end), d => d.id);

    nodeList.enter()
        .append("li")
        .merge(nodeList)
        .text(d => d.displayName)
        .on("mouseover", (event, d) => highlightNodeAndAdjacents(d))
        .on("mouseout", unhighlightAllNodes);

    nodeList.exit().remove();

    renderPagination(totalPages);
}



function renderPagination(totalPages) {
    const pagination = d3.select("#pagination");

    pagination.selectAll("*").remove();  // Clear existing elements

    pagination.append("button")
        .text("Previous")
        .attr("disabled", currentPage === 1 ? "disabled" : null)
        .on("click", () => updatePage(Math.max(1, currentPage - 1)));

    pagination.append("span")
        .text(`Page ${currentPage} of ${totalPages}`);

    pagination.append("button")
        .text("Next")
        .attr("disabled", currentPage === totalPages ? "disabled" : null)
        .on("click", () => updatePage(Math.min(totalPages, currentPage + 1)));
}


// Function to handle filter changes
function updateFilter(newFilter) {
    currentFilter = newFilter.toLowerCase();  // Convert to lower case for case-insensitive comparison
    currentPage = 1;  // Reset to the first page after filter update
    renderNodeList();
}


// Event listener for the input field
// d3.select("#filter-input").on("input", updateList);
d3.select("#filter-input").on("input", function() {
    updateFilter(this.value);
});
