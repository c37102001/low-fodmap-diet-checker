import type { FoodDatabase } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateFoodDatabase(value: unknown): { valid: true; data: FoodDatabase } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['根節點必須是 JSON 物件。'] };

  const requiredText = ['schemaVersion', 'title', 'locale', 'updatedAt', 'classificationBasis', 'medicalNotice'];
  requiredText.forEach((key) => {
    if (typeof value[key] !== 'string' || value[key].trim() === '') errors.push(`「${key}」必須是非空白字串。`);
  });
  if (!isRecord(value.fodmapTypes)) errors.push('「fodmapTypes」必須是物件。');
  if (!Array.isArray(value.sources)) errors.push('「sources」必須是陣列。');
  if (!Array.isArray(value.implementationNotes)) errors.push('「implementationNotes」必須是陣列。');
  if (!Array.isArray(value.categories) || value.categories.length === 0) {
    errors.push('「categories」必須是至少含一個分類的陣列。');
  } else {
    const categoryIds = new Set<string>();
    value.categories.forEach((category, categoryIndex) => {
      if (!isRecord(category)) {
        errors.push(`categories[${categoryIndex}] 必須是物件。`);
        return;
      }
      if (typeof category.id !== 'string' || !category.id.trim()) errors.push(`categories[${categoryIndex}].id 不可空白。`);
      if (typeof category.name !== 'string' || !category.name.trim()) errors.push(`categories[${categoryIndex}].name 不可空白。`);
      if (typeof category.id === 'string') {
        if (categoryIds.has(category.id)) errors.push(`分類 id「${category.id}」重複。`);
        categoryIds.add(category.id);
      }
      if (!Array.isArray(category.subcategories)) {
        errors.push(`categories[${categoryIndex}].subcategories 必須是陣列。`);
        return;
      }
      const subcategoryIds = new Set<string>();
      category.subcategories.forEach((subcategory, subcategoryIndex) => {
        if (!isRecord(subcategory)) {
          errors.push(`categories[${categoryIndex}].subcategories[${subcategoryIndex}] 必須是物件。`);
          return;
        }
        if (typeof subcategory.id !== 'string' || !subcategory.id.trim()) errors.push(`細項 ${categoryIndex + 1}-${subcategoryIndex + 1} 的 id 不可空白。`);
        if (typeof subcategory.name !== 'string' || !subcategory.name.trim()) errors.push(`細項 ${categoryIndex + 1}-${subcategoryIndex + 1} 的名稱不可空白。`);
        if (typeof subcategory.id === 'string') {
          if (subcategoryIds.has(subcategory.id)) errors.push(`分類「${String(category.name)}」中細項 id「${subcategory.id}」重複。`);
          subcategoryIds.add(subcategory.id);
        }
        if (!Array.isArray(subcategory.foods)) {
          errors.push(`細項「${String(subcategory.name)}」的 foods 必須是陣列。`);
          return;
        }
        const foodNames = new Set<string>();
        subcategory.foods.forEach((food, foodIndex) => {
          if (!isRecord(food)) {
            errors.push(`食物 ${categoryIndex + 1}-${subcategoryIndex + 1}-${foodIndex + 1} 必須是物件。`);
            return;
          }
          if (typeof food.name !== 'string' || !food.name.trim()) errors.push(`食物 ${categoryIndex + 1}-${subcategoryIndex + 1}-${foodIndex + 1} 的 name 不可空白。`);
          if (food.status !== 'low' && food.status !== 'high') errors.push(`食物「${String(food.name)}」的 status 僅能是 low 或 high。`);
          if (typeof food.note !== 'string') errors.push(`食物「${String(food.name)}」的 note 必須是字串。`);
          if (food.aliases !== undefined && (!Array.isArray(food.aliases) || food.aliases.some((alias) => typeof alias !== 'string'))) errors.push(`食物「${String(food.name)}」的 aliases 必須是字串陣列。`);
          if (food.fodmapTypes !== undefined && (!Array.isArray(food.fodmapTypes) || food.fodmapTypes.some((type) => typeof type !== 'string'))) errors.push(`食物「${String(food.name)}」的 fodmapTypes 必須是字串陣列。`);
          if (typeof food.name === 'string') {
            if (foodNames.has(food.name)) errors.push(`細項「${String(subcategory.name)}」中食物「${food.name}」重複。`);
            foodNames.add(food.name);
          }
        });
      });
    });
  }
  return errors.length ? { valid: false, errors } : { valid: true, data: value as unknown as FoodDatabase };
}
