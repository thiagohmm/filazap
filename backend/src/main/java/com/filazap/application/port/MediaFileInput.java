package com.filazap.application.port;

/** Dados de um arquivo a ser armazenado. */
public record MediaFileInput(String orgId, String filename, String mimeType, byte[] data) {}
