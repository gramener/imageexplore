import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { network } from "https://cdn.jsdelivr.net/npm/@gramex/network@2";
import { layer } from "https://cdn.jsdelivr.net/npm/@gramex/chartbase@1/dist/chartbase.js";

const $demos = document.querySelector("#demos");
const $experiment = document.querySelector("#experiment");
const $progress = document.querySelector("#progress");
const $result = document.querySelector("#result");
const $searchForm = document.querySelector("#search-form");
const $searchMatches = document.querySelector("#search-matches");
const loading = html`<div class="text-center mx-auto my-5">
  <div class="spinner-border" role="status"></div>
</div>`;

const pc = d3.format(".1%");

// Docs and Embeddings (if present) for the current demo
let demoDocs;
let demoEmbeddings;

// Render list of demos as a card
render(loading, $demos);
fetch("config.json")
  .then((res) => res.json())
  .then(({ demos }) =>
    render(
      [
        demos.map(
          ({ title, body, folder }) => html`
            <div class="col py-3">
              <a class="demo card h-100 text-decoration-none" href="${folder}">
                <div class="card-body">
                  <h5 class="card-title">${title}</h5>
                  <p class="card-text">${body}</p>
                </div>
              </a>
            </div>
          `
        ),
        html`<div class="col py-3">
          <a
            class="card h-100 text-decoration-none"
            href="#experiment"
            data-bs-toggle="collapse"
            role="button"
            aria-expanded="false"
            aria-controls="#experiment"
          >
            <div class="card-body">
              <h5 class="card-title">Create your own</h5>
              <p class="card-text">
                Upload your own images and a set of topics. See how your images are connected to the topics and with
                each other.
              </p>
            </div>
          </a>
        </div>`,
      ],
      $demos
    )
  );

// If user is logged into LLM Foundry, let them upload images and topics. Else show a link to log in
fetch("https://llmfoundry.straive.com/token", { credentials: "include" })
  .then((res) => res.json())
  .then(({ email, token }) => {
    const url = "https://llmfoundry.straive.com/login?" + new URLSearchParams({ next: location.href });
    render(
      email && token
        ? html`
            <div class="d-flex justify-content-between align-items-center">
              <h2 class="display-6">Experiment with your images</h2>
              <a
                href="${url}"
                title="${email}
Click to change login"
                class="btn btn-primary ms-2"
              >
                <i class="bi bi-person-circle"></i>
              </a>
            </div>
            <form class="row was-validated" tabindex="0">
              <input type="hidden" name="token" id="token" value="${token}:imageexplore" />
              <div class="col-sm">
                <div class="mb-3">
                  <label for="docs" class="form-label">Pick up to 100 JPG/PNG files (max 50KB each)</label>
                  <input
                    class="form-control"
                    type="file"
                    name="docs"
                    id="docs"
                    multiple
                    accept="image/jpeg,image/png"
                    required
                    tabindex="1"
                  />
                </div>
                <button type="submit" class="btn btn-primary" tabindex="3">Analyze</button>
              </div>
              <div class="col-sm">
                <div class="mb-3">
                  <label for="topics" class="form-label">List topics, one per line</label>
                  <textarea class="form-control" name="topics" id="topics" rows="3" required tabindex="2"></textarea>
                </div>
              </div>
            </form>
          `
        : html`<p class="text-center">
            <a class="btn btn-primary" href="${url}">Log in to try your own images</a>
          </p>`,
      $experiment
    );
  });

$demos.addEventListener("click", (e) => {
  const $demo = e.target.closest(".demo");
  if ($demo) {
    e.preventDefault();
    render(loading, $result);
    $result.scrollIntoView({ behavior: "smooth" });
    $searchForm.classList.add("d-none");
    const folder = $demo.href;
    fetch(`${folder}/similarity.json`)
      .then((res) => res.json())
      .then((similarity) => {
        similarity.docs.forEach((doc) => (doc.value = `${folder}/${doc.name}`));
        drawResults(similarity);
      });
    fetch(`${folder}/embeddings.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((embeddings) => {
        if (embeddings) {
          $searchForm.classList.remove("d-none");
          demoEmbeddings = embeddings.embeddings;
        }
      });
  }
});

// If a (logged-in) user uploads images and topics, analyze them
$experiment.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  // images = [{name: filename, type: image, value: base64-url}]
  let images = (await Promise.all(Array.from(formData.getAll("docs")).map(readImage))).filter((image) => image.value);
  const topics = formData
    .get("topics")
    .split("\n")
    .map((topic) => topic.trim())
    .filter(Boolean)
    .map((topic) => ({ type: "text", name: topic, value: topic }));
  if (!topics.length) return e.target.querySelector("#topics").setCustomValidity("Please enter at least one topic");
  // docs = [{name: topic|filename, type: text|image, value: topic|base64-url}]
  const docs = [...images, ...topics];

  // Show a fake progress bar updating progress every second
  let progress = 0;
  const seconds = 0.2;
  const expectedDuration = docs.length * 1.5;
  $progress.classList.remove("d-none");
  const renderProgress = () =>
    render(
      html`<div
        class="progress"
        role="progressbar"
        aria-label="Progress"
        aria-valuenow="${Math.round(progress * 100)}"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="progress-bar" style="width: ${progress * 100}%">${pc(progress)}</div>
      </div> `,
      $progress
    );
  let interval = setInterval(() => {
    progress += seconds / expectedDuration;
    renderProgress();
    if (progress >= 1) interval = clearInterval(interval);
  }, seconds * 1000);

  // Fetch similarity
  const similarity = await fetch("https://llmfoundry.straive.com/similarity", {
    method: "POST",
    body: JSON.stringify({
      model: "multimodalembedding@001",
      docs,
      precision: 5,
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${formData.get("token")}`,
    },
  }).then((res) => res.json());
  if (interval) clearInterval(interval);
  $progress.classList.add("d-none");

  // Render the results
  drawResults({ ...similarity, docs });
});

function drawResults({ model, similarity, docs }) {
  demoDocs = docs;
  // Render a button that downloads `similarity` as a JSON file `similarity.json`
  const json = JSON.stringify({
    model,
    docs: docs.map(({ type, name }) => ({ type, name })),
    similarity,
  });

  // NOTE: lit-html and D3 conflict. Don't use lit-html here
  $result.innerHTML = /* html */ `
    <h2 class="my-5 text-center display-6">How similar are images to topics?</h2>
    <div class="mx-auto narrative">
      <p>We evaluated each image against <strong>every</strong> topic.</p>
      <p><strong>Choose a pair of topics</strong> to plot the images and see which are close to the topic and which are far away.</p>
    </div>
    <form class="row align-items-center justify-content-center">
      <div class="col-auto">
        <label for="x-axis" class="form-label fw-bold">X Axis</label>
        <select id="x-axis" class="form-select similarity-axis" aria-label="X Axis"></select>
      </div>
      <div class="col-auto">
        <label for="y-axis" class="form-label fw-bold">Y Axis</label>
        <select id="y-axis" class="form-select similarity-axis" aria-label="Y Axis"></select>
      </div>
      <div class="col-auto">
        <label class="form-label fw-bold">Download results</label>
        <div>
          <a href="data:application/json;base64,${btoa(
            json
          )}" download="similarity.json" class="btn btn-primary">JSON</a>
        </div>
      </div>
    </form>
    <svg
      id="similarity"
      width="1200"
      height="600"
      class="img-fluid d-block mx-auto"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid"
    ></svg>
    <h2 class="my-5 text-center display-6">How similar are images to each other?</h2>
    <div class="mx-auto narrative">
      <p>We took each image and evaluated how close they are to <strong>every</strong> other image.</p>
      <p><strong>Move the slider below</strong> to modify the minimum similarity cutoff and spot the outliers.</p>
      <p>
        <input id="search" type="search" class="form-control d-inline-block w-auto me-2" placeholder="Filter images">
        <button class="btn btn-outline-primary set-cutoff" data-cutoff="0.70" id="min-cutoff">Top outliers</button>
        <button class="btn btn-outline-primary set-cutoff" data-cutoff="0.96" id="max-cutoff">Most similar</button>
      </p>
    </div>
    <input type="range" name="cutoff" id="cutoff" value="0.95" min="0" max="1" step="0.001" class="form-range" />
    <svg
      id="network"
      width="1200"
      height="800"
      class="img-fluid d-block mx-auto"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid"
      fill="currentColor"
    >
      <text x="25%" y="50" class="h3" text-anchor="middle">Outliers</text>
      <text x="50%" y="50" class="h3" text-anchor="middle" id="similarity-value"></text>
      <text x="75%" y="50" class="h3" text-anchor="middle">Similar images</text>
    </svg>
    `;

  docs.forEach((doc, i) => (doc.index = i));
  const images = docs.filter((d) => d.type == "image");
  const topics = docs.filter((d) => d.type == "text");

  // ----------------------------------------------------------------------------------------------
  // Scatterplot of image - topic similarity

  // Populate the X and Y axis fields with the topics
  const $base = d3.select($result);
  $base
    .selectAll(".similarity-axis")
    .selectAll("option")
    .data(topics)
    .join("option")
    .text((d) => d.name)
    .attr("data-index", (d) => d.index);

  // Select the last option for #x-axis and the second one for #y-axis
  $base.select("#x-axis").property("selectedIndex", 0);
  $base.select("#y-axis").property("selectedIndex", 1);

  const svg = $base.select("#similarity");
  const margin = { top: 50, right: 50, bottom: 50, left: 50 };
  const width = +svg.attr("width") - margin.left - margin.right;
  const height = +svg.attr("height") - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().rangeRound([0, width]);
  const y = d3.scaleLinear().rangeRound([height, 0]);

  async function drawScatter() {
    const xIndex = $base.select("#x-axis").property("selectedOptions")[0].dataset.index;
    const yIndex = $base.select("#y-axis").property("selectedOptions")[0].dataset.index;
    images.forEach((d) => {
      d.x = similarity[d.index][xIndex];
      d.y = similarity[d.index][yIndex];
    });

    x.domain(d3.extent(images, (d) => d.x));
    y.domain(d3.extent(images, (d) => d.y));

    layer(g, "g", "x-axis")
      .attr("transform", `translate(0,${height / 2})`)
      .transition()
      .call(d3.axisBottom(x).tickFormat(d3.format(".0%")));
    layer(g, "g", "y-axis")
      .attr("transform", `translate(${width / 2}, 0)`)
      .transition()
      .call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

    const imageLayer = layer(g, "image", "img", images)
      .attr("xlink:href", (d) => d.value)
      .attr("width", 50)
      .on("mouseover.hover", function () {
        d3.select(this).attr("width", 100).attr("transform", "translate(-25, -25)").raise();
      })
      .on("mouseout.hover", function () {
        d3.select(this).attr("width", 50).attr("transform", "translate(0, 0)");
      });
    imageLayer
      .transition()
      .attr("x", (d) => x(d.x) - 25)
      .attr("y", (d) => y(d.y) - 25);
    layer(imageLayer, "title", "tooltip").text((d) => d.name);
  }

  drawScatter();
  $base.selectAll(".similarity-axis").on("change", drawScatter);

  // ----------------------------------------------------------------------------------------------
  // Network cluster of pairwise similarities
  const nodes = images;
  // Convert an array of arrays in pairwise.pairwise to an array of objects: {source: index, target: index}
  const links = images.flatMap((source) =>
    images
      .filter((target) => source !== target)
      .map((target) => ({
        source,
        target,
        similarity: similarity[source.index][target.index],
      }))
  );

  // Set the data-cutoff of #min-cutoff and #max-cutoff to 90% and 10% of the range
  const [minSimilarity, maxSimilarity] = d3.extent(links, (d) => d.similarity);
  $base.select("#min-cutoff").attr("data-cutoff", minSimilarity * 0.5 + maxSimilarity * 0.5);
  $base.select("#max-cutoff").attr("data-cutoff", minSimilarity * 0.1 + maxSimilarity * 0.9);

  let graph;

  function drawNetwork() {
    const cutoff = $base.select("#cutoff").property("value");
    const searchTerm = $base.select("#search").property("value").trim().replace(/\s+/g, ".*");
    const searchRegex = new RegExp(searchTerm, "i");

    // Filter nodes based on searchTerm
    const matchingNodes = new Set(nodes.filter((d) => searchRegex.test(d.name)));
    const linksFiltered = links.filter(
      (d) => d.similarity > cutoff && (matchingNodes.has(d.source) || matchingNodes.has(d.target))
    );

    // Update linkCount for filtered nodes
    nodes.forEach((d) => (d.linkCount = 0));
    linksFiltered.forEach((d) => {
      if (d.source.name != d.target.name) {
        d.source.linkCount++;
        d.target.linkCount++;
        matchingNodes.add(d.source);
        matchingNodes.add(d.target);
      }
    });

    const filteredNodes = Array.from(matchingNodes);
    const nConnectedNodes = filteredNodes.filter((d) => d.linkCount > 0).length;

    graph = network("#network", {
      nodes: filteredNodes,
      links: linksFiltered,
      forces: {
        x: ({ width }) => d3.forceX((d) => (d.linkCount ? (width * 3) / 4 : width / 4)),
        collide: () => d3.forceCollide().radius((d) => (d.linkCount ? 25 + (100 - nConnectedNodes) / 5 : 30)),
      },
      nodeTag: "image",
      d3,
    });
    graph.nodes
      .attr("href", (d) => d.value)
      .attr("height", 50)
      .attr("x", -20)
      .attr("y", -20)
      .attr("data-bs-toggle", "tooltip")
      .attr("stroke", "rgba(var(--bs-body-color-rgb), 0.5)");
    layer(graph.nodes, "title", "tooltip").text((d) => d.name);
    graph.links.attr("stroke", "rgba(var(--bs-body-color-rgb), 0.2)").attr("stroke-width", 1);
    $base.select("#similarity-value").text(pc(cutoff));
  }

  $base.select("#search").on("input", drawNetwork);

  $base
    .select("#cutoff")
    .on("input", drawNetwork)
    .attr("max", maxSimilarity.toFixed(2))
    .attr("min", minSimilarity.toFixed(2))
    .property("value", minSimilarity * 0.2 + maxSimilarity * 0.8)
    .dispatch("input");

  $base.selectAll(".set-cutoff").on("click", function () {
    $base.select("#cutoff").property("value", this.dataset.cutoff).dispatch("input");
  });
}

// ----------------------------------------------------------------------------------------------
// Search images by similarity
$searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  render(loading, $searchMatches);

  const token = document.querySelector("#token").value;
  const phrase = e.target.querySelector("#phrase").value;
  const embedding = await fetch(
    "https://llmfoundry.straive.com/vertexai/google/models/multimodalembedding@001:predict",
    {
      method: "POST",
      body: JSON.stringify({ instances: [{ text: phrase }] }),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    }
  ).then((res) => res.json());

  // Calculate the best images
  const queryEmbedding = embedding.predictions[0].textEmbedding;

  // Calculate dot product between query and each image embedding
  const similarities = demoEmbeddings.map((e) => e.reduce((sum, val, i) => sum + val * queryEmbedding[i], 0));

  // Create array of {doc, similarity} pairs, sort by similarity, and filter for images
  const closestImages = demoDocs
    .map((doc, i) => ({ doc, similarity: similarities[i] }))
    .filter((item) => item.doc.type === "image")
    .sort((a, b) => b.similarity - a.similarity);

  // Display results
  render(
    html`
      <h3 class="mt-4">Closest matches for "${phrase}"</h3>
      <div class="row row-cols-2 row-cols-md-4 g-4">
        ${closestImages.slice(0, 8).map(
          ({ doc, similarity }) => html`
            <div class="col">
              <div class="card h-100">
                <img src="${doc.value}" class="card-img-top" alt="${doc.name}" />
                <div class="card-body">
                  <h5 class="card-title">${doc.name}</h5>
                  <p class="card-text">Similarity: ${d3.format(".1%")(similarity)}</p>
                </div>
              </div>
            </div>
          `
        )}
      </div>
    `,
    $searchMatches
  );
});

/**
 * Read an image file and return a promise that resolves to a base64 image
 * @param {File} file
 * @returns {Promise<{name: string, type: string, value: string}>}
 */
function readImage(file) {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result.split(",").at(-1);
      resolve({
        name: file.name,
        type: "image",
        value: data ? `data:${file.type};base64,${data}` : "",
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
