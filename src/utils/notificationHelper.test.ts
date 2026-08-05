import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { sendLocalNotification } from './notificationHelper';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    addListener: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    schedule: vi.fn(),
  },
}));

describe('sendLocalNotification', () => {
  let originalNotification: any;
  let originalWindow: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global window
    originalWindow = global.window;
    global.window = {
      dispatchEvent: vi.fn(),
      focus: vi.fn(),
    } as any;

    // Mock global Notification
    originalNotification = global.Notification;
    global.Notification = vi.fn() as any;
    global.Notification.requestPermission = vi.fn().mockResolvedValue('granted');
    (global.Notification as any).permission = 'granted';

    // Add Notification to window
    (global.window as any).Notification = global.Notification;

    // Mock console methods to keep test output clean
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.Notification = originalNotification;
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  it('should schedule native notification if platform is native and permission is granted', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' } as any);

    await sendLocalNotification('Test Title', 'Test Body', 123);

    expect(LocalNotifications.checkPermissions).toHaveBeenCalled();
    expect(LocalNotifications.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.arrayContaining([
          expect.objectContaining({
            title: 'Test Title',
            body: 'Test Body',
            id: 123,
            actionTypeId: 'OPEN_OVERDUE',
          }),
        ]),
      })
    );
    expect(global.Notification).not.toHaveBeenCalled();
  });

  it('should request permissions and schedule native notification if initially denied but then granted', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'denied' } as any);
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'granted' } as any);

    await sendLocalNotification('Test Title 2', 'Test Body 2');

    expect(LocalNotifications.checkPermissions).toHaveBeenCalled();
    expect(LocalNotifications.requestPermissions).toHaveBeenCalled();
    expect(LocalNotifications.schedule).toHaveBeenCalled();
    expect(global.Notification).not.toHaveBeenCalled();
  });

  it('should fallback to web notification if native permission is denied', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'denied' } as any);
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'denied' } as any);

    await sendLocalNotification('Test Title 3', 'Test Body 3');

    expect(LocalNotifications.checkPermissions).toHaveBeenCalled();
    expect(LocalNotifications.requestPermissions).toHaveBeenCalled();
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();

    // Web notification check
    expect(global.Notification).toHaveBeenCalledWith('Test Title 3', expect.any(Object));
  });

  it('should fallback to web notification if native schedule throws an error', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' } as any);
    vi.mocked(LocalNotifications.schedule).mockRejectedValue(new Error('Schedule failed'));

    await sendLocalNotification('Test Title 4', 'Test Body 4');

    expect(LocalNotifications.schedule).toHaveBeenCalled();
    expect(global.Notification).toHaveBeenCalledWith('Test Title 4', expect.any(Object));
  });

  it('should fallback to web notification if platform is not native', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await sendLocalNotification('Test Title 5', 'Test Body 5');

    expect(LocalNotifications.checkPermissions).not.toHaveBeenCalled();
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    expect(global.Notification).toHaveBeenCalledWith('Test Title 5', expect.any(Object));
  });
});
