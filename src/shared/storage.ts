import type { TrackedProduct } from './types.js';
import { STORAGE_KEYS } from './constants.js';

export interface StorageService {
  getProducts(): Promise<TrackedProduct[]>;
  saveProduct(product: TrackedProduct): Promise<void>;
  removeProduct(id: string): Promise<void>;
  updateProduct(product: TrackedProduct): Promise<void>;
}

export function createStorageService(): StorageService {
  async function getProducts(): Promise<TrackedProduct[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PRODUCTS);
    return (result[STORAGE_KEYS.PRODUCTS] as TrackedProduct[] | undefined) ?? [];
  }

  return {
    getProducts,

    async saveProduct(product: TrackedProduct): Promise<void> {
      const products = await getProducts();
      const existingIndex = products.findIndex((p) => p.url === product.url);
      if (existingIndex >= 0) {
        products[existingIndex] = product;
      } else {
        products.push(product);
      }
      await chrome.storage.local.set({ [STORAGE_KEYS.PRODUCTS]: products });
    },

    async removeProduct(id: string): Promise<void> {
      const products = await getProducts();
      const filtered = products.filter((p) => p.id !== id);
      await chrome.storage.local.set({ [STORAGE_KEYS.PRODUCTS]: filtered });
    },

    async updateProduct(product: TrackedProduct): Promise<void> {
      const products = await getProducts();
      const index = products.findIndex((p) => p.id === product.id);
      if (index >= 0) {
        products[index] = product;
        await chrome.storage.local.set({ [STORAGE_KEYS.PRODUCTS]: products });
      }
    },
  };
}
