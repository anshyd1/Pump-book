package in.pumpbook.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Rect;
import android.net.Uri;
import android.os.SystemClock;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "MlKitOcr")
public class MlKitOcrPlugin extends Plugin {
    private static final String TAG = "PumpBookScan";
    private final TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

    /** Opens ML Kit's native perspective-correcting scanner. */
    @PluginMethod
    public void scanDocument(PluginCall call) {
        Log.i(TAG, "stage=document_scanner_launch");
        Intent intent = new Intent(getContext(), DocumentScannerActivity.class);
        startActivityForResult(call, intent, "documentScannerResult");
    }

    /** Opens Android's native image picker without invoking slow browser OCR. */
    @PluginMethod
    public void pickImage(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(call, intent, "imagePickerResult");
    }

    @ActivityCallback
    private void imagePickerResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;
        Intent data = activityResult.getData();
        if (activityResult.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("IMAGE_PICK_CANCELLED", "IMAGE_PICK_CANCELLED");
            return;
        }
        long started = SystemClock.elapsedRealtime();
        try {
            JSObject cached = copyToScanCache(data.getData(), "gallery");
            Log.i(TAG, "stage=gallery_cache_copy durationMs=" + (SystemClock.elapsedRealtime() - started) + " bytes=" + cached.getLong("sizeBytes"));
            call.resolve(cached);
        } catch (Exception error) {
            Log.e(TAG, "stage=gallery_cache_error", error);
            call.reject("Could not cache selected image", error);
        }
    }

    @ActivityCallback
    private void documentScannerResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;
        Intent data = activityResult.getData();
        if (activityResult.getResultCode() == Activity.RESULT_CANCELED) {
            call.reject("DOCUMENT_SCAN_CANCELLED", "DOCUMENT_SCAN_CANCELLED");
            return;
        }
        if (activityResult.getResultCode() != Activity.RESULT_OK || data == null) {
            call.reject(data == null ? "Document scanner failed" : data.getStringExtra("error"));
            return;
        }
        String uri = data.getStringExtra(DocumentScannerActivity.EXTRA_IMAGE_URI);
        if (uri == null || uri.isEmpty()) {
            call.reject("Document scanner returned no image URI");
            return;
        }
        JSObject response = new JSObject();
        response.put("uri", uri);
        response.put("sizeBytes", data.getLongExtra(DocumentScannerActivity.EXTRA_IMAGE_BYTES, 0));
        call.resolve(response);
    }

    /**
     * Recognizes a cached content/file URI. The bridge carries only this short URI;
     * the native side opens the image directly and returns structured text geometry.
     */
    @PluginMethod
    public void recognize(PluginCall call) {
        String uriValue = call.getString("uri");
        if (uriValue == null || uriValue.isEmpty()) {
            call.reject("Missing temporary image URI");
            return;
        }
        final long totalStarted = SystemClock.elapsedRealtime();
        final InputImage image;
        try {
            long inputStarted = SystemClock.elapsedRealtime();
            image = InputImage.fromFilePath(getContext(), Uri.parse(uriValue));
            Log.i(
                TAG,
                "stage=input_image durationMs=" + (SystemClock.elapsedRealtime() - inputStarted) +
                " width=" + image.getWidth() + " height=" + image.getHeight()
            );
        } catch (IOException | RuntimeException error) {
            Log.e(TAG, "stage=input_image_error", error);
            call.reject("Image URI decode failed", error);
            return;
        }

        final long ocrStarted = SystemClock.elapsedRealtime();
        recognizer.process(image)
            .addOnSuccessListener(result -> {
                long ocrMs = SystemClock.elapsedRealtime() - ocrStarted;
                long serializeStarted = SystemClock.elapsedRealtime();
                JSObject response = structuredResponse(result, image, ocrMs, totalStarted);
                long serializeMs = SystemClock.elapsedRealtime() - serializeStarted;
                JSObject timings = response.getJSObject("timings");
                if (timings != null) timings.put("serializeMs", serializeMs);
                long totalMs = SystemClock.elapsedRealtime() - totalStarted;
                if (timings != null) timings.put("totalMs", totalMs);
                Log.i(
                    TAG,
                    "stage=mlkit_complete ocrMs=" + ocrMs + " serializeMs=" + serializeMs +
                    " totalMs=" + totalMs + " blocks=" + result.getTextBlocks().size()
                );
                call.resolve(response);
            })
            .addOnFailureListener(error -> {
                Log.e(TAG, "stage=mlkit_error durationMs=" + (SystemClock.elapsedRealtime() - ocrStarted), error);
                call.reject("ML Kit OCR failed", error);
            });
    }

    private JSObject structuredResponse(Text result, InputImage image, long ocrMs, long totalStarted) {
        JSObject response = new JSObject();
        response.put("text", result.getText());
        response.put("width", image.getWidth());
        response.put("height", image.getHeight());
        JSArray blocks = new JSArray();
        JSArray flatLines = new JSArray();
        int blockIndex = 0;
        for (Text.TextBlock block : result.getTextBlocks()) {
            JSObject blockJson = geometry("block", block.getText(), block.getBoundingBox());
            blockJson.put("blockIndex", blockIndex);
            JSArray lines = new JSArray();
            int lineIndex = 0;
            for (Text.Line line : block.getLines()) {
                JSObject lineJson = geometry("line", line.getText(), line.getBoundingBox());
                lineJson.put("blockIndex", blockIndex);
                lineJson.put("lineIndex", lineIndex);
                lines.put(lineJson);
                flatLines.put(lineJson);
                lineIndex += 1;
            }
            blockJson.put("lines", lines);
            blocks.put(blockJson);
            blockIndex += 1;
        }
        response.put("blocks", blocks);
        response.put("lines", flatLines);
        JSObject timings = new JSObject();
        timings.put("ocrMs", ocrMs);
        timings.put("beforeSerializeMs", SystemClock.elapsedRealtime() - totalStarted);
        response.put("timings", timings);
        return response;
    }

    private JSObject geometry(String kind, String text, Rect bounds) {
        JSObject item = new JSObject();
        item.put("kind", kind);
        item.put("text", text);
        if (bounds != null) {
            item.put("left", bounds.left);
            item.put("top", bounds.top);
            item.put("right", bounds.right);
            item.put("bottom", bounds.bottom);
        } else {
            item.put("left", 0);
            item.put("top", 0);
            item.put("right", 0);
            item.put("bottom", 0);
        }
        return item;
    }

    private JSObject copyToScanCache(Uri source, String prefix) throws IOException {
        File directory = new File(getContext().getCacheDir(), "mlkit-scans");
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("Cannot create scan cache");
        File target = new File(directory, prefix + "-" + System.currentTimeMillis() + ".jpg");
        try (InputStream input = getContext().getContentResolver().openInputStream(source);
             OutputStream output = new FileOutputStream(target)) {
            if (input == null) throw new IOException("Cannot open selected image");
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
        }
        Uri cachedUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", target);
        JSObject response = new JSObject();
        response.put("uri", cachedUri.toString());
        response.put("sizeBytes", target.length());
        return response;
    }

    @Override
    protected void handleOnDestroy() {
        recognizer.close();
        super.handleOnDestroy();
    }
}
