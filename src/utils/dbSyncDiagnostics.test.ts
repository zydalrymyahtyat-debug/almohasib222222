import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runFirestoreDiagnostics } from './dbSyncDiagnostics';
import { getDoc, setDoc, waitForPendingWrites } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  waitForPendingWrites: vi.fn(),
}));

vi.mock('../firebase', () => ({
  db: {}
}));

describe('runFirestoreDiagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });

    (getDoc as any).mockResolvedValue({
      exists: () => true,
      metadata: { hasPendingWrites: false }
    });

    (setDoc as any).mockResolvedValue(undefined);
    (waitForPendingWrites as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return a specific message when userId is missing', async () => {
    const result = await runFirestoreDiagnostics(undefined);
    expect(result.message).toBe('يرجى تسجيل الدخول أولاً لإجراء الفحص.');
    expect(result.firestoreConnected).toBe(false);
  });

  it('should return an offline message when navigator is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const result = await runFirestoreDiagnostics('user123');
    expect(result.message).toBe('لا يوجد اتصال بالإنترنت في المتصفح/الجهاز حالياً. النظام يعمل في الوضع الاوفلاين.');
    expect(result.isOnline).toBe(false);
  });

  it('should return success and true values for a fully synced connection', async () => {
    const result = await runFirestoreDiagnostics('user123');

    expect(result.isOnline).toBe(true);
    expect(result.firestoreConnected).toBe(true);
    expect(result.readSuccess).toBe(true);
    expect(result.writeSuccess).toBe(true);
    expect(result.hasPendingWrites).toBe(false);
    expect(result.message).toContain('الاتصال بالبنية السحابية لـ Firestore نشط وممتاز');
  });

  it('should handle pending writes if waitForPendingWrites is slow', async () => {
    (waitForPendingWrites as any).mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 3000)));

    const result = await runFirestoreDiagnostics('user123');
    expect(result.hasPendingWrites).toBe(true);
    expect(result.message).toBe('الاتصال قائم، ولكن هناك عمليات تعديل محلية في قائمة الانتظار جاري مزامنتها حالياً مع السحابة.');
  });

  it('should return false for firestoreConnected when getDoc fails with exception', async () => {
    (getDoc as any).mockRejectedValue(new Error('Network error'));

    const result = await runFirestoreDiagnostics('user123');

    expect(result.firestoreConnected).toBe(false);
    expect(result.message).toContain('فشل في الاتصال المباشر بالسحابة');
  });
});
