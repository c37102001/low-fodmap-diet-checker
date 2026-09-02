# 低腹敏飲食檢查網頁：實作計畫

## 目標與範圍

建立可部署至 GitHub Pages 的繁體中文單頁網站，讓使用者可：

1. 以關鍵字搜尋食物，立刻查看其低／高 FODMAP 分類、細項分類、建議份量與注意事項。
2. 依六大類與細項分類瀏覽食物：全穀雜糧、豆魚蛋肉、乳品、蔬菜、水果、油脂與堅果種子。
3. 管理員以 Firebase Auth 登入後，在後台用圖形化介面或完整 JSON 編輯器新增、修改、刪除資料。

食物判定為健康資訊，不取代醫療或營養師建議。介面需明確保留「份量、成熟度、料理方式會改變 FODMAP 結果」的提示。

## 技術選型

| 層面 | 選擇 | 理由 |
| --- | --- | --- |
| 前端 | React + TypeScript + Vite | 元件化、型別保護、建置快速，適合靜態部署。 |
| 樣式 | CSS variables + 原生 CSS | 不增加 UI 框架負擔，能精確做桌機與手機版。 |
| 路由 | React Router `HashRouter` | GitHub Pages 不需伺服器 rewrite，重新整理後也可直接開啟頁面。 |
| 資料庫 | Cloud Firestore | 提供即時讀取、文件權限與管理者修改功能。 |
| 身分驗證 | Firebase Authentication（Email/Password） | 符合帳密登入管理後台的需求。 |
| JSON 編輯器 | CodeMirror 6 | 可編輯、語法著色、錯誤提示與行號，適合完整 JSON。 |
| 部署 | GitHub Actions → GitHub Pages | 推送 `main` 後自動建置與發布。 |

## 資料模型

現有 `low-fodmap-foods.zh-TW.json` 是種子資料與可攜式完整匯出格式。前台與後台共用下列型別：

```ts
type FodmapStatus = 'low' | 'high';

interface Food {
  id: string;
  name: string;
  aliases: string[];
  status: FodmapStatus;
  fodmapTypes?: string[];
  note: string;
  sortOrder: number;
}

interface Subcategory {
  id: string;
  name: string;
  foods: Food[];
}

interface Category {
  id: string;
  name: string;
  subcategories: Subcategory[];
}

interface FoodDatabase {
  schemaVersion: string;
  title: string;
  locale: 'zh-TW';
  updatedAt: string;
  classificationBasis: string;
  medicalNotice: string;
  fodmapTypes: Record<string, string>;
  sources: Source[];
  categories: Category[];
  implementationNotes: string[];
}
```

Firestore 採用單一 `appData/foodDatabase` 文件儲存整份 JSON。以目前約 183 筆食物而言遠低於 Firestore 1 MiB 文件上限，能使完整 JSON 儲存原子化、確保圖形化編輯與 JSON 編輯器資料永遠一致。若資料未來接近限制，再遷移為各分類子集合。

另設 `admins/{uid}` 文件，例如 `{ email, active: true }`。管理員資格同時受 Firestore Rules 與前端檢查；只有 Auth 已登入且 `admins/{uid}.active == true` 的使用者可讀寫 `appData/foodDatabase`。

## 頁面與互動設計

### 公開首頁（`/#/`）

- 頁首：網站名稱、低 FODMAP 說明、前往管理後台的低干擾連結。
- 搜尋列：搜尋食物名稱、別名、分類與細項；支援即時篩選、清除按鈕與結果數量。
- 篩選器：全部／低腹敏／高腹敏，加上六大類快速篩選。
- 搜尋結果：卡片顯示名稱、低／高狀態色標、完整分類路徑、FODMAP 類型與注意事項。
- 分類瀏覽：六張類別卡片；開啟後顯示細項手風琴，並以低／高兩欄或可切換清單呈現食物。
- 固定提醒：判定基準、份量累加（stacking）與醫療提示。

### 管理登入（`/#/admin/login`）

- Email／密碼欄位、送出中狀態與安全的錯誤訊息。
- 未列在 `admins` 的已登入帳戶一律拒絕進入後台，並提供登出。

### 管理後台（`/#/admin`）

- 兩個模式分頁：**圖形化編輯**與**完整 JSON**。
- 圖形化編輯：分類、細項、食物的樹狀導覽；可新增、重新命名、刪除分類／細項，以及新增、修改、刪除食物。食物表單包含名稱、別名、低高狀態、FODMAP 類型、注意事項、排序。
- JSON 編輯：載入完整、格式化的資料庫 JSON；儲存前進行 JSON 語法與資料結構驗證，錯誤定位並顯示訊息。儲存成功後重新載入兩種模式的資料。
- 所有破壞性操作需二次確認；離開含未儲存變更的頁面前警示。
- 顯示最後更新時間、目前登入帳號、儲存／同步／錯誤狀態，並提供「回公開頁」與登出。

## 響應式與可近用性準則

- Mobile-first；最小觸控目標 44×44 px、單欄表單與底部易點擊動作列。
- 桌機在搜尋結果、分類與後台採雙欄／三欄佈局；手機收合為單欄與手風琴。
- 不只依賴顏色：每個分類狀態同時有「低腹敏／高腹敏」文字與圖示。
- 所有輸入欄有 label；手風琴、對話框、分頁具有鍵盤與 ARIA 支援；焦點樣式清楚。
- 支援較長中文食物名、低動態偏好與 200% 縮放。

## 實作順序

1. 初始化 Vite React TypeScript 專案，加入 Router、Firebase、CodeMirror，整理原始 JSON 為有穩定 ID 與別名的種子資料。
2. 建立資料型別、資料驗證函式、Firebase 初始化與讀取 hook；Firebase 未設定時以前端種子資料提供唯讀預覽，便於本機開發。
3. 建立公開搜尋、低高篩選與六大類／細項手風琴，完成手機與桌機樣式。
4. 建立 Firebase Email/Password 登入、管理員驗證與受保護路由。
5. 建立圖形化 CRUD 與完整 JSON CodeMirror；同一份暫存資料、同一套驗證，儲存使用 Firestore transaction。
6. 撰寫 Firestore／Storage 規則、Firebase 設定範本、種子資料匯入指令與 README。
7. 加入 GitHub Actions Pages workflow、`base` 設定與建置檢查；執行型別檢查、lint、production build 與主要互動測試。

## Firebase 與部署設定（需由專案擁有者完成）

1. 建立 Firebase 專案並啟用 **Authentication → Email/Password**、建立 Firestore（Production mode）。
2. 將 Web app 的公開 Firebase config 填入 `.env`（僅公開識別資訊，不能放 Admin SDK 私鑰）。
3. 在 Firebase Auth 建立第一位管理員帳戶；再建立對應的 `admins/{uid}` 文件，內容含 `active: true`。
4. 部署專案提供的 `firestore.rules`，只允許活躍管理員讀寫資料；公開訪客只可讀 `appData/foodDatabase`。
5. 以提供的 seed script 將 JSON 匯入 Firestore。此步使用 Firebase CLI 與擁有者本機登入，不會把服務帳密放進 GitHub Pages。
6. 在 GitHub repository 的 **Settings → Pages** 選擇 GitHub Actions；推送 `main` 後 workflow 會發布網站。

## 驗收條件

- 中、英文／別名關鍵字能即時搜尋，且結果正確顯示低高狀態、分類與說明。
- 六大類皆可開啟到細項，低與高 FODMAP 食物不會混淆。
- 360 px 寬手機與一般桌機都可閱讀、操作與完成搜尋。
- 非管理員不可看見或寫入編輯功能；管理員登入後可用圖形化 CRUD 成功儲存。
- 管理員貼入合法完整 JSON 可儲存；不合法 JSON 或不符合 schema 的 JSON 不會覆寫資料，且能取得明確錯誤。
- 本機 production build 成功；GitHub Actions 成功部署；Firestore Rules 在模擬器／Firebase Rules 測試中限制寫入權限。

## 已知限制與後續方向

- FODMAP 分級強烈依賴份量、品種與製法；初版保留「單次建議份量」與備註，後續可新增精確克數、圖片與來源版本欄位。
- Firestore 公開讀取是為了前台快速查詢；若希望限制存取或提供離線資料，可另加入快取策略與安全考量。
- 管理員新增帳號目前由 Firebase Console 處理；若日後需要帳號邀請與多角色，應用 Cloud Functions 與 custom claims，避免開放前台註冊。
