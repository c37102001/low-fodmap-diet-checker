# 低腹敏飲食檢查

提供繁體中文低 FODMAP 食物搜尋與六大類瀏覽，並有 Firebase 管理後台：可使用圖形化 CRUD 或完整 JSON 編輯器管理所有資料。

## 本機執行

```bash
npm install
cp .env.example .env.local
# 填入 Firebase Web app 設定（本機唯讀預覽可先略過）
npm run dev
```

未設定 Firebase 時，公開頁會載入 `low-fodmap-foods.zh-TW.json` 的唯讀種子資料。以 `npm run build` 建置 production 版本。

## Firebase 首次設定

1. 在 Firebase Console 建立專案，註冊 **Web app**，並啟用 **Authentication → Email/Password** 與 **Cloud Firestore**。
2. 將 Web app config 的值填到 `.env.local`；發布到 GitHub Pages 時，將相同值放入 repository 的 **Settings → Secrets and variables → Actions → Variables**。這些 Web config 是公開識別設定，絕不可填入服務帳戶私鑰。
3. 用 Firebase Console 新增第一位 Email/Password 管理員，記下該使用者 UID。在 Firestore Console 建立 `admins/{UID}` 文件，欄位設定為：

   ```json
   { "email": "admin@example.com", "active": true }
   ```

4. 安裝並登入 Firebase CLI 後部署規則：

   ```bash
   npx firebase-tools login
   npx firebase-tools use YOUR_PROJECT_ID
   npx firebase-tools deploy --only firestore:rules
   ```

5. 以具有 Firebase Admin 權限的本機身分登入 Google Cloud ADC（`gcloud auth application-default login`），或暫時設定 `FIREBASE_SERVICE_ACCOUNT_JSON`。接著匯入初始資料：

   ```bash
   FIREBASE_PROJECT_ID=YOUR_PROJECT_ID npm run seed:firestore
   ```

   此操作只會寫入 `appData/foodDatabase`，不會把服務憑證存入專案或 GitHub。

完成後，登入 `/#/admin/login`，此帳號即可圖形化新增／編輯／刪除資料，或切換到完整 JSON 模式。

## 資安模型

- 未登入訪客：只能讀取 `appData/foodDatabase`，以支援公開搜尋頁。
- 已登入一般使用者：沒有後台存取／寫入權限。
- 活躍管理員：必須同時通過 Firebase Auth，且有 `admins/{uid}.active === true`；才能寫入食物資料。
- 管理員名單不能經由網站修改，只能由 Firebase Console 或 Admin SDK 維護。

詳細設計、資料模型、驗收條件與限制請見 [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)。

## GitHub Pages 發布

1. 將專案推送到 GitHub repository 的 `main` 分支。
2. 到 repository **Settings → Pages**，將 Source 設定為 **GitHub Actions**。
3. workflow `.github/workflows/deploy-pages.yml` 會於每次推送後執行 build 與部署。
4. `vite.config.ts` 已預設 GitHub Actions 時的 project-page base path 為 `/low-fodmap-diet-checker/`。若 repository 名稱不同，請同步調整該值。

## 注意

食物 FODMAP 分類會受份量、品種、成熟度及烹調方式影響。本資料庫是一般低 FODMAP 排除期的參考，不能取代個別醫囑或營養師建議；詳細來源與每項備註保留於 JSON 資料庫中。
