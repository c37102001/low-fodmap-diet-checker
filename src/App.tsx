import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { auth, isFirebaseConfigured } from './firebase';
import { getAdminStatus, saveFoodDatabase, subscribeToFoodDatabase, type DatabaseSource } from './database';
import { cloneDatabase, createCategory, flattenFoods, formatUpdatedAt, getStatusLabel, seedDatabase } from './data';
import { validateFoodDatabase } from './validation';
import type { Category, Food, FoodDatabase, FoodResult, FodmapStatus, Subcategory } from './types';

const statusOptions: { value: FodmapStatus; label: string }[] = [
  { value: 'low', label: '低腹敏' },
  { value: 'high', label: '高腹敏' },
];

const JsonCodeEditor = lazy(() => import('./JsonCodeEditor'));

function App() {
  const [database, setDatabase] = useState<FoodDatabase>(() => cloneDatabase(seedDatabase));
  const [source, setSource] = useState<DatabaseSource>('seed');
  const [dataError, setDataError] = useState('');
  const user = useAuthUser();

  useEffect(() => {
    const unsubscribe = subscribeToFoodDatabase(
      (nextDatabase, nextSource) => {
        setDatabase(nextDatabase);
        setSource(nextSource);
        setDataError('');
      },
      setDataError,
    );
    return unsubscribe;
  }, []);

  return (
    <Routes>
      <Route path="/" element={<PublicPage database={database} source={source} dataError={dataError} />} />
      <Route path="/admin/login" element={<AdminLogin user={user} />} />
      <Route path="/admin" element={<AdminPage database={database} source={source} user={user} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    if (!auth) {
      setUser(null);
      return undefined;
    }
    return onAuthStateChanged(auth, setUser);
  }, []);
  return user;
}

interface PublicPageProps {
  database: FoodDatabase;
  source: DatabaseSource;
  dataError: string;
}

function PublicPage({ database, source, dataError }: PublicPageProps) {
  const [query, setQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'name' | 'content'>('name');
  const [status, setStatus] = useState<'all' | FodmapStatus>('all');
  const [categoryId, setCategoryId] = useState('all');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const allFoods = useMemo(() => flattenFoods(database), [database]);
  const results = useMemo(
    () =>
      allFoods.filter((food) => {
        const searchText = searchScope === 'name'
          ? food.name.toLocaleLowerCase()
          : [
              food.name,
              ...(food.aliases ?? []),
              food.categoryName,
              food.subcategoryName,
              food.note,
              ...(food.fodmapTypes ?? []).map((type) => database.fodmapTypes[type] ?? type),
            ]
              .join(' ')
              .toLocaleLowerCase();
        return (
          (!normalizedQuery || searchText.includes(normalizedQuery)) &&
          (status === 'all' || food.status === status) &&
          (categoryId === 'all' || food.categoryId === categoryId)
        );
      }),
    [allFoods, categoryId, database.fodmapTypes, normalizedQuery, searchScope, status],
  );
  const hasActiveSearch = Boolean(normalizedQuery || status !== 'all' || categoryId !== 'all');

  return (
    <main>
      <header className="site-header">
        <div className="container header-content">
          <Link className="brand" to="/" aria-label="回到低腹敏飲食檢查首頁">
            <span className="brand-mark" aria-hidden="true">F</span>
            <span>低腹敏飲食檢查</span>
          </Link>
          <Link className="admin-link" to="/admin/login">管理後台</Link>
        </div>
      </header>

      <section className="container search-section" aria-labelledby="search-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">低腹敏飲食檢查</p>
            <h1 id="search-heading">吃之前，先查一下</h1>
          </div>
          {source === 'seed' && isFirebaseConfigured && <span className="sync-label">資料庫尚未建立，顯示種子資料</span>}
        </div>
        {dataError && <div className="message message-error" role="alert">{dataError}</div>}
        <div className="search-input-row">
          <div className="search-box">
            <label className="sr-only" htmlFor="food-search">搜尋食物</label>
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              id="food-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：雞肉、豆腐、蘋果、燕麥…"
              autoComplete="off"
            />
            {query && <button className="icon-button" type="button" onClick={() => setQuery('')} aria-label="清除搜尋">×</button>}
          </div>
          <div className="search-scope-toggle" role="group" aria-label="搜尋範圍">
            <button type="button" className={searchScope === 'name' ? 'active' : ''} aria-pressed={searchScope === 'name'} onClick={() => setSearchScope('name')}>食物名稱</button>
            <button type="button" className={searchScope === 'content' ? 'active' : ''} aria-pressed={searchScope === 'content'} onClick={() => setSearchScope('content')}>所有內容</button>
          </div>
        </div>
        <div className="filter-row" aria-label="搜尋篩選">
          <FilterButton active={status === 'all'} onClick={() => setStatus('all')}>全部</FilterButton>
          <FilterButton active={status === 'low'} onClick={() => setStatus('low')}><span className="dot dot-low" />低腹敏</FilterButton>
          <FilterButton active={status === 'high'} onClick={() => setStatus('high')}><span className="dot dot-high" />高腹敏</FilterButton>
          <label className="category-select">
            <span className="sr-only">依飲食分類篩選</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="all">所有分類</option>
              {database.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>
        {hasActiveSearch && <SearchResults results={results} database={database} searchScope={searchScope} />}
      </section>

      <section className="container browse-section" aria-labelledby="browse-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">分類瀏覽</p>
            <h2 id="browse-heading">依六大類找食物</h2>
          </div>
          <p>展開分類，查看細項中的低腹敏與高腹敏食物。</p>
        </div>
        <div className="category-list">
          {database.categories.map((category) => (
            <CategoryAccordion key={category.id} category={category} database={database} defaultOpen={false} />
          ))}
        </div>
      </section>

      <Footer database={database} />
    </main>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`filter-button ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>;
}

function SearchResults({ results, database, searchScope }: { results: FoodResult[]; database: FoodDatabase; searchScope: 'name' | 'content' }) {
  return (
    <div className="search-results" aria-live="polite">
      <p className="result-summary">以「{searchScope === 'name' ? '食物名稱' : '所有內容'}」搜尋，找到 <strong>{results.length}</strong> 項食物</p>
      {results.length === 0 ? (
        <div className="empty-state">沒有符合的食物。試試較短的關鍵字，或改用分類瀏覽。</div>
      ) : (
        <div className="food-grid">
          {results.map((food) => <FoodCard key={food.key} food={food} database={database} />)}
        </div>
      )}
    </div>
  );
}

function CategoryAccordion({ category, database, defaultOpen }: { category: Category; database: FoodDatabase; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const total = category.subcategories.reduce((count, subcategory) => count + subcategory.foods.length, 0);
  return (
    <article className={`category-card ${isOpen ? 'open' : ''}`}>
      <button className="category-toggle" type="button" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
        <span className="category-number">{String(database.categories.findIndex((item) => item.id === category.id) + 1).padStart(2, '0')}</span>
        <span className="category-title"><strong>{category.name}</strong><small>{total} 項食物 · {category.subcategories.length} 個細項</small></span>
        <span className="chevron" aria-hidden="true">⌄</span>
      </button>
      {isOpen && <div className="subcategory-list">
        {category.subcategories.map((subcategory) => <SubcategoryPanel key={subcategory.id} subcategory={subcategory} category={category} database={database} />)}
      </div>}
    </article>
  );
}

function SubcategoryPanel({ category, subcategory, database }: { category: Category; subcategory: Subcategory; database: FoodDatabase }) {
  const [expanded, setExpanded] = useState(false);
  const lowFoods = subcategory.foods.filter((food) => food.status === 'low');
  const highFoods = subcategory.foods.filter((food) => food.status === 'high');
  return (
    <section className="subcategory-panel">
      <button className="subcategory-toggle" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span>{subcategory.name}</span><span>{expanded ? '−' : '+'}</span>
      </button>
      {expanded && <div className="status-columns">
        <FoodColumn status="low" foods={lowFoods} category={category} subcategory={subcategory} database={database} />
        <FoodColumn status="high" foods={highFoods} category={category} subcategory={subcategory} database={database} />
      </div>}
    </section>
  );
}

function FoodColumn({ status, foods, category, subcategory, database }: { status: FodmapStatus; foods: Food[]; category: Category; subcategory: Subcategory; database: FoodDatabase }) {
  return (
    <div className={`food-column ${status}`}>
      <h3><span className={`dot dot-${status}`} />{getStatusLabel(status)} <small>{foods.length}</small></h3>
      {foods.length ? foods.map((food) => <FoodCard key={`${category.id}-${subcategory.id}-${food.name}`} food={{ ...food, key: `${category.id}-${subcategory.id}-${food.name}`, categoryId: category.id, categoryName: category.name, subcategoryId: subcategory.id, subcategoryName: subcategory.name }} database={database} compact />) : <p className="empty-column">暫無資料</p>}
    </div>
  );
}

function FoodCard({ food, database, compact = false }: { food: FoodResult; database: FoodDatabase; compact?: boolean }) {
  const fodmapNames = (food.fodmapTypes ?? []).map((type) => database.fodmapTypes[type] ?? type);
  return (
    <article className={`food-card ${compact ? 'compact' : ''}`}>
      <div className="food-card-top">
        <h3>{food.name}</h3>
        <span className={`status-badge ${food.status}`}>{getStatusLabel(food.status)}</span>
      </div>
      {!compact && <p className="food-path">{food.categoryName} <span>›</span> {food.subcategoryName}</p>}
      {food.aliases?.length ? <p className="food-aliases">別名：{food.aliases.join('、')}</p> : null}
      {fodmapNames.length ? <p className="fodmap-tags">{fodmapNames.map((type) => <span key={type}>{type}</span>)}</p> : null}
      <p className="food-note">{food.note}</p>
    </article>
  );
}

function Footer({ database }: { database: FoodDatabase }) {
  return <footer className="site-footer"><div className="container footer-grid"><div><strong>低腹敏飲食檢查</strong><p>{database.medicalNotice}</p></div><div><strong>資料依據</strong><ul>{database.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></li>)}</ul></div></div></footer>;
}

function AdminLogin({ user }: { user: User | null | undefined }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/admin" replace />;
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return;
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/admin');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '登入失敗，請稍後再試。';
      setError(message.includes('invalid-credential') || message.includes('wrong-password') ? '帳號或密碼不正確。' : `登入失敗：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return <AdminShell><div className="login-card"><Link className="back-link" to="/">← 回公開查詢頁</Link><p className="eyebrow">ADMIN ONLY</p><h1>管理員登入</h1><p>登入後可透過圖形化操作或完整 JSON 編輯資料庫。</p>{!isFirebaseConfigured ? <div className="message message-warning">尚未設定 Firebase。請依 <code>.env.example</code> 建立 <code>.env.local</code> 後重新啟動網站。</div> : <form onSubmit={handleSubmit} className="login-form"><label>電子郵件<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>密碼<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <div className="message message-error" role="alert">{error}</div>}<button className="primary-button" disabled={isSubmitting}>{isSubmitting ? '登入中…' : '登入後台'}</button></form>}</div></AdminShell>;
}

function AdminShell({ children }: { children: ReactNode }) { return <main className="admin-page"><header className="admin-header"><div className="container"><Link className="brand" to="/"><span className="brand-mark">F</span><span>低腹敏飲食檢查</span></Link></div></header><div className="container admin-container">{children}</div></main>; }

function AdminPage({ database, source, user }: { database: FoodDatabase; source: DatabaseSource; user: User | null | undefined }) {
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);
  const [checkError, setCheckError] = useState('');
  useEffect(() => {
    if (!user) { setIsAdmin(undefined); return; }
    getAdminStatus(user.uid).then(setIsAdmin).catch(() => { setIsAdmin(false); setCheckError('無法驗證管理員權限。'); });
  }, [user]);

  if (user === undefined) return <AdminShell><p className="loading">正在確認登入狀態…</p></AdminShell>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (isAdmin === undefined) return <AdminShell><p className="loading">正在確認管理員權限…</p></AdminShell>;
  if (!isAdmin) return <AdminShell><section className="access-card"><h1>沒有後台存取權</h1><p>{checkError || '此帳戶尚未列入管理員名單。請由專案管理者在 Firebase 的 admins 集合新增你的 UID，並設定 active: true。'}</p><button className="secondary-button" onClick={() => auth && signOut(auth)}>登出</button></section></AdminShell>;
  return <AdminShell><AdminEditor initialDatabase={database} source={source} email={user.email ?? '管理員'} /></AdminShell>;
}

function AdminEditor({ initialDatabase, source, email }: { initialDatabase: FoodDatabase; source: DatabaseSource; email: string }) {
  const [draft, setDraft] = useState(() => cloneDatabase(initialDatabase));
  const [mode, setMode] = useState<'visual' | 'json'>('visual');
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initialDatabase, null, 2));
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!hasChanges) {
      setDraft(cloneDatabase(initialDatabase));
      setJsonText(JSON.stringify(initialDatabase, null, 2));
    }
  }, [hasChanges, initialDatabase]);

  const updateDraft = (recipe: (next: FoodDatabase) => void) => {
    setDraft((current) => { const next = cloneDatabase(current); recipe(next); return next; });
    setHasChanges(true);
    setMessage('');
  };
  const parseJsonIntoDraft = (): FoodDatabase | undefined => {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      const result = validateFoodDatabase(parsed);
      if (!result.valid) { setMessage(`JSON 資料驗證失敗：${result.errors[0]}`); return undefined; }
      setDraft(result.data);
      setHasChanges(true);
      setMessage('JSON 已通過驗證，尚未儲存到 Firebase。');
      return result.data;
    } catch (error) {
      setMessage(`JSON 語法錯誤：${error instanceof Error ? error.message : '請檢查內容。'}`);
      return undefined;
    }
  };
  const save = async (databaseToSave = draft) => {
    const validation = validateFoodDatabase(databaseToSave);
    if (!validation.valid) { setMessage(`無法儲存：${validation.errors[0]}`); return; }
    setIsSaving(true);
    setMessage('');
    try {
      await saveFoodDatabase(validation.data);
      setDraft(validation.data);
      setJsonText(JSON.stringify(validation.data, null, 2));
      setHasChanges(false);
      setMessage('已安全儲存到 Firebase，公開頁會即時更新。');
    } catch (error) { setMessage(`儲存失敗：${error instanceof Error ? error.message : '請稍後再試。'}`); } finally { setIsSaving(false); }
  };
  const handleJsonSave = () => { const parsed = parseJsonIntoDraft(); if (parsed) void save(parsed); };

  return <>
    <div className="admin-toolbar"><div><Link className="back-link" to="/">← 查看公開頁</Link><h1>食物資料管理</h1><p>登入帳戶：{email} · {source === 'firebase' ? `最後更新：${formatUpdatedAt(initialDatabase.updatedAt)}` : '目前為本機種子資料'}</p></div><button className="secondary-button" onClick={() => auth && signOut(auth)}>登出</button></div>
    {source === 'seed' && <div className="message message-warning">Firebase 尚未建立 foodDatabase 文件，管理後台不能儲存。請先依 README 匯入種子資料。</div>}
    <div className="editor-tabs" role="tablist" aria-label="編輯模式"><button role="tab" aria-selected={mode === 'visual'} className={mode === 'visual' ? 'active' : ''} onClick={() => setMode('visual')}>圖形化編輯</button><button role="tab" aria-selected={mode === 'json'} className={mode === 'json' ? 'active' : ''} onClick={() => { setMode('json'); setJsonText(JSON.stringify(draft, null, 2)); }}>完整 JSON</button></div>
    {message && <div className={`message ${message.includes('失敗') || message.includes('錯誤') || message.includes('無法') ? 'message-error' : 'message-success'}`} role="status">{message}</div>}
    {mode === 'visual' ? <VisualEditor database={draft} updateDatabase={updateDraft} /> : <JsonEditor value={jsonText} onChange={(value) => { setJsonText(value); setHasChanges(true); setMessage(''); }} onValidate={parseJsonIntoDraft} />}
    <div className="save-bar"><span>{hasChanges ? '有未儲存的變更' : '所有變更已同步'}</span><div>{mode === 'json' && <button className="secondary-button" onClick={parseJsonIntoDraft}>驗證 JSON</button>}<button className="primary-button" disabled={isSaving || source !== 'firebase'} onClick={() => mode === 'json' ? handleJsonSave() : void save()}>{isSaving ? '儲存中…' : '儲存所有變更'}</button></div></div>
  </>;
}

function JsonEditor({ value, onChange, onValidate }: { value: string; onChange: (value: string) => void; onValidate: () => void }) {
  return <section className="json-editor-panel"><div className="editor-intro"><div><h2>完整 JSON 編輯</h2><p>修改後先驗證；只有符合資料結構的內容才能儲存。請保留六大類及每個食物的 <code>name</code>、<code>status</code>、<code>note</code>。</p></div><button className="text-button" onClick={onValidate}>立即驗證</button></div><Suspense fallback={<p className="loading">正在載入 JSON 編輯器…</p>}><JsonCodeEditor value={value} onChange={onChange} /></Suspense></section>;
}

function VisualEditor({ database, updateDatabase }: { database: FoodDatabase; updateDatabase: (recipe: (next: FoodDatabase) => void) => void }) {
  const addCategory = () => updateDatabase((next) => next.categories.push(createCategory()));
  return <section className="visual-editor"><div className="editor-intro"><div><h2>圖形化編輯</h2><p>展開分類以新增、修改或刪除細項與食物。刪除操作不可復原，請確認後再執行。</p></div><button className="secondary-button" onClick={addCategory}>＋ 新增分類</button></div>{database.categories.map((category, categoryIndex) => <CategoryEditor key={`${category.id}-${categoryIndex}`} category={category} categoryIndex={categoryIndex} database={database} updateDatabase={updateDatabase} />)}</section>;
}

function CategoryEditor({ category, categoryIndex, database, updateDatabase }: { category: Category; categoryIndex: number; database: FoodDatabase; updateDatabase: (recipe: (next: FoodDatabase) => void) => void }) {
  const changeCategory = (value: string) => updateDatabase((next) => { next.categories[categoryIndex].name = value; });
  const addSubcategory = () => updateDatabase((next) => { const item = next.categories[categoryIndex]; item.subcategories.push({ id: `subcategory-${Date.now()}`, name: '新細項', foods: [] }); });
  const removeCategory = () => { if (window.confirm(`確定刪除「${category.name}」及其所有食物？`)) updateDatabase((next) => { next.categories.splice(categoryIndex, 1); }); };
  return <details className="admin-category" open><summary><span>{category.name}</span><small>{category.subcategories.length} 個細項</small></summary><div className="admin-category-content"><div className="entity-row"><label>分類名稱<input value={category.name} onChange={(event) => changeCategory(event.target.value)} /></label><span className="readonly-id">ID：{category.id}</span><button className="danger-button" onClick={removeCategory}>刪除分類</button></div>{category.subcategories.map((subcategory, subcategoryIndex) => <SubcategoryEditor key={`${subcategory.id}-${subcategoryIndex}`} categoryIndex={categoryIndex} subcategory={subcategory} subcategoryIndex={subcategoryIndex} database={database} updateDatabase={updateDatabase} />)}<button className="add-button" onClick={addSubcategory}>＋ 新增細項</button></div></details>;
}

function SubcategoryEditor({ categoryIndex, subcategory, subcategoryIndex, database, updateDatabase }: { categoryIndex: number; subcategory: Subcategory; subcategoryIndex: number; database: FoodDatabase; updateDatabase: (recipe: (next: FoodDatabase) => void) => void }) {
  const remove = () => { if (window.confirm(`確定刪除細項「${subcategory.name}」及其所有食物？`)) updateDatabase((next) => { next.categories[categoryIndex].subcategories.splice(subcategoryIndex, 1); }); };
  const addFood = () => updateDatabase((next) => { next.categories[categoryIndex].subcategories[subcategoryIndex].foods.push({ name: '新食物', status: 'low', note: '請填寫份量或食用注意事項。' }); });
  return <section className="admin-subcategory"><div className="entity-row"><label>細項名稱<input value={subcategory.name} onChange={(event) => updateDatabase((next) => { next.categories[categoryIndex].subcategories[subcategoryIndex].name = event.target.value; })} /></label><span className="readonly-id">ID：{subcategory.id}</span><button className="danger-button" onClick={remove}>刪除細項</button></div><div className="food-editor-list">{subcategory.foods.map((food, foodIndex) => <FoodEditor key={`${food.name}-${foodIndex}`} food={food} fodmapTypes={database.fodmapTypes} onChange={(updatedFood) => updateDatabase((next) => { next.categories[categoryIndex].subcategories[subcategoryIndex].foods[foodIndex] = updatedFood; })} onRemove={() => { if (window.confirm(`確定刪除「${food.name}」？`)) updateDatabase((next) => { next.categories[categoryIndex].subcategories[subcategoryIndex].foods.splice(foodIndex, 1); }); }} />)}</div><button className="add-button" onClick={addFood}>＋ 新增食物</button></section>;
}

function FoodEditor({ food, fodmapTypes, onChange, onRemove }: { food: Food; fodmapTypes: Record<string, string>; onChange: (food: Food) => void; onRemove: () => void }) {
  const update = <K extends keyof Food>(key: K, value: Food[K]) => onChange({ ...food, [key]: value });
  return <article className="food-editor"><div className="food-editor-top"><label>食物名稱<input value={food.name} onChange={(event) => update('name', event.target.value)} /></label><label>分類<select value={food.status} onChange={(event) => update('status', event.target.value as FodmapStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className="danger-icon" aria-label={`刪除 ${food.name}`} onClick={onRemove}>×</button></div><label>別名（以逗號分隔）<input value={(food.aliases ?? []).join(', ')} onChange={(event) => update('aliases', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="例如：英文名稱, 常見別稱" /></label><fieldset><legend>FODMAP 類型（可複選）</legend><div className="checkbox-row">{Object.entries(fodmapTypes).map(([key, label]) => <label key={key}><input type="checkbox" checked={(food.fodmapTypes ?? []).includes(key)} onChange={(event) => { const values = new Set(food.fodmapTypes ?? []); event.target.checked ? values.add(key) : values.delete(key); update('fodmapTypes', [...values]); }} />{label}</label>)}</div></fieldset><label>份量／食用注意事項<textarea value={food.note} onChange={(event) => update('note', event.target.value)} rows={2} /></label></article>;
}

export default App;
