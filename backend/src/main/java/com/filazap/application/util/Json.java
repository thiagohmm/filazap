package com.filazap.application.util;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Utilitário para montar corpos JSON de resposta de forma explícita,
 * espelhando exatamente os contratos JSON do backend original.
 */
public final class Json {
    private Json() {}

    public static Map<String, Object> obj(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            map.put((String) kv[i], kv[i + 1]);
        }
        return map;
    }

    @SafeVarargs
    public static <T> List<T> list(T... items) {
        return new ArrayList<>(Arrays.asList(items));
    }
}
