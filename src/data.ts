import rawDatabase from '../low-fodmap-foods.zh-TW.json';
import type { Category, FoodDatabase } from './types';

export const seedDatabase = rawDatabase as FoodDatabase;

export function cloneDatabase(database: FoodDatabase): FoodDatabase {
  return structuredClone(database);
}

export function foodKey(categoryId: string, subcategoryId: string, foodName: string): string {
  return `${categoryId}:${subcategoryId}:${foodName}`;
}

export function getFoodCount(database: FoodDatabase): number {
  return database.categories.reduce(
    (categoryTotal, category) =>
      categoryTotal + category.subcategories.reduce((total, subcategory) => total + subcategory.foods.length, 0),
    0,
  );
}

export function flattenFoods(database: FoodDatabase) {
  return database.categories.flatMap((category) =>
    category.subcategories.flatMap((subcategory) =>
      subcategory.foods.map((food) => ({
        ...food,
        key: foodKey(category.id, subcategory.id, food.name),
        categoryId: category.id,
        categoryName: category.name,
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
      })),
    ),
  );
}

export function slugFromName(name: string, fallback: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function createCategory(name = '新分類'): Category {
  return { id: slugFromName(name, `category-${Date.now()}`), name, subcategories: [] };
}

export function getStatusLabel(status: 'low' | 'high'): string {
  return status === 'low' ? '低腹敏' : '高腹敏';
}

export function formatUpdatedAt(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}
