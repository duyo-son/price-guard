import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStorageService } from '../../../src/shared/storage.js';
import type { TrackedProduct } from '../../../src/shared/types.js';
import { STORAGE_KEYS } from '../../../src/shared/constants.js';

// @types/chrome の get() は最後のオーバーロードが callback→void のため
// vi.mocked() が void 型推論になる問題を回避するため、promise オーバーロードに明示キャスト
type StorageGetFn = (
  keys?: string | string[] | Record<string, unknown> | null,
) => Promise<Record<string, unknown>>;
const mockGet = vi.mocked(chrome.storage.local.get as unknown as StorageGetFn);
const mockSet = vi.mocked(chrome.storage.local.set);

const mockProduct: TrackedProduct = {
  id: 'prod-001',
  url: 'https://example.com/product/1',
  name: '테스트 상품',
  imageUrl: 'https://example.com/img.jpg',
  currentPrice: 50000,
  targetPrice: 45000,
  notifyOnDiscount: true,
  registeredAt: 1_000_000,
  lastCheckedAt: null,
  priceHistory: [{ price: 50000, timestamp: 1_000_000 }],
};

describe('StorageService', () => {
  let storage: ReturnType<typeof createStorageService>;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createStorageService();
  });

  describe('getProducts()', () => {
    it('스토리지가 비어있으면 빈 배열 반환', async () => {
      mockGet.mockResolvedValue({});
      await expect(storage.getProducts()).resolves.toEqual([]);
    });

    it('저장된 상품 목록 반환', async () => {
      mockGet.mockResolvedValue({
        [STORAGE_KEYS.PRODUCTS]: [mockProduct],
      });
      await expect(storage.getProducts()).resolves.toEqual([mockProduct]);
    });
  });

  describe('saveProduct()', () => {
    it('새 상품 저장', async () => {
      mockGet.mockResolvedValue({});
      mockSet.mockResolvedValue(undefined);

      await storage.saveProduct(mockProduct);

      expect(mockSet).toHaveBeenCalledWith({
        [STORAGE_KEYS.PRODUCTS]: [mockProduct],
      });
    });

    it('동일 URL 상품은 덮어쓰기', async () => {
      const updatedProduct = { ...mockProduct, currentPrice: 48000 };
      mockGet.mockResolvedValue({
        [STORAGE_KEYS.PRODUCTS]: [mockProduct],
      });
      mockSet.mockResolvedValue(undefined);

      await storage.saveProduct(updatedProduct);

      expect(mockSet).toHaveBeenCalledWith({
        [STORAGE_KEYS.PRODUCTS]: [updatedProduct],
      });
    });
  });

  describe('removeProduct()', () => {
    it('ID로 상품 삭제', async () => {
      mockGet.mockResolvedValue({
        [STORAGE_KEYS.PRODUCTS]: [mockProduct],
      });
      mockSet.mockResolvedValue(undefined);

      await storage.removeProduct('prod-001');

      expect(mockSet).toHaveBeenCalledWith({
        [STORAGE_KEYS.PRODUCTS]: [],
      });
    });

    it('존재하지 않는 ID 삭제 시 목록 변경 없음', async () => {
      mockGet.mockResolvedValue({
        [STORAGE_KEYS.PRODUCTS]: [mockProduct],
      });
      mockSet.mockResolvedValue(undefined);

      await storage.removeProduct('not-existing');

      expect(mockSet).toHaveBeenCalledWith({
        [STORAGE_KEYS.PRODUCTS]: [mockProduct],
      });
    });
  });

  describe('updateProduct()', () => {
    it('ID가 일치하는 상품 업데이트', async () => {
      const updated = { ...mockProduct, currentPrice: 42000 };
      mockGet.mockResolvedValue({
        [STORAGE_KEYS.PRODUCTS]: [mockProduct],
      });
      mockSet.mockResolvedValue(undefined);

      await storage.updateProduct(updated);

      expect(mockSet).toHaveBeenCalledWith({
        [STORAGE_KEYS.PRODUCTS]: [updated],
      });
    });

    it('ID가 없으면 스토리지 수정 없음', async () => {
      mockGet.mockResolvedValue({
        [STORAGE_KEYS.PRODUCTS]: [mockProduct],
      });

      await storage.updateProduct({ ...mockProduct, id: 'ghost' });

      expect(mockSet).not.toHaveBeenCalled();
    });
  });
});
