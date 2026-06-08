const CATEGORY_LABELS = {
  cpu: "處理器",
  motherboard: "主機板",
  memory: "記憶體",
  gpu: "顯示卡",
  storage: "儲存裝置",
  case: "機殼",
  psu: "電源供應器",
  cooler: "散熱器",
  accessory: "其他零件",
};

const CATEGORY_TONES = {
  cpu: "amber",
  motherboard: "blue",
  memory: "green",
  gpu: "violet",
  storage: "cyan",
  case: "teal",
  psu: "slate",
  cooler: "red",
  accessory: "neutral",
};

let products = [];
let selectedId = "";
let searchQuery = "";

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  await refreshSession();
}

function bindElements() {
  els.loginView = document.querySelector("#loginView");
  els.adminView = document.querySelector("#adminView");
  els.loginButton = document.querySelector("#loginButton");
  els.logoutButton = document.querySelector("#logoutButton");
  els.reloadButton = document.querySelector("#reloadButton");
  els.newButton = document.querySelector("#newButton");
  els.searchInput = document.querySelector("#searchInput");
  els.productList = document.querySelector("#productList");
  els.resultCount = document.querySelector("#resultCount");
  els.saveState = document.querySelector("#saveState");
  els.editorTitle = document.querySelector("#editorTitle");
  els.deleteButton = document.querySelector("#deleteButton");
  els.resetButton = document.querySelector("#resetButton");
  els.productForm = document.querySelector("#productForm");
}

function bindEvents() {
  els.loginButton.addEventListener("click", login);
  els.logoutButton.addEventListener("click", logout);
  els.reloadButton.addEventListener("click", loadProducts);
  els.newButton.addEventListener("click", startNewProduct);
  els.resetButton.addEventListener("click", startNewProduct);
  els.deleteButton.addEventListener("click", deleteSelectedProduct);
  els.searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    renderProductList();
  });
  els.productForm.addEventListener("submit", saveProduct);
  els.productForm.elements.category.addEventListener("change", syncCategoryDefaults);
}

async function refreshSession() {
  const session = await api("/api/session");
  setAuthenticated(session.authenticated);
  if (session.authenticated) await loadProducts();
}

async function login() {
  await api("/api/login", { method: "POST", body: {} });
  setAuthenticated(true);
  await loadProducts();
}

async function logout() {
  await api("/api/logout", { method: "POST", body: {} });
  products = [];
  selectedId = "";
  setAuthenticated(false);
}

function setAuthenticated(authenticated) {
  els.loginView.hidden = authenticated;
  els.adminView.hidden = !authenticated;
}

async function loadProducts() {
  setSaveState("載入中...");
  const payload = await api("/api/products");
  products = payload.products;
  if (selectedId && !products.some((product) => product.id === selectedId)) selectedId = "";
  renderProductList();
  if (selectedId) fillForm(products.find((product) => product.id === selectedId));
  else startNewProduct();
  setSaveState("已載入資料庫");
}

function renderProductList() {
  const filtered = getFilteredProducts();
  els.resultCount.textContent = `${filtered.length} 項`;
  els.productList.innerHTML = filtered.length ? filtered.map(renderProductItem).join("") : `
    <div class="empty-state">找不到符合條件的產品。</div>
  `;

  els.productList.querySelectorAll("[data-product-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedId = button.dataset.productId;
      fillForm(products.find((product) => product.id === selectedId));
      renderProductList();
    });
  });
}

function getFilteredProducts() {
  const query = normalizeSearch(searchQuery);
  return products
    .filter((product) => !query || getSearchText(product).includes(query))
    .sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function renderProductItem(product) {
  return `
    <button class="product-item ${product.id === selectedId ? "is-selected" : ""}" type="button" data-product-id="${escapeHtml(product.id)}">
      <span>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(product.id)} · ${escapeHtml(product.category_label || product.category)} · 庫存 ${escapeHtml(product.stock)}</small>
      </span>
      <b>$${escapeHtml(product.price)}</b>
    </button>
  `;
}

function fillForm(product) {
  if (!product) {
    startNewProduct();
    return;
  }
  els.editorTitle.textContent = `編輯 ${product.id}`;
  els.deleteButton.hidden = false;
  Object.entries(product).forEach(([key, value]) => {
    if (els.productForm.elements[key]) els.productForm.elements[key].value = value;
  });
}

function startNewProduct() {
  selectedId = "";
  els.editorTitle.textContent = "新增產品";
  els.deleteButton.hidden = true;
  els.productForm.reset();
  els.productForm.elements.category.value = "cpu";
  syncCategoryDefaults();
  renderProductList();
}

function syncCategoryDefaults() {
  const category = els.productForm.elements.category.value;
  const labelInput = els.productForm.elements.category_label;
  const toneSelect = els.productForm.elements.tone;
  if (!labelInput.value || Object.values(CATEGORY_LABELS).includes(labelInput.value)) {
    labelInput.value = CATEGORY_LABELS[category] || category;
  }
  if (!toneSelect.value || Object.values(CATEGORY_TONES).includes(toneSelect.value)) {
    toneSelect.value = CATEGORY_TONES[category] || "neutral";
  }
}

async function saveProduct(event) {
  event.preventDefault();
  const product = Object.fromEntries(new FormData(els.productForm).entries());
  const isEdit = Boolean(selectedId);
  const endpoint = isEdit ? `/api/products/${encodeURIComponent(selectedId)}` : "/api/products";
  const method = isEdit ? "PUT" : "POST";

  setSaveState("寫入中...");
  const payload = await api(endpoint, { method, body: { product } });
  selectedId = payload.product.id;
  await loadProducts();
  setSaveState(`已寫入 ${payload.product.id}`);
}

async function deleteSelectedProduct() {
  if (!selectedId) return;
  const product = products.find((item) => item.id === selectedId);
  const confirmed = window.confirm(`確定移除「${product?.name || selectedId}」？此動作會直接寫入資料庫。`);
  if (!confirmed) return;

  setSaveState("移除中...");
  await api(`/api/products/${encodeURIComponent(selectedId)}`, { method: "DELETE" });
  selectedId = "";
  await loadProducts();
  setSaveState("已移除產品");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || "操作失敗。";
    setSaveState(message);
    throw new Error(message);
  }
  return payload;
}

function setSaveState(message) {
  els.saveState.textContent = message;
}

function getSearchText(product) {
  return normalizeSearch(Object.values(product).join(" "));
}

function normalizeSearch(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
