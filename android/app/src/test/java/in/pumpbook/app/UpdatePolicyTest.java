package in.pumpbook.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import org.junit.Test;

public class UpdatePolicyTest {
    @Test
    public void versionComparisonHandlesTagsAndPatchVersions() {
        assertTrue(UpdatePolicy.compareVersions("v4.2.1", "4.2.0") > 0);
        assertTrue(UpdatePolicy.compareVersions("4.3.0", "4.2.99") > 0);
        assertTrue(UpdatePolicy.compareVersions("4.2.1", "4.2.1") == 0);
        assertTrue(UpdatePolicy.compareVersions("4.1.9", "4.2.0") < 0);
    }

    @Test
    public void onlyThisRepositoryReleaseApkPathIsAccepted() {
        assertTrue(UpdatePolicy.isAllowedDownloadUrl("https://github.com/anshyd1/Pump-book/releases/download/v4.2.2/Pump-Book-4.2.2-arm64.apk"));
        assertTrue(UpdatePolicy.isAllowedChecksumUrl("https://github.com/anshyd1/Pump-book/releases/download/v4.2.2/SHA256SUMS.txt"));
        assertFalse(UpdatePolicy.isAllowedChecksumUrl("https://github.com/anshyd1/Pump-book/releases/download/v4.2.2/notes.txt"));
        assertFalse(UpdatePolicy.isAllowedDownloadUrl("http://github.com/anshyd1/Pump-book/releases/download/v4.2.2/update.apk"));
        assertFalse(UpdatePolicy.isAllowedDownloadUrl("https://github.com/evil/Pump-book/releases/download/v4.2.2/update.apk"));
        assertFalse(UpdatePolicy.isAllowedDownloadUrl("https://github.com/anshyd1/Pump-book/releases/latest"));
        assertFalse(UpdatePolicy.isAllowedDownloadUrl("https://github.com.evil/anshyd1/Pump-book/releases/download/v4.2.2/update.apk"));
    }

    @Test
    public void apkAssetMustMatchPhoneAbi() {
        assertTrue(UpdatePolicy.assetMatchesAbi("Pump-Book-4.2.2-arm64.apk", "arm64-v8a"));
        assertTrue(UpdatePolicy.assetMatchesAbi("Pump-Book-4.2.2-armv7.apk", "armeabi-v7a"));
        assertFalse(UpdatePolicy.assetMatchesAbi("Pump-Book-4.2.2-armv7.apk", "arm64-v8a"));
        assertFalse(UpdatePolicy.assetMatchesAbi("Pump-Book-4.2.2-armv7.apk", "x86_64"));
        assertFalse(UpdatePolicy.assetMatchesAbi("SHA256SUMS.txt", "arm64-v8a"));
    }
}
