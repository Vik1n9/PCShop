const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = __dirname;
const PRODUCTS_PATH = process.env.PRODUCTS_PATH || path.join(ROOT, "data", "products.csv");
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const SESSION_COOKIE = "pcshop_admin=1";
const PRODUCT_COLUMNS = [
  "id",
  "category",
  "category_label",
  "name",
  "stock",
  "price",
  "tags",
  "badges",
  "restriction",
  "tone",
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function createAppServer() {
  return http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await routeApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    if (error.clientError) {
      sendJson(response, 400, error.clientError);
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: "server_error", message: "後端服務發生錯誤。" });
  }
  });
}

function startServer() {
  const server = createAppServer();
  server.listen(PORT, HOST, () => {
    console.log(`PCShop server running at http://${HOST}:${PORT}/`);
    console.log(`Admin panel: http://${HOST}:${PORT}/admin.html`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

async function routeApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/session") {
    sendJson(response, 200, { authenticated: isAuthenticated(request) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    await readJsonBody(request);
    response.setHeader("Set-Cookie", `${SESSION_COOKIE}; Path=/; SameSite=Lax`);
    sendJson(response, 200, { authenticated: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/logout") {
    response.setHeader("Set-Cookie", "pcshop_admin=; Path=/; Max-Age=0; SameSite=Lax");
    sendJson(response, 200, { authenticated: false });
    return;
  }

  if (!isAuthenticated(request)) {
    sendJson(response, 401, { error: "unauthorized", message: "請先登入後台。" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/products") {
    const products = await readProducts();
    sendJson(response, 200, { columns: PRODUCT_COLUMNS, products });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/products") {
    const input = await readJsonBody(request);
    const products = await readProducts();
    const product = normalizeProductInput(input.product || input, products);
    if (products.some((item) => item.id === product.id)) {
      sendJson(response, 409, { error: "duplicate_id", message: "產品 ID 已存在。" });
      return;
    }
    products.push(product);
    await writeProducts(products);
    sendJson(response, 201, { product });
    return;
  }

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && request.method === "PUT") {
    const productId = decodeURIComponent(productMatch[1]);
    const input = await readJsonBody(request);
    const products = await readProducts();
    const index = products.findIndex((product) => product.id === productId);
    if (index === -1) {
      sendJson(response, 404, { error: "not_found", message: "找不到產品。" });
      return;
    }
    const updated = normalizeProductInput({ ...products[index], ...(input.product || input), id: productId }, products);
    products[index] = updated;
    await writeProducts(products);
    sendJson(response, 200, { product: updated });
    return;
  }

  if (productMatch && request.method === "DELETE") {
    const productId = decodeURIComponent(productMatch[1]);
    const products = await readProducts();
    const nextProducts = products.filter((product) => product.id !== productId);
    if (nextProducts.length === products.length) {
      sendJson(response, 404, { error: "not_found", message: "找不到產品。" });
      return;
    }
    await writeProducts(nextProducts);
    sendJson(response, 200, { deletedId: productId });
    return;
  }

  sendJson(response, 404, { error: "not_found", message: "找不到 API。" });
}

async function serveStatic(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(ROOT, safePath));
  if (!filePath.startsWith(ROOT)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(response, 404, "Not found");
      return;
    }
    throw error;
  }
}

async function readProducts() {
  const csv = await fs.readFile(PRODUCTS_PATH, "utf8");
  return parseCsv(csv);
}

async function writeProducts(products) {
  const csv = [
    PRODUCT_COLUMNS.join(","),
    ...products.map((product) => PRODUCT_COLUMNS.map((column) => escapeCsv(product[column] || "")).join(",")),
  ].join("\n") + "\n";
  const tempPath = `${PRODUCTS_PATH}.tmp`;
  await fs.writeFile(tempPath, csv, "utf8");
  await fs.rename(tempPath, PRODUCTS_PATH);
}

function normalizeProductInput(input, existingProducts) {
  const product = {};
  PRODUCT_COLUMNS.forEach((column) => {
    product[column] = String(input[column] ?? "").trim();
  });
  product.id = product.id || nextProductId(existingProducts);
  product.stock = String(toNonNegativeInteger(product.stock));
  product.price = String(toNonNegativeNumber(product.price));

  if (!product.category) throwClientError("category_required", "請選擇產品分類。");
  if (!product.category_label) product.category_label = product.category;
  if (!product.name) throwClientError("name_required", "請輸入產品名稱。");
  return product;
}

function nextProductId(products) {
  const highest = products.reduce((max, product) => {
    const match = String(product.id || "").match(/^p(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `p${String(highest + 1).padStart(3, "0")}`;
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function toNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      value += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
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
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throwClientError("invalid_json", "JSON 格式錯誤。");
  }
}

function isAuthenticated(request) {
  return String(request.headers.cookie || "").split(";").map((part) => part.trim()).includes(SESSION_COOKIE);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, body) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

function throwClientError(error, message) {
  const exception = new Error(message);
  exception.clientError = { error, message };
  throw exception;
}

module.exports = {
  PRODUCT_COLUMNS,
  createAppServer,
  parseCsv,
  readProducts,
  writeProducts,
};
