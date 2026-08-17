package in.pumpbook.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Small, repository-scoped updater for direct GitHub test releases.
 *
 * Android still owns the final installation confirmation. The plugin never
 * requests root/device-owner privileges and only accepts APK links from this
 * project's GitHub release path. Android's package installer additionally
 * enforces that an update is signed by the same certificate as the installed
 * app.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String RELEASE_API = "https://api.github.com/repos/anshyd1/Pump-book/releases/latest";
    private static final int CONNECT_TIMEOUT_MS = 12_000;
    private static final int READ_TIMEOUT_MS = 30_000;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void currentVersion(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("version", installedVersion());
            result.put("abi", preferredAbi());
            result.put("canInstallPackages", canInstallPackages());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read app version", error);
        }
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        executor.execute(() -> {
            try {
                JSONObject release = new JSONObject(readText(RELEASE_API, 2_000_000));
                String tag = release.optString("tag_name", "");
                String latest = tag.replaceFirst("^[vV]", "");
                String current = installedVersion();
                String abi = preferredAbi();
                JSONArray assets = release.optJSONArray("assets");
                JSONObject apk = findApkAsset(assets, abi);
                String assetName = apk == null ? "" : apk.optString("name", "");
                String downloadUrl = apk == null ? "" : apk.optString("browser_download_url", "");
                String checksum = checksumFor(assets, assetName);
                JSObject result = new JSObject();
                result.put("currentVersion", current);
                result.put("latestVersion", latest);
                result.put("tag", tag);
                result.put("updateAvailable", apk != null && UpdatePolicy.compareVersions(latest, current) > 0);
                result.put("abi", abi);
                result.put("assetName", assetName);
                result.put("downloadUrl", downloadUrl);
                result.put("expectedSha256", checksum);
                result.put("releaseUrl", release.optString("html_url", ""));
                result.put("notes", release.optString("body", ""));
                result.put("publishedAt", release.optString("published_at", ""));
                resolveOnUi(call, result);
            } catch (Exception error) {
                rejectOnUi(call, "Update check failed", error);
            }
        });
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("downloadUrl", "");
        String assetName = call.getString("assetName", "Pump-Book-update.apk");
        String expectedSha256 = call.getString("expectedSha256", "");
        if (!UpdatePolicy.isAllowedDownloadUrl(downloadUrl)) {
            call.reject("Only Pump Book GitHub release APKs are allowed");
            return;
        }
        if (!canInstallPackages()) {
            Intent permission = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            permission.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(permission);
            JSObject result = new JSObject();
            result.put("permissionRequired", true);
            result.put("message", "Allow installs from Pump Book, then tap Update again.");
            call.resolve(result);
            return;
        }
        executor.execute(() -> {
            File target = null;
            try {
                File directory = new File(getContext().getCacheDir(), "app-updates");
                if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Cannot create update cache");
                removeOldUpdates(directory);
                String safeName = assetName.replaceAll("[^A-Za-z0-9._-]", "_");
                target = new File(directory, safeName.endsWith(".apk") ? safeName : safeName + ".apk");
                String actualSha256 = downloadApk(downloadUrl, target);
                if (!expectedSha256.isEmpty() && !actualSha256.equalsIgnoreCase(expectedSha256.trim())) {
                    target.delete();
                    throw new SecurityException("Downloaded APK checksum does not match the release manifest");
                }
                launchInstaller(target);
                JSObject result = new JSObject();
                result.put("installerLaunched", true);
                result.put("sha256", actualSha256);
                result.put("sizeBytes", target.length());
                resolveOnUi(call, result);
            } catch (Exception error) {
                if (target != null) target.delete();
                rejectOnUi(call, "Update download/install failed", error);
            }
        });
    }

    @PluginMethod
    public void openReleasePage(PluginCall call) {
        String releaseUrl = call.getString("releaseUrl", "https://github.com/anshyd1/Pump-book/releases/latest");
        if (!releaseUrl.startsWith("https://github.com/anshyd1/Pump-book/releases")) {
            call.reject("Invalid release URL");
            return;
        }
        Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(releaseUrl));
        browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(browser);
        call.resolve();
    }

    private JSONObject findApkAsset(JSONArray assets, String abi) {
        if (assets == null) return null;
        for (int index = 0; index < assets.length(); index += 1) {
            JSONObject asset = assets.optJSONObject(index);
            String name = asset == null ? "" : asset.optString("name", "");
            if (UpdatePolicy.assetMatchesAbi(name, abi)) return asset;
        }
        return null;
    }

    private String checksumFor(JSONArray assets, String assetName) {
        if (assets == null || assetName.isEmpty()) return "";
        for (int index = 0; index < assets.length(); index += 1) {
            JSONObject asset = assets.optJSONObject(index);
            if (asset == null || !asset.optString("name", "").equalsIgnoreCase("SHA256SUMS.txt")) continue;
            try {
                String checksumUrl = asset.optString("browser_download_url", "");
                if (!UpdatePolicy.isAllowedChecksumUrl(checksumUrl)) return "";
                String manifest = readText(checksumUrl, 128_000);
                for (String line : manifest.split("\\r?\\n")) {
                    String[] parts = line.trim().split("\\s+", 2);
                    if (parts.length == 2 && parts[1].replace("*", "").trim().equals(assetName)) return parts[0];
                }
            } catch (Exception ignored) {
                return "";
            }
        }
        return "";
    }

    private String downloadApk(String value, File target) throws Exception {
        HttpURLConnection connection = open(value);
        long announced = connection.getContentLengthLong();
        if (announced > UpdatePolicy.MAX_APK_BYTES) throw new IllegalStateException("Update APK is unexpectedly large");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long total = 0;
        try (InputStream input = new BufferedInputStream(connection.getInputStream()); FileOutputStream output = new FileOutputStream(target)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > UpdatePolicy.MAX_APK_BYTES) throw new IllegalStateException("Update APK exceeded the size limit");
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
            }
        } finally {
            connection.disconnect();
        }
        if (total < 1_000_000) throw new IllegalStateException("Downloaded file is not a valid Pump Book APK");
        return hex(digest.digest());
    }

    private String readText(String value, int maximumBytes) throws Exception {
        if (value == null || value.isEmpty()) throw new IllegalArgumentException("Missing URL");
        HttpURLConnection connection = open(value);
        StringBuilder result = new StringBuilder();
        int count = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                count += line.length() + 1;
                if (count > maximumBytes) throw new IllegalStateException("Response is too large");
                result.append(line).append('\n');
            }
        } finally {
            connection.disconnect();
        }
        return result.toString();
    }

    private HttpURLConnection open(String value) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(value).openConnection();
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", "Pump-Book-Android/" + installedVersion());
        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) throw new IllegalStateException("Server returned HTTP " + status);
        return connection;
    }

    private void launchInstaller(File apk) {
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(install);
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private String installedVersion() throws Exception {
        PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        return info.versionName == null ? "0.0.0" : info.versionName;
    }

    private String preferredAbi() {
        for (String abi : Build.SUPPORTED_ABIS) {
            if (abi.equals("arm64-v8a")) return "arm64-v8a";
            if (abi.equals("armeabi-v7a")) return "armeabi-v7a";
        }
        return Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "unknown";
    }

    private String hex(byte[] value) {
        StringBuilder result = new StringBuilder();
        for (byte item : value) result.append(String.format(Locale.US, "%02x", item));
        return result.toString();
    }

    private void removeOldUpdates(File directory) {
        File[] files = directory.listFiles();
        if (files == null) return;
        for (File file : files) if (file.isFile()) file.delete();
    }

    private void resolveOnUi(PluginCall call, JSObject result) {
        getActivity().runOnUiThread(() -> call.resolve(result));
    }

    private void rejectOnUi(PluginCall call, String message, Exception error) {
        getActivity().runOnUiThread(() -> call.reject(message, error));
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
