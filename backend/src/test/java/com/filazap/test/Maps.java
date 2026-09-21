package com.filazap.test;

import java.util.List;
import java.util.Map;

/** Navegação sobre os corpos JSON retornados pelos use-cases (Map<String,Object>). */
public final class Maps {
    private Maps() {}

    public static String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v == null ? null : String.valueOf(v);
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> map(Map<String, Object> m, String key) {
        return (Map<String, Object>) m.get(key);
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> list(Map<String, Object> m, String key) {
        return (List<Map<String, Object>>) m.get(key);
    }

    public static Object get(Map<String, Object> m, String key) {
        return m.get(key);
    }
}
