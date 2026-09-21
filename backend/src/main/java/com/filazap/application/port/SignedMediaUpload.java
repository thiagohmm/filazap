package com.filazap.application.port;

/** Upload assinado (Supabase). */
public record SignedMediaUpload(String storedPath, String token) {}
