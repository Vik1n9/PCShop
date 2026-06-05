# PCShop 線上估價單

旗下旗艦數位產品。手機優先的電腦組裝估價單前端雛形：以前端靜態頁面載入 CSV 資料，完成零件挑選、相容性提示、進度總覽與估價單儲存流程，之後可將 `data/products.csv` 的資料入口替換為正式 API。介面美術與互動依《[規格書](規格書.txt)》、[`PRODUCT.md`](PRODUCT.md) 與 **泓達電腦 PCShop 設計系統** 實作，定調為「沉穩、精準、守護」的新手友善風格。

## 線上測試（GitHub Pages）

直接用瀏覽器開啟以下網址即可測試，免下載、免本機伺服器：

👉 **https://vik1n9.github.io/PCShop/**

本倉庫已啟用 GitHub Pages（來源為 **GitHub Actions**），並內建自動部署流程（`.github/workflows/pages.yml`）：每次推送到 `main` 分支，就會自動把整個靜態站台重新發佈到上述網址。也可在 **Actions → Deploy to GitHub Pages** 手動觸發，或從該工作流程的 `github-pages` 環境連結直接進站。

> 此網址為公開可存取；倉庫設為 private 時，公開 Pages 需要 GitHub Pro / Team / Enterprise 方案。

## 目前功能

- 零件分類切換：處理器、主機板、記憶體、顯示卡、儲存裝置、機殼、電源供應器、散熱器與其他零件。
- CSV 資料載入與瀏覽器端解析。
- 依已選零件進行相容性過濾。
- 不相容品項可用「顯示全部」查看，會以灰階標示、加上「不相容」角標並停用加入按鈕。
- 產品卡片原地展開、完整介紹對話框、重點規格與完整規格表。
- 組裝進度、總價、軟警告、估價單儲存、載入、刪除、複製與列印。
- 硬衝突、軟警告、成功提示以語意色與圖示呈現，並用頂部浮出 toast 通知。
- 手機單欄與桌面雙欄（總覽 40% / 挑選 60%）版面。

## 介面設計

美術與排版依《規格書》第六章「行動優先互動設計」與 `PRODUCT.md` 的品牌個性重做，重點原則：

- **沉穩 / 精準 / 守護**：沉穩靛藍品牌色、青藍輔助色（代表「相容 / 通過」）、冷調中性灰與完整語意色。
- **漸進式資訊揭露**：先看名稱、價格、關鍵規格；細節透過點擊原地展開或全螢幕覆蓋層揭示。
- **清楚的狀態語意**：已選 / 展開 / 不相容 / 軟警告各有明確視覺與文字。
- **行動優先、拇指友善**：底部導覽、可滑動類別膠囊、全螢幕由下滑入的完整介紹。
- **品牌字體**：Inter（西文 / 數字）+ Noto Sans TC（繁體中文），自 Google Fonts 載入。
- **無障礙**：顧及 WCAG AA 對比、可見 focus 樣式，並支援 `prefers-reduced-motion` 減動偏好。

樣式分兩層：

- `colors_and_type.css` — design tokens（`:root` 的色彩、字體、字級、字重、圓角、陰影、產品色調）與語意排版 helper class，是視覺事實來源。
- `styles.css` — 元件層樣式，全部引用上述 token。

品牌素材集中於 `assets/`：`logo-mark.svg`（PC 漸層圓角方塊，topbar 標誌與 favicon 使用）、`logo-lockup.svg`（含「泓達電腦 · 線上估價單」字標）、`icons/*.svg`（狀態線稿圖示）。

## 本機預覽

因瀏覽器需要透過 HTTP 才能 `fetch()` CSV，請用本機伺服器開啟：

```bash
python3 -m http.server 4173
```

然後前往：

```text
http://localhost:4173/
```

## 資料來源

- `規格書.txt`：產品與互動規格。
- `list.txt`：demo 商品資料原始清單。
- `data/products.csv`：目前前端實際讀取的暫代商品資料。

## 維護方向

- 若後端 API 完成，優先替換 `script.js` 內的 `DATA_URL` 與 `fetchProducts()`。
- 若商品欄位增加，請同步更新 `data/products.csv` 與 `normalizeProduct()`。
- 相容性規則目前在前端 `checkBuild()`，正式版建議移至後端 API，前端只負責呈現 API 回傳的 hard conflict 與 soft warning。
- 調整外觀時優先修改 `colors_and_type.css` `:root` 的 design tokens，可一次套用全站色彩、字級與間距；`styles.css` 為元件層、`script.js` 產生的 class 名稱與 DOM 結構即為樣式對應的接點，盡量沿用以免破壞既有樣式。
