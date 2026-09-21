package com.filazap.infrastructure.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

/** Serializa/deserializa colunas JSONB para Map<String,Object>. */
public final class JsonCodec {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private JsonCodec() {}

    public static String toJson(Map<String, Object> map) {
        if (map == null) return null;
        try {
            return MAPPER.writeValueAsString(map);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao serializar JSON.", e);
        }
    }

    public static Map<String, Object> toMap(String json) {
        if (json == null) return null;
        try {
            return MAPPER.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao desserializar JSON.", e);
        }
    }
}
