package com.secure.notebook;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.database.Cursor;
import android.provider.ContactsContract;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int CONTACT_PICKER_RESULT = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Add native print bridge to Webview
        WebView webView = this.getBridge().getWebView();
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidPrint");
        webView.addJavascriptInterface(new ContactsBridge(this), "AndroidContacts");
    }

    public void openContactPicker() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
                    startActivityForResult(intent, CONTACT_PICKER_RESULT);
                } catch (Exception e) {
                    e.printStackTrace();
                    sendContactToJS("ERROR", e.getMessage());
                }
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == CONTACT_PICKER_RESULT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri contactUri = data.getData();
                String[] projection = new String[]{
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                };
                Cursor cursor = getContentResolver().query(contactUri, projection, null, null, null);
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                    int numberIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                    String name = cursor.getString(nameIndex);
                    String number = cursor.getString(numberIndex);
                    cursor.close();
                    
                    sendContactToJS(name, number);
                } else {
                    if (cursor != null) cursor.close();
                    sendContactToJS("ERROR", "No data found");
                }
            } else {
                sendContactToJS("CANCELLED", "");
            }
        }
    }

    public void sendContactToJS(final String name, final String phone) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    String escapedName = name != null ? name.replace("'", "\\'") : "";
                    String escapedPhone = phone != null ? phone.replace("'", "\\'") : "";
                    String js = "if (typeof window.onAndroidContactSelected === 'function') { " +
                                "window.onAndroidContactSelected('" + escapedName + "', '" + escapedPhone + "'); " +
                                "}";
                    webView.evaluateJavascript(js, null);
                }
            }
        });
    }

    public static class ContactsBridge {
        Context mContext;

        ContactsBridge(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void pickContact() {
            if (mContext instanceof MainActivity) {
                ((MainActivity) mContext).openContactPicker();
            }
        }
    }

    public static class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void print() {
            if (mContext instanceof MainActivity) {
                final MainActivity activity = (MainActivity) mContext;
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        WebView webView = activity.getBridge().getWebView();
                        PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                        if (printManager != null) {
                            PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter("كشف الحساب - الدفتر الآمن");
                            printManager.print("الدفتر الآمن كشف حساب", printAdapter, new PrintAttributes.Builder().build());
                        }
                    }
                });
            }
        }
    }
}
