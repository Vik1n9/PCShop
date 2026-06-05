# PCShop 線上估價單

手機優先的電腦組裝估價單前端雛形。現階段以前端靜態頁面載入 CSV 資料，先完成零件挑選、相容性提示、進度總覽與估價單儲存流程，之後可將 `data/products.csv` 的資料入口替換為正式 API。

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
