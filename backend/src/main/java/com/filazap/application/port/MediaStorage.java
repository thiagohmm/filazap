package com.filazap.application.port;

public interface MediaStorage {
    StoredMedia store(MediaFileInput input);

    byte[] read(String storedPath);

    default SignedMediaUpload createSignedUpload(String orgId, String filename, String mimeType) {
        throw new UnsupportedOperationException("createSignedUpload não suportado");
    }

    default String createSignedReadUrl(String storedPath, int expiresInSeconds, boolean download) {
        throw new UnsupportedOperationException("createSignedReadUrl não suportado");
    }

    default boolean supportsSignedUpload() {
        return false;
    }

    default boolean supportsSignedReadUrl() {
        return false;
    }
}
