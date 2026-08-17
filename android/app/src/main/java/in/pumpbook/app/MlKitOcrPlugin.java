package in.pumpbook.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

@CapacitorPlugin(name = "MlKitOcr")
public class MlKitOcrPlugin extends Plugin {
    private final TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

    @PluginMethod
    public void recognize(PluginCall call) {
        String encoded = call.getString("base64");
        if (encoded == null || encoded.isEmpty()) { call.reject("Missing image data"); return; }
        try {
            int comma = encoded.indexOf(',');
            if (comma >= 0) encoded = encoded.substring(comma + 1);
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) { call.reject("Image decode failed"); return; }
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            recognizer.process(image)
                .addOnSuccessListener(result -> {
                    JSObject response = new JSObject();
                    response.put("text", result.getText());
                    response.put("width", bitmap.getWidth());
                    response.put("height", bitmap.getHeight());
                    call.resolve(response);
                    bitmap.recycle();
                })
                .addOnFailureListener(error -> { bitmap.recycle(); call.reject("ML Kit OCR failed", error); });
        } catch (Exception error) { call.reject("ML Kit OCR error", error); }
    }

    @Override
    protected void handleOnDestroy() {
        recognizer.close();
        super.handleOnDestroy();
    }
}
