package in.pumpbook.app;

import java.net.URI;
import java.util.Locale;

/** Pure update-policy helpers kept Android-free so local JVM tests can audit them. */
public final class UpdatePolicy {
    public static final long MAX_APK_BYTES = 80L * 1024L * 1024L;
    private static final String RELEASE_PATH = "/anshyd1/Pump-book/releases/download/";

    private UpdatePolicy() {}

    public static boolean isAllowedDownloadUrl(String value) {
        String path = allowedReleasePath(value);
        return path != null && path.toLowerCase(Locale.US).endsWith(".apk");
    }

    public static boolean isAllowedChecksumUrl(String value) {
        String path = allowedReleasePath(value);
        if (path == null) return false;
        String lower = path.toLowerCase(Locale.US);
        return lower.endsWith("/sha256sums.txt") || lower.endsWith(".sha256");
    }

    private static String allowedReleasePath(String value) {
        try {
            URI uri = new URI(value);
            String path = uri.getPath();
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !"github.com".equalsIgnoreCase(uri.getHost())
                    || path == null
                    || !path.startsWith(RELEASE_PATH)) return null;
            return path;
        } catch (Exception ignored) {
            return null;
        }
    }

    public static int compareVersions(String left, String right) {
        String[] a = left.replaceFirst("^[vV]", "").split("[.-]");
        String[] b = right.replaceFirst("^[vV]", "").split("[.-]");
        for (int index = 0; index < Math.max(a.length, b.length); index += 1) {
            int av = index < a.length ? integerPrefix(a[index]) : 0;
            int bv = index < b.length ? integerPrefix(b[index]) : 0;
            if (av != bv) return Integer.compare(av, bv);
        }
        return 0;
    }

    public static boolean assetMatchesAbi(String name, String abi) {
        String lower = name == null ? "" : name.toLowerCase(Locale.US);
        String marker;
        if ("arm64-v8a".equals(abi)) marker = "arm64";
        else if ("armeabi-v7a".equals(abi)) marker = "armv7";
        else return false;
        return lower.endsWith(".apk") && lower.contains(marker);
    }

    private static int integerPrefix(String value) {
        String digits = value.replaceFirst("^(\\d+).*$", "$1");
        try { return Integer.parseInt(digits); } catch (Exception ignored) { return 0; }
    }
}
