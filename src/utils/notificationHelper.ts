import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Set up the listener for notification actions (clicks) on Native Platform
if (Capacitor.isNativePlatform()) {
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      console.log('Local Notification Action Performed:', notificationAction);
      // Dispatch custom event to App.tsx to show overdue customers list
      window.dispatchEvent(new CustomEvent("open-overdue-modal"));
    });
    console.log("Capacitor localNotificationActionPerformed listener registered successfully.");
  } catch (e) {
    console.error("Error registering LocalNotifications listener:", e);
  }
}

// Check if notifications are supported or get permission status
export async function getNotificationPermission(): Promise<"granted" | "denied" | "prompt" | "unsupported" | "default"> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      const val = status.display;
      if (val === "prompt" || val === "prompt-with-rationale") {
        return "default";
      }
      return val as any;
    } catch (e) {
      console.error("Failed to check Capacitor local-notifications permission:", e);
      return "unsupported";
    }
  } else {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission as any;
  }
}

// Request permission
export async function requestNotificationPermission(): Promise<"granted" | "denied" | "unsupported" | "default"> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.requestPermissions();
      const val = status.display;
      if (val === "prompt" || val === "prompt-with-rationale") {
        return "default";
      }
      return val as any;
    } catch (e) {
      console.error("Failed to request Capacitor local-notifications permission:", e);
      return "unsupported";
    }
  } else {
    if (!("Notification" in window)) return "unsupported";
    const status = await Notification.requestPermission();
    return status as any;
  }
}

// Send local / native notification immediately
export async function sendLocalNotification(title: string, body: string, id?: number) {
  const notifId = id || Math.floor(Math.random() * 1000000);

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const reqResult = await LocalNotifications.requestPermissions();
        if (reqResult.display !== "granted") {
          console.warn("Notification permission was denied by user on Capacitor.");
          showWebNotification(title, body);
          return;
        }
      }
      
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: notifId,
            schedule: { at: new Date(Date.now() + 200) }, // Trigger in 200ms
            sound: "default",
            smallIcon: "res://ic_stat_name", // Uses standard stat icon or falls back
            actionTypeId: "OPEN_OVERDUE",
          }
        ]
      });
      console.log("Capacitor Native Notification Scheduled successfully:", title);
    } catch (e) {
      console.error("Failed to show native local notification, falling back to web:", e);
      showWebNotification(title, body);
    }
  } else {
    showWebNotification(title, body);
  }
}

function showWebNotification(title: string, body: string) {
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        const notif = new Notification(title, {
          body,
          icon: "iconapp.png",
          dir: "rtl"
        });
        notif.onclick = () => {
          window.dispatchEvent(new CustomEvent("open-overdue-modal"));
          window.focus();
        };
      } catch (e) {
        console.error("Web Notification failed:", e);
      }
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          try {
            const notif = new Notification(title, {
              body,
              icon: "iconapp.png",
              dir: "rtl"
            });
            notif.onclick = () => {
              window.dispatchEvent(new CustomEvent("open-overdue-modal"));
              window.focus();
            };
          } catch (e) {
            console.error("Web Notification failed after request:", e);
          }
        }
      });
    }
  }
}
