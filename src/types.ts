export type FodmapStatus = 'low' | 'high';

export interface Food {
  name: string;
  aliases?: string[];
  status: FodmapStatus;
  fodmapTypes?: string[];
  note: string;
}

export interface Subcategory {
  id: string;
  name: string;
  foods: Food[];
}

export interface Category {
  id: string;
  name: string;
  subcategories: Subcategory[];
}

export interface Source {
  name: string;
  url: string;
  note: string;
}

export interface FoodDatabase {
  schemaVersion: string;
  title: string;
  locale: string;
  updatedAt: string;
  classificationBasis: string;
  medicalNotice: string;
  fodmapTypes: Record<string, string>;
  sources: Source[];
  categories: Category[];
  implementationNotes: string[];
}

export interface FoodResult extends Food {
  key: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
}

export interface EditableFood extends Food {
  aliasesText: string;
  fodmapTypesText: string;
}
