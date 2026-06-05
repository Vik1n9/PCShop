# PCShop 線上估價單

手機優先的電腦組裝估價單前端雛形。現階段以前端靜態頁面載入 CSV 資料，先完成零件挑選、相容性提示、進度總覽與估價單儲存流程，之後可將 `data/products.csv` 的資料入口替換為正式 API。

## 線上測試（GitHub Pages）

部署完成後，直接用瀏覽器開啟以下網址即可測試，免下載、免本機伺服器：

👉 **https://vik1n9.github.io/PCShop/**

本倉庫已內建自動部署流程（`.github/workflows/pages.yml`），每次推送到 `main` 分支就會自動把整個靜態站台發佈到 GitHub Pages。**首次需要做一次性設定才會啟用：**

1. 進入 GitHub 倉庫的 **Settings → Pages**。
2. 在 **Build and deployment → Source** 選擇 **GitHub Actions**。
3. 把本分支的變更合併進 `main`（或在 **Actions** 分頁手動執行 `Deploy to GitHub Pages`）。
4. 部署成功後，上方網址即可開啟；也可以在 **Actions → Deploy to GitHub Pages** 工作流程的 `github-pages` 環境連結直接點進站台。

> 注意：本倉庫目前為 **private**。若要讓上述網址公開可被任何人開啟，需將倉庫設為 public，或使用支援私有 Pages 的付費方案（GitHub Pro / Team / Enterprise）。在 public 倉庫下，GitHub Pages 為免費功能。

## 目前功能

- 零件分類切換：處理器、主機板、記憶體、顯示卡、儲存裝置、機殼、電源供應器、散熱器與其他零件。
- CSV 資料載入與瀏覽器端解析。
- 依已選零件進行相容性過濾。
- 不相容品項可用「顯示全部」查看，但加入按鈕會停用。
- 產品卡片展開、完整介紹對話框、重點規格與完整規格表。
- 組裝進度、總價、軟警告、估價單儲存、載入、刪除、複製與列印。
- 手機單欄與桌面雙欄版面。

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
