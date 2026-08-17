package in.pumpbook.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;

/**
 * Small native host for Google Play services' document-scanner UI.
 *
 * The corrected JPEG is copied to this app's cache and only its content URI is
 * returned through Capacitor. No JPEG/Base64 payload crosses the WebView bridge.
 */
public class DocumentScannerActivity extends AppCompatActivity {
    public static final String EXTRA_IMAGE_URI = "imageUri";
    public static final String EXTRA_IMAGE_BYTES = "imageBytes";
    private static final String TAG = "PumpBookScan";

    private long launchedAt;
    private ActivityResultLauncher<IntentSenderRequest> scannerLauncher;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        launchedAt = SystemClock.elapsedRealtime();
        scannerLauncher = registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            activityResult -> {
                if (activityResult.getResultCode() != Activity.RESULT_OK) {
                    Log.i(TAG, "stage=document_scanner_cancelled");
                    setResult(Activity.RESULT_CANCELED);
                    finish();
                    return;
                }
                copyCorrectedPageToCache(activityResult.getData());
            }
        );
        launchScanner();
    }

    private void launchScanner() {
        GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setPageLimit(1)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build();
        GmsDocumentScanner scanner = GmsDocumentScanning.getClient(options);
        scanner.getStartScanIntent(this)
            .addOnSuccessListener(intentSender -> {
                Log.i(TAG, "stage=document_scanner_ready durationMs=" + (SystemClock.elapsedRealtime() - launchedAt));
                scannerLauncher.launch(new IntentSenderRequest.Builder(intentSender).build());
            })
            .addOnFailureListener(error -> fail("Document scanner unavailable", error));
    }

    private void copyCorrectedPageToCache(@Nullable Intent scannerData) {
        long copyStarted = SystemClock.elapsedRealtime();
        try {
            GmsDocumentScanningResult scan = GmsDocumentScanningResult.fromActivityResultIntent(scannerData);
            List<GmsDocumentScanningResult.Page> pages = scan == null ? null : scan.getPages();
            if (pages == null || pages.isEmpty()) {
                fail("Document scanner returned no page", null);
                return;
            }
            Uri source = pages.get(0).getImageUri();
            File directory = new File(getCacheDir(), "mlkit-scans");
            if (!directory.exists() && !directory.mkdirs()) {
                fail("Cannot create scan cache", null);
                return;
            }
            removeOldScans(directory);
            File target = new File(directory, "scan-" + System.currentTimeMillis() + ".jpg");
            try (InputStream input = getContentResolver().openInputStream(source);
                 OutputStream output = new FileOutputStream(target)) {
                if (input == null) throw new IllegalStateException("Cannot open corrected scan");
                byte[] buffer = new byte[32 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            }
            Uri cachedUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", target);
            Intent result = new Intent();
            result.putExtra(EXTRA_IMAGE_URI, cachedUri.toString());
            result.putExtra(EXTRA_IMAGE_BYTES, target.length());
            result.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            long elapsed = SystemClock.elapsedRealtime() - copyStarted;
            Log.i(TAG, "stage=document_cache_copy durationMs=" + elapsed + " bytes=" + target.length());
            setResult(Activity.RESULT_OK, result);
            finish();
        } catch (Exception error) {
            fail("Could not cache corrected scan", error);
        }
    }

    private void removeOldScans(File directory) {
        File[] files = directory.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60L * 60L * 1000L;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff && !file.delete()) {
                Log.w(TAG, "Could not remove old temp scan " + file.getName());
            }
        }
    }

    private void fail(String message, @Nullable Exception error) {
        if (error == null) Log.e(TAG, "stage=document_scanner_error message=" + message);
        else Log.e(TAG, "stage=document_scanner_error message=" + message, error);
        Intent result = new Intent();
        result.putExtra("error", message);
        setResult(Activity.RESULT_FIRST_USER, result);
        finish();
    }
}
