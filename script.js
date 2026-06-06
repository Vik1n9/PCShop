const DATA_URL = "data/products.csv";

const REQUIRED_CATEGORIES = [
  "cpu",
  "motherboard",
  "memory",
  "gpu",
  "storage",
  "case",
  "psu",
  "cooler",
];

const CATEGORY_META = {
  cpu: { label: "處理器", short: "CPU", icon: "CPU" },
  motherboard: { label: "主機板", short: "MB", icon: "MB" },
  memory: { label: "記憶體", short: "RAM", icon: "RAM" },
  gpu: { label: "顯示卡", short: "GPU", icon: "GPU" },
  storage: { label: "儲存裝置", short: "SSD", icon: "SSD" },
  case: { label: "機殼", short: "CASE", icon: "CASE" },
  psu: { label: "電源供應器", short: "PSU", icon: "PSU" },
  cooler: { label: "散熱器", short: "COOL", icon: "FAN" },
  accessory: { label: "其他零件", short: "ADD", icon: "ADD" },
};

let products = [];
let selectedParts = {};
let activeCategory = "cpu";
let activeView = "picker";
let expandedProductId = "";
let smartFiltering = true;
let searchQuery = "";
let savedQuotes = [];
let noticeTimer = 0;

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindStaticEvents();
  loadSavedQuotes();
  renderShellLoading();

  try {
    products = await fetchProducts();
    render();
  } catch (error) {
    renderLoadError(error);
  }
}

function bindElements() {
  els.body = document.body;
  els.topTotal = document.querySelector("#topTotal");
  els.progressCount = document.querySelector("#progressCount");
  els.progressHint = document.querySelector("#progressHint");
  els.progressFill = document.querySelector("#progressFill");
  els.progressSteps = document.querySelector("#progressSteps");
  els.notice = document.querySelector("#notice");
  els.overviewPanel = document.querySelector("#overviewPanel");
  els.workspace = document.querySelector("#workspace");
  els.dialog = document.querySelector("#productDialog");
}

function bindStaticEvents() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.viewTarget;
      els.body.dataset.view = activeView;
      render();
    });
  });

  document.querySelector("#saveQuoteTop").addEventListener("click", saveCurrentQuote);

  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) {
      els.dialog.close();
    }
  });
}

async function fetchProducts() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CSV 載入失敗：${response.status}`);
  }
  const rows = parseCsv(await response.text());
  return rows.map(normalizeProduct);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift().map((header) => header.trim());
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()])));
}

function normalizeProduct(row) {
  const tags = splitList(row.tags, ";");
  const badges = splitList(row.badges, ";");
  const specs = parseSpecs(row.category, tags);
  return {
    id: row.id,
    category: row.category,
    categoryLabel: row.category_label,
    name: row.name,
    stock: Number(row.stock) || 0,
    price: Number(row.price) || 0,
    description: row.description || row.details || "",
    officialUrl: row.official_url || row.url || "",
    tags,
    badges,
    restriction: row.restriction,
    tone: row.tone || "neutral",
    specs,
  };
}

function parseSpecs(category, tags) {
  const specs = {
    sockets: [],
    memoryTypes: [],
    formFactors: [],
  };

  tags.forEach((tag) => {
    const normalized = tag.toUpperCase();
    const tdp = tag.match(/\bTDP\s*(\d+)W/i);
    const peakTdp = tag.match(/\bMAX TDP\s*(\d+)W/i);
    const length = tag.match(/\bLength\s*([\d.]+)cm/i);
    const heightMm = tag.match(/\bHeight\s*(\d+)mm/i);
    const maxGpu = tag.match(/\bMax GPU Length\s*([\d.]+)cm/i);
    const maxCooler = tag.match(/\bMax Cooler Height\s*([\d.]+)cm/i);
    const wattage = tag.match(/^(\d+)W$/i);

    if (tag.includes("Socket AM4")) specs.sockets.push("AM4");
    if (tag.includes("Socket AM5")) specs.sockets.push("AM5");
    if (tag.includes("LGA1700")) specs.sockets.push("LGA1700");
    if (normalized.includes("DDR4/DDR5")) specs.memoryTypes.push("DDR4", "DDR5");
    else if (normalized.includes("DDR4")) specs.memoryTypes.push("DDR4");
    else if (normalized.includes("DDR5")) specs.memoryTypes.push("DDR5");
    if (tdp) specs.tdp = Number(tdp[1]);
    if (peakTdp) specs.peakTdp = Number(peakTdp[1]);
    if (length) specs.lengthCm = Number(length[1]);
    if (heightMm) specs.coolerHeightCm = Number(heightMm[1]) / 10;
    if (maxGpu) specs.maxGpuLengthCm = Number(maxGpu[1]);
    if (maxCooler) specs.maxCoolerHeightCm = Number(maxCooler[1]);
    if (wattage) specs.wattage = Number(wattage[1]);

    if (category === "motherboard" || category === "case") {
      if (tag.includes("E-ATX")) specs.formFactors.push("E-ATX");
      if (tag.includes("Mini-ITX")) specs.formFactors.push("Mini-ITX");
      if (tag.includes("microATX")) specs.formFactors.push("microATX");
      if (/\bATX\b/.test(tag) && !tag.includes("E-ATX") && !tag.includes("ATX12V")) specs.formFactors.push("ATX");
    }
  });

  specs.sockets = unique(specs.sockets);
  specs.memoryTypes = unique(specs.memoryTypes);
  specs.formFactors = unique(specs.formFactors);
  return specs;
}

function splitList(value, separator) {
  return String(value || "")
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function renderShellLoading() {
  els.overviewPanel.innerHTML = `<div class="loading-state"><h2>載入資料</h2><p>products.csv</p></div>`;
  els.workspace.innerHTML = `<div class="loading-state"><h2>載入資料</h2><p>products.csv</p></div>`;
}

function renderLoadError(error) {
  els.overviewPanel.innerHTML = "";
  els.workspace.innerHTML = `
    <div class="empty-state">
      <h2>資料載入失敗</h2>
      <p>${escapeHtml(error.message)}。請透過本機伺服器開啟頁面，讓瀏覽器可以 fetch CSV。</p>
    </div>
  `;
  showNotice("danger", "資料載入失敗，請確認 data/products.csv 存在。");
}

function render() {
  const total = getTotal(selectedParts);
  const count = REQUIRED_CATEGORIES.filter((category) => selectedParts[category]).length;
  const nextCategory = REQUIRED_CATEGORIES.find((category) => !selectedParts[category]);
  const issues = checkBuild(selectedParts);

  els.topTotal.textContent = formatPrice(total);
  els.progressCount.textContent = `已選 ${count}/${REQUIRED_CATEGORIES.length}`;
  els.progressHint.textContent = issues.hard[0]?.message || issues.soft[0]?.message || (nextCategory ? `下一項：${CATEGORY_META[nextCategory].label}` : "核心零件已完成");
  els.progressFill.style.width = `${(count / REQUIRED_CATEGORIES.length) * 100}%`;

  renderProgressSteps();
  renderOverview(issues);
  renderWorkspace();
}

function renderProgressSteps() {
  els.progressSteps.innerHTML = REQUIRED_CATEGORIES.map((category) => {
    const part = selectedParts[category];
    const meta = CATEGORY_META[category];
    return `
      <button class="step-button ${part ? "is-selected" : "is-empty"}" type="button" data-step-category="${category}">
        ${meta.short}${part ? " ✓" : ""}
      </button>
    `;
  }).join("");

  els.progressSteps.querySelectorAll("[data-step-category]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.stepCategory;
      activeView = "picker";
      els.body.dataset.view = activeView;
      render();
    });
  });
}

function renderOverview(issues) {
  const total = getTotal(selectedParts);
  const count = REQUIRED_CATEGORIES.filter((category) => selectedParts[category]).length;

  els.overviewPanel.innerHTML = `
    <div class="panel-title">
      <h2>組裝進度</h2>
      <p>${count}/${REQUIRED_CATEGORIES.length} 項核心零件</p>
    </div>
    <div class="build-map">
      ${REQUIRED_CATEGORIES.map(renderPartSlot).join("")}
    </div>
    ${renderIssues(issues)}
    <section class="build-specs" aria-label="目前電腦規格">
      <h3>目前電腦規格</h3>
      ${renderBuildSpecsText()}
    </section>
    <div class="quote-total">
      <strong><span>目前總額</span><output>${formatPrice(total)}</output></strong>
      <label class="quote-name">
        <span>估價單名稱</span>
        <input id="quoteName" type="text" maxlength="28" value="${getDefaultQuoteName()}" />
      </label>
      <div class="detail-actions">
        <button class="primary-button" type="button" data-action="save-quote">儲存估價單</button>
        <button class="ghost-button" type="button" data-action="copy-current">複製規格</button>
        <button class="ghost-button" type="button" data-action="print-current">列印</button>
      </div>
    </div>
  `;

  els.overviewPanel.querySelectorAll("[data-slot-category]").forEach((slot) => {
    slot.addEventListener("click", () => {
      activeCategory = slot.dataset.slotCategory;
      activeView = "picker";
      els.body.dataset.view = activeView;
      render();
    });
  });

  els.overviewPanel.querySelectorAll("[data-remove-category]").forEach((button) => {
    button.addEventListener("click", () => removePart(button.dataset.removeCategory));
  });

  els.overviewPanel.querySelectorAll("[data-change-category]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.changeCategory;
      activeView = "picker";
      els.body.dataset.view = activeView;
      render();
    });
  });

  const saveButton = els.overviewPanel.querySelector("[data-action='save-quote']");
  const copyButton = els.overviewPanel.querySelector("[data-action='copy-current']");
  const printButton = els.overviewPanel.querySelector("[data-action='print-current']");
  saveButton?.addEventListener("click", saveCurrentQuote);
  copyButton?.addEventListener("click", () => copyText(formatQuoteText(selectedParts, "目前估價單")));
  printButton?.addEventListener("click", () => window.print());
}

function renderPartSlot(category) {
  const meta = CATEGORY_META[category];
  const part = selectedParts[category];
  return `
    <div class="part-slot ${part ? "is-filled" : ""}">
      <button class="part-slot-main" type="button" data-slot-category="${category}" aria-label="${part ? `更換${meta.label}` : `選擇${meta.label}`}">
        <b>${meta.label}</b>
        <span>${part ? escapeHtml(part.name) : "未選"}</span>
        ${part ? `<strong>${formatPrice(part.price)}</strong>` : ""}
      </button>
      ${part ? `
        <div class="slot-actions" aria-label="${meta.label}操作">
          <button class="slot-action" type="button" data-change-category="${category}">更換</button>
          <button class="slot-action is-danger" type="button" data-remove-category="${category}">移除</button>
        </div>
      ` : ""}
    </div>
  `;
}

function renderBuildSpecsText() {
  return `
    <dl>
      ${REQUIRED_CATEGORIES.map((category) => {
        const part = selectedParts[category];
        return `
          <div>
            <dt>${CATEGORY_META[category].label}</dt>
            <dd>${part ? escapeHtml(formatBuildSpecLine(part)) : "未選"}</dd>
          </div>
        `;
      }).join("")}
    </dl>
  `;
}

function formatBuildSpecLine(product) {
  const specText = getSpecItems(product)
    .filter(([label, value]) => label !== "規格" || !isRedundantSpecTag(product, value))
    .map(([label, value]) => `${label} ${value}`)
    .join("，");
  return specText || product.tags.slice(0, 4).join("，") || "未標示規格";
}

function isRedundantSpecTag(product, value) {
  const normalized = value.toUpperCase();
  const { specs } = product;
  return (
    specs.sockets.some((socket) => normalized.includes(socket)) ||
    specs.memoryTypes.some((memoryType) => normalized.includes(memoryType)) ||
    specs.formFactors.some((formFactor) => normalized.includes(formFactor.toUpperCase())) ||
    (specs.tdp && normalized === `TDP ${specs.tdp}W`) ||
    (specs.peakTdp && normalized === `MAX TDP ${specs.peakTdp}W`) ||
    (specs.lengthCm && normalized === `LENGTH ${specs.lengthCm}CM`) ||
    (specs.wattage && normalized === `${specs.wattage}W`)
  );
}

function renderWorkspace() {
  if (activeView === "saved") {
    renderSavedQuotes();
    return;
  }

  renderPicker();
}

function renderPicker() {
  const categories = getAvailableCategories();
  const activeMeta = CATEGORY_META[activeCategory];
  const visibleProducts = getProductsForActiveCategory();
  const allProducts = products.filter((product) => product.category === activeCategory);
  const compatibleCount = getAnalyzedProductsForActiveCategory().filter(({ analysis }) => !analysis.hard.length).length;

  els.workspace.innerHTML = `
    <div class="view-header">
      <div class="view-heading">
        <div>
          <h1>${activeMeta.label}</h1>
          <p>${renderResultSummary(visibleProducts.length, compatibleCount, allProducts.length)}</p>
        </div>
      </div>
      <div class="category-tabs" aria-label="零件類別">
        ${categories.map(renderCategoryTab).join("")}
      </div>
      <div class="toolbar">
        <label class="search-control">
          <span>搜尋產品</span>
          <input id="productSearch" type="search" value="${escapeHtml(searchQuery)}" placeholder="輸入品牌、型號或規格" autocomplete="off" />
        </label>
        <button
          class="filter-state-button ${smartFiltering ? "is-on" : "is-off"}"
          type="button"
          data-action="smart-filtering-toggle"
          aria-pressed="${smartFiltering}"
          aria-label="${smartFiltering ? "智能篩選中，點選後關閉" : "智能篩選已關閉，點選後開啟"}"
        >
          ${smartFiltering ? "智能篩選中" : "智能篩選關閉"}
        </button>
        <span class="status-pill">${selectedParts[activeCategory] ? "已選" : "未選"}</span>
      </div>
    </div>
    <div class="product-list">
      ${visibleProducts.length ? visibleProducts.map(renderProductCard).join("") : renderEmptyProductState()}
    </div>
  `;

  els.workspace.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      expandedProductId = "";
      render();
    });
  });

  const searchInput = els.workspace.querySelector("#productSearch");
  const updateSearch = (event) => {
    searchQuery = event.target.value;
    expandedProductId = "";
    render();
  };
  searchInput?.addEventListener("input", updateSearch);
  searchInput?.addEventListener("search", updateSearch);
  searchInput?.addEventListener("change", updateSearch);

  els.workspace.querySelector("[data-action='smart-filtering-toggle']")?.addEventListener("click", () => {
    smartFiltering = !smartFiltering;
    render();
    showNotice(
      smartFiltering ? "success" : "warning",
      smartFiltering ? "已開啟智能篩選，僅顯示可直接加入的相容品項。" : "已關閉智能篩選，不相容品項仍會標示提醒。"
    );
  });

  bindProductCardEvents();
}

function getAvailableCategories() {
  const existing = unique(products.map((product) => product.category));
  return [...REQUIRED_CATEGORIES, "accessory"].filter((category) => existing.includes(category));
}

function renderCategoryTab(category) {
  const meta = CATEGORY_META[category];
  const selected = selectedParts[category];
  return `
    <button class="category-tab ${category === activeCategory ? "is-active" : ""}" type="button" data-category="${category}">
      ${meta.label}${selected ? " ✓" : ""}
    </button>
  `;
}

function getProductsForActiveCategory() {
  return getAnalyzedProductsForActiveCategory()
    .filter(({ analysis }) => !smartFiltering || !analysis.hard.length)
    .sort((a, b) => Number(Boolean(a.analysis.hard.length)) - Number(Boolean(b.analysis.hard.length)) || b.product.stock - a.product.stock);
}

function getAnalyzedProductsForActiveCategory() {
  const query = normalizeSearchText(searchQuery);
  return products
    .filter((product) => product.category === activeCategory)
    .filter((product) => !query || getProductSearchText(product).includes(query))
    .map((product) => ({ product, analysis: analyzeCandidate(product) }));
}

function getProductSearchText(product) {
  return normalizeSearchText([
    product.id,
    product.category,
    product.categoryLabel,
    CATEGORY_META[product.category]?.label,
    product.name,
    product.price,
    product.stock,
    product.description,
    product.tags.join(" "),
    product.badges.join(" "),
  ].join(" "));
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function renderResultSummary(visibleCount, compatibleCount, totalCount) {
  const searchPart = searchQuery.trim() ? `搜尋符合 ${visibleCount} 項` : `${visibleCount}/${totalCount} 個品項可選`;
  return smartFiltering ? `${searchPart}，相容 ${compatibleCount} 項` : `${searchPart}，智能篩選已關閉`;
}

function renderProductCard(entry) {
  const { product, analysis } = entry;
  const selected = selectedParts[product.category]?.id === product.id;
  const expanded = expandedProductId === product.id;
  const hardIssues = analysis.hard.length > 0;
  const blocked = shouldBlockAdd(analysis);
  const specs = getKeySpecs(product);
  const officialUrl = getProductOfficialUrl(product);

  return `
    <article class="product-card ${hardIssues ? "is-incompatible" : ""} ${selected ? "is-selected" : ""} ${expanded ? "is-expanded" : ""}">
      <div class="product-summary">
        <div class="product-main">
          <div class="product-title-line">
            <h3>${escapeHtml(product.name)}</h3>
            <strong class="price">${formatPrice(product.price)}</strong>
          </div>
          <p class="product-description">${escapeHtml(getProductDescription(product, specs))}</p>
          <div class="badges">
            ${renderBadges(product)}
            ${product.stock <= 8 ? `<span class="badge is-muted">低庫存</span>` : ""}
          </div>
          <p class="stock-line">庫存 ${product.stock}${specs.length ? ` · ${specs.map(escapeHtml).join(" · ")}` : ""}</p>
        </div>
        <div class="card-actions">
          <a class="ghost-button official-link" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">產品官網</a>
          <button class="ghost-button" type="button" data-expand-product="${product.id}">${expanded ? "收合" : "詳細"}</button>
          <button class="primary-button" type="button" data-add-product="${product.id}" ${blocked && !selected ? "disabled" : ""} ${selected ? `aria-label="移除 ${escapeHtml(product.name)}" title="再次點擊移除"` : ""}>${selected ? "已加入" : "加入估價單"}</button>
        </div>
      </div>
      ${expanded ? renderProductExtra(product, analysis) : ""}
    </article>
  `;
}

function renderBadges(product) {
  const badges = [...product.badges];
  if (product.restriction === "bundle_only" && !badges.some((badge) => badge.includes("限組裝"))) {
    badges.push("限組裝");
  }

  return badges.map((badge) => {
    const isRestrict = badge.includes("限組裝");
    return `<span class="badge ${isRestrict ? "is-restrict" : ""}">${escapeHtml(badge)}</span>`;
  }).join("");
}

function renderProductExtra(product, analysis) {
  const blocked = shouldBlockAdd(analysis);
  const selected = selectedParts[product.category]?.id === product.id;
  const officialUrl = getProductOfficialUrl(product);
  return `
    <div class="product-extra">
      <p class="detail-copy">${escapeHtml(getProductDescription(product, getKeySpecs(product)))}</p>
      <dl class="spec-table">
        ${getSpecItems(product).map(([label, value]) => `
          <div class="spec-item">
            <dt>${label}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>
        `).join("")}
      </dl>
      ${renderIssues(analysis)}
      <div class="detail-actions">
        <button class="secondary-button" type="button" data-detail-product="${product.id}">查看完整介紹</button>
        <a class="ghost-button official-link" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">前往產品官網</a>
        <button class="primary-button" type="button" data-add-product="${product.id}" ${blocked && !selected ? "disabled" : ""} ${selected ? `aria-label="移除 ${escapeHtml(product.name)}" title="再次點擊移除"` : ""}>${selected ? "已加入" : "加入估價單"}</button>
      </div>
    </div>
  `;
}

function renderIssues(analysis) {
  const hard = analysis.hard.map((issue) => `<li class="hard">${escapeHtml(issue.message)}</li>`);
  const soft = analysis.soft.map((issue) => `<li class="soft">${escapeHtml(issue.message)}</li>`);
  const issues = [...hard, ...soft];
  if (!issues.length) return "";
  return `<ul class="issue-list">${issues.join("")}</ul>`;
}

function renderEmptyProductState() {
  return `
    <div class="empty-state">
      <h2>沒有符合條件的品項</h2>
      <p>${searchQuery.trim() ? "請換個品牌、型號或規格搜尋。" : "可關閉智能篩選查看不相容原因。"}</p>
    </div>
  `;
}

function bindProductCardEvents() {
  els.workspace.querySelectorAll("[data-expand-product]").forEach((button) => {
    button.addEventListener("click", () => {
      expandedProductId = expandedProductId === button.dataset.expandProduct ? "" : button.dataset.expandProduct;
      render();
    });
  });

  els.workspace.querySelectorAll("[data-add-product]").forEach((button) => {
    button.addEventListener("click", () => toggleProduct(button.dataset.addProduct));
  });

  els.workspace.querySelectorAll("[data-detail-product]").forEach((button) => {
    button.addEventListener("click", () => openProductDialog(button.dataset.detailProduct));
  });
}

function renderSavedQuotes() {
  els.workspace.innerHTML = `
    <div class="view-header">
      <div class="view-heading">
        <div>
          <h1>我的估價單</h1>
          <p>${savedQuotes.length} 份已儲存</p>
        </div>
      </div>
    </div>
    <div class="quote-list">
      ${savedQuotes.length ? savedQuotes.map(renderQuoteRow).join("") : `<div class="empty-state"><h2>尚無估價單</h2><p>儲存後會顯示在這裡。</p></div>`}
    </div>
  `;

  els.workspace.querySelectorAll("[data-load-quote]").forEach((button) => {
    button.addEventListener("click", () => loadQuote(button.dataset.loadQuote));
  });

  els.workspace.querySelectorAll("[data-copy-quote]").forEach((button) => {
    const quote = savedQuotes.find((item) => item.id === button.dataset.copyQuote);
    if (quote) button.addEventListener("click", () => copyText(formatSavedQuoteText(quote)));
  });

  els.workspace.querySelectorAll("[data-delete-quote]").forEach((button) => {
    button.addEventListener("click", () => deleteQuote(button.dataset.deleteQuote));
  });
}

function renderQuoteRow(quote) {
  const itemCount = Object.keys(quote.parts).length;
  return `
    <article class="quote-row">
      <div class="quote-row-header">
        <div>
          <h3>${escapeHtml(quote.name)}</h3>
          <p>${itemCount} 項零件 · ${escapeHtml(quote.date)}</p>
        </div>
        <strong>${formatPrice(quote.total)}</strong>
      </div>
      <div class="quote-actions">
        <button class="secondary-button" type="button" data-load-quote="${quote.id}">載入</button>
        <button class="ghost-button" type="button" data-copy-quote="${quote.id}">複製</button>
        <button class="danger-button" type="button" data-delete-quote="${quote.id}">刪除</button>
      </div>
    </article>
  `;
}

function analyzeCandidate(product) {
  const draft = { ...selectedParts, [product.category]: product };
  return checkBuild(draft, product);
}

function checkBuild(parts, candidate = null) {
  const hard = [];
  const soft = [];
  const cpu = parts.cpu;
  const motherboard = parts.motherboard;
  const memory = parts.memory;
  const gpu = parts.gpu;
  const pcCase = parts.case;
  const psu = parts.psu;
  const cooler = parts.cooler;

  if (cpu && motherboard && !intersects(cpu.specs.sockets, motherboard.specs.sockets)) {
    hard.push({ categories: ["cpu", "motherboard"], message: `CPU 插槽 ${labelList(cpu.specs.sockets)} 與主機板 ${labelList(motherboard.specs.sockets)} 不相容。` });
  }

  if (motherboard && memory && !intersects(motherboard.specs.memoryTypes, memory.specs.memoryTypes)) {
    hard.push({ categories: ["motherboard", "memory"], message: `主機板記憶體 ${labelList(motherboard.specs.memoryTypes)} 與記憶體 ${labelList(memory.specs.memoryTypes)} 不相容。` });
  }

  if (cpu && memory && cpu.specs.memoryTypes.length && !intersects(cpu.specs.memoryTypes, memory.specs.memoryTypes)) {
    hard.push({ categories: ["cpu", "memory"], message: `CPU 支援 ${labelList(cpu.specs.memoryTypes)}，目前記憶體為 ${labelList(memory.specs.memoryTypes)}。` });
  }

  if (motherboard && pcCase && motherboard.specs.formFactors.length && pcCase.specs.formFactors.length && !intersects(motherboard.specs.formFactors, pcCase.specs.formFactors)) {
    hard.push({ categories: ["motherboard", "case"], message: `機殼支援 ${labelList(pcCase.specs.formFactors)}，目前主機板為 ${labelList(motherboard.specs.formFactors)}。` });
  }

  if (gpu && pcCase && gpu.specs.lengthCm && pcCase.specs.maxGpuLengthCm && gpu.specs.lengthCm > pcCase.specs.maxGpuLengthCm) {
    hard.push({ categories: ["gpu", "case"], message: `顯示卡長度 ${gpu.specs.lengthCm}cm 超過機殼上限 ${pcCase.specs.maxGpuLengthCm}cm。` });
  }

  if (cooler && pcCase && cooler.specs.coolerHeightCm && pcCase.specs.maxCoolerHeightCm && cooler.specs.coolerHeightCm > pcCase.specs.maxCoolerHeightCm) {
    hard.push({ categories: ["cooler", "case"], message: `散熱器高度 ${cooler.specs.coolerHeightCm}cm 超過機殼上限 ${pcCase.specs.maxCoolerHeightCm}cm。` });
  }

  if (cpu && cooler && cooler.specs.sockets.length && !intersects(cpu.specs.sockets, cooler.specs.sockets)) {
    hard.push({ categories: ["cpu", "cooler"], message: `散熱器支援 ${labelList(cooler.specs.sockets)}，目前 CPU 為 ${labelList(cpu.specs.sockets)}。` });
  }

  if (candidate?.restriction === "bundle_only" && candidate.category === "gpu" && !(parts.cpu && parts.motherboard)) {
    hard.push({ categories: ["gpu"], policy: true, message: "此顯示卡限組裝銷售，需先選擇 CPU 與主機板。" });
  }

  if (candidate?.restriction === "bundle_only" && candidate.category === "accessory" && !parts.gpu) {
    hard.push({ categories: ["accessory"], policy: true, message: "此配件限搭配整機或顯示卡估價單。" });
  }

  if (cpu && gpu && psu) {
    const requiredWattage = (cpu.specs.peakTdp || cpu.specs.tdp || 0) + (gpu.specs.tdp || 0) + 150;
    if (psu.specs.wattage && psu.specs.wattage < requiredWattage) {
      soft.push({ categories: ["psu"], message: `建議電源至少 ${requiredWattage}W，目前為 ${psu.specs.wattage}W。` });
    }
  }

  if (cpu && cooler && cooler.specs.tdp && (cpu.specs.peakTdp || cpu.specs.tdp) > cooler.specs.tdp) {
    soft.push({ categories: ["cooler"], message: `CPU 峰值功耗可能高於散熱器標示 TDP，建議改選更高散熱能力。` });
  }

  return { hard, soft };
}

function addProduct(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  const analysis = analyzeCandidate(product);
  if (shouldBlockAdd(analysis)) {
    showNotice("danger", analysis.hard[0].message);
    expandedProductId = product.id;
    render();
    return;
  }

  selectedParts = { ...selectedParts, [product.category]: product };
  expandedProductId = product.id;
  const buildIssues = checkBuild(selectedParts);
  const noticeType = analysis.hard.length || buildIssues.soft.length ? "warning" : "success";
  const notice = analysis.hard[0]?.message || buildIssues.soft[0]?.message || `已加入 ${product.name}`;
  showNotice(noticeType, notice);
  render();
}

function toggleProduct(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  if (selectedParts[product.category]?.id === product.id) {
    removePart(product.category);
    return;
  }

  addProduct(product.id);
}

function shouldBlockAdd(analysis) {
  if (smartFiltering) return analysis.hard.length > 0;
  return analysis.hard.some((issue) => issue.policy === true);
}

function removePart(category) {
  const next = { ...selectedParts };
  delete next[category];
  selectedParts = next;
  showNotice("success", `${CATEGORY_META[category].label} 已移除。`);
  render();
}

function loadQuote(quoteId) {
  const quote = savedQuotes.find((item) => item.id === quoteId);
  if (!quote) return;
  const next = {};
  Object.entries(quote.parts).forEach(([category, productId]) => {
    const product = products.find((item) => item.id === productId);
    if (product) next[category] = product;
  });
  selectedParts = next;
  activeView = "overview";
  els.body.dataset.view = activeView;
  showNotice("success", `已載入 ${quote.name}`);
  render();
}

function deleteQuote(quoteId) {
  savedQuotes = savedQuotes.filter((quote) => quote.id !== quoteId);
  persistSavedQuotes();
  showNotice("success", "估價單已刪除。");
  render();
}

function saveCurrentQuote() {
  if (!Object.keys(selectedParts).length) {
    showNotice("warning", "尚未選擇零件。");
    return;
  }

  const input = document.querySelector("#quoteName");
  const name = input?.value.trim() || getDefaultQuoteName();
  const quote = {
    id: `quote-${Date.now()}`,
    name,
    date: new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
    total: getTotal(selectedParts),
    parts: Object.fromEntries(Object.entries(selectedParts).map(([category, product]) => [category, product.id])),
  };

  savedQuotes = [quote, ...savedQuotes].slice(0, 20);
  persistSavedQuotes();
  showNotice("success", `已儲存 ${quote.name}`);
  activeView = "saved";
  els.body.dataset.view = activeView;
  render();
}

function loadSavedQuotes() {
  try {
    savedQuotes = JSON.parse(localStorage.getItem("pcshop-quotes") || "[]");
  } catch {
    savedQuotes = [];
  }
}

function persistSavedQuotes() {
  localStorage.setItem("pcshop-quotes", JSON.stringify(savedQuotes));
}

function openProductDialog(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const analysis = analyzeCandidate(product);
  const selected = selectedParts[product.category]?.id === product.id;

  els.dialog.innerHTML = `
    <div class="dialog-shell">
      <div class="dialog-hero tone-${escapeHtml(product.tone)}">
        <div class="dialog-top">
          <span class="badge">${CATEGORY_META[product.category].label}</span>
          <button class="dialog-close" type="button" data-close-dialog aria-label="關閉">×</button>
        </div>
        <h2>${escapeHtml(product.name)}</h2>
        <p>${formatPrice(product.price)} · 庫存 ${product.stock}</p>
      </div>
      <div class="dialog-body">
        <div class="dialog-grid">
          <section class="dialog-section">
            <h3>重點規格</h3>
            <dl class="spec-table">
              ${getSpecItems(product).map(([label, value]) => `
                <div class="spec-item">
                  <dt>${label}</dt>
                  <dd>${escapeHtml(value)}</dd>
                </div>
              `).join("")}
            </dl>
          </section>
          <section class="dialog-section">
            <h3>相容性提示</h3>
            ${renderIssues(analysis) || `<div class="empty-state"><h2>目前可加入</h2><p>未偵測到硬衝突。</p></div>`}
          </section>
        </div>
        <section class="dialog-section">
          <h3>產品說明</h3>
          <p class="detail-copy">${escapeHtml(getProductDescription(product, getKeySpecs(product)))}</p>
        </section>
        <section class="dialog-section">
          <h3>完整規格</h3>
          <table class="full-specs">
            <tbody>
              ${product.tags.map((tag, index) => `
                <tr>
                  <th>規格 ${index + 1}</th>
                  <td>${escapeHtml(tag)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </section>
        <div class="detail-actions">
          <a class="ghost-button official-link" href="${escapeHtml(getProductOfficialUrl(product))}" target="_blank" rel="noopener noreferrer">前往產品官網</a>
          <button class="primary-button" type="button" data-dialog-add="${product.id}" ${shouldBlockAdd(analysis) && !selected ? "disabled" : ""} ${selected ? `aria-label="移除 ${escapeHtml(product.name)}" title="再次點擊移除"` : ""}>${selected ? "已加入" : "加入估價單"}</button>
          <button class="ghost-button" type="button" data-close-dialog>關閉</button>
        </div>
      </div>
    </div>
  `;

  els.dialog.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => els.dialog.close());
  });
  els.dialog.querySelector("[data-dialog-add]")?.addEventListener("click", (event) => {
    toggleProduct(event.currentTarget.dataset.dialogAdd);
    els.dialog.close();
  });
  els.dialog.showModal();
}

function getProductsByCategory(category) {
  return products.filter((product) => product.category === category);
}

function getKeySpecs(product) {
  const specs = product.tags.filter((tag) => {
    const normalized = tag.toUpperCase();
    return normalized.includes("SOCKET") || normalized.includes("LGA") || normalized.includes("DDR") || normalized.includes("TDP") || normalized.includes("LENGTH") || normalized.includes("W") || normalized.includes("ATX") || normalized.includes("PCIe".toUpperCase());
  });
  return specs.slice(0, 3);
}

function getProductDescription(product, specs = getKeySpecs(product)) {
  if (product.description) return product.description;
  const meta = CATEGORY_META[product.category]?.label || product.categoryLabel || "零件";
  const specText = specs.length ? specs.join("、") : product.tags.slice(0, 3).join("、");
  const stockText = product.stock > 0 ? `目前庫存 ${product.stock} 件` : "目前需向門市確認供貨";
  return `${meta}品項，${specText || "適合加入估價單比較"}。${stockText}，加入前可查看官網規格並確認版本差異。`;
}

function getProductOfficialUrl(product) {
  if (product.officialUrl) return product.officialUrl;

  const name = product.name;
  const encoded = encodeURIComponent(name);
  const manufacturerSearch = [
    [/^AMD\b/i, `https://www.amd.com/en/search?keyword=${encoded}`],
    [/^Intel\b/i, `https://www.intel.com/content/www/us/en/search.html?ws=text#q=${encoded}`],
    [/^ASUS\b/i, `https://www.asus.com/searchresult?searchType=products&searchKey=${encoded}`],
    [/^Gigabyte\b/i, `https://www.gigabyte.com/Search?kw=${encoded}`],
    [/^MSI\b/i, `https://www.msi.com/search/${encoded}`],
    [/^ASRock\b/i, `https://www.asrock.com/search/index.asp?Search=${encoded}`],
    [/^Corsair\b/i, `https://www.corsair.com/search?q=${encoded}`],
    [/^Kingston\b/i, `https://www.kingston.com/en/search?keyword=${encoded}`],
    [/^Crucial\b/i, `https://www.crucial.com/search?query=${encoded}`],
    [/^Samsung\b/i, `https://www.samsung.com/us/search/searchMain/?searchTerm=${encoded}`],
    [/^Western Digital|^WD\b/i, `https://www.westerndigital.com/search?q=${encoded}`],
    [/^Seagate\b/i, `https://www.seagate.com/search/?q=${encoded}`],
    [/^NVIDIA\b/i, `https://www.nvidia.com/en-us/search/?q=${encoded}`],
    [/^Cooler Master\b/i, `https://www.coolermaster.com/catalogsearch/result/?q=${encoded}`],
    [/^Noctua\b/i, `https://noctua.at/en/search?search=${encoded}`],
    [/^be quiet!/i, `https://www.bequiet.com/en/search?search=${encoded}`],
    [/^Fractal\b/i, `https://www.fractal-design.com/?s=${encoded}`],
    [/^Lian Li\b/i, `https://lian-li.com/?s=${encoded}`],
  ];

  const match = manufacturerSearch.find(([pattern]) => pattern.test(name));
  return match ? match[1] : `https://www.google.com/search?q=${encodeURIComponent(`${name} official product`)}`;
}

function getSpecItems(product) {
  const items = [];
  const { specs } = product;
  if (specs.sockets.length) items.push(["插槽", labelList(specs.sockets)]);
  if (specs.memoryTypes.length) items.push(["記憶體", labelList(specs.memoryTypes)]);
  if (specs.formFactors.length) items.push(["板型", labelList(specs.formFactors)]);
  if (specs.tdp) items.push(["TDP", `${specs.tdp}W`]);
  if (specs.peakTdp) items.push(["峰值 TDP", `${specs.peakTdp}W`]);
  if (specs.lengthCm) items.push(["長度", `${specs.lengthCm}cm`]);
  if (specs.maxGpuLengthCm) items.push(["顯卡上限", `${specs.maxGpuLengthCm}cm`]);
  if (specs.maxCoolerHeightCm) items.push(["散熱器高度上限", `${specs.maxCoolerHeightCm}cm`]);
  if (specs.wattage) items.push(["瓦數", `${specs.wattage}W`]);
  product.tags.slice(0, 4).forEach((tag) => {
    if (items.length < 4 && !items.some(([, value]) => value === tag)) items.push(["規格", tag]);
  });
  return items.slice(0, 6);
}

function getTotal(parts) {
  return Object.values(parts).reduce((sum, product) => sum + product.price, 0);
}

function getDefaultQuoteName() {
  const date = new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit" }).format(new Date());
  return `PCShop 估價單 ${date}`;
}

function formatPrice(value) {
  return `$${Number(value || 0).toLocaleString("en-US")}`;
}

function intersects(a, b) {
  if (!a?.length || !b?.length) return true;
  return a.some((item) => b.includes(item));
}

function labelList(items) {
  return items?.length ? items.join("/") : "未標示";
}

function showNotice(type, message) {
  window.clearTimeout(noticeTimer);
  els.notice.textContent = message;
  els.notice.className = `notice is-${type}`;
  els.notice.hidden = false;
  noticeTimer = window.setTimeout(() => {
    els.notice.hidden = true;
  }, 4200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showNotice("success", "規格已複製。");
  } catch {
    showNotice("warning", "瀏覽器未允許複製，請手動選取文字。");
  }
}

function formatQuoteText(parts, name) {
  const lines = [`${name}`, `總額：${formatPrice(getTotal(parts))}`];
  REQUIRED_CATEGORIES.forEach((category) => {
    const part = parts[category];
    lines.push(`${CATEGORY_META[category].label}：${part ? `${part.name} ${formatPrice(part.price)}` : "未選"}`);
  });
  return lines.join("\n");
}

function formatSavedQuoteText(quote) {
  const parts = {};
  Object.entries(quote.parts).forEach(([category, productId]) => {
    const product = products.find((item) => item.id === productId);
    if (product) parts[category] = product;
  });
  return formatQuoteText(parts, quote.name);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
