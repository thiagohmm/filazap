package com.filazap.presentation.security;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiting em memória (janela deslizante) por chave — adequado a instância única.
 */
@Component
public class RateLimiter {
    private record Result(boolean allowed, long retryAfterSeconds) {}

    private final Map<String, Deque<Long>> buckets = new ConcurrentHashMap<>();

    public boolean isAllowed(String key, int limit, long windowMs) {
        long now = System.currentTimeMillis();
        Deque<Long> bucket = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (bucket) {
            while (!bucket.isEmpty() && now - bucket.peekFirst() >= windowMs) {
                bucket.pollFirst();
            }
            if (bucket.size() >= limit) {
                return false;
            }
            bucket.addLast(now);
            return true;
        }
    }

    public long retryAfterSeconds(String key, int limit, long windowMs) {
        long now = System.currentTimeMillis();
        Deque<Long> bucket = buckets.get(key);
        if (bucket == null || bucket.isEmpty()) return 1;
        synchronized (bucket) {
            if (bucket.isEmpty()) return 1;
            long oldest = bucket.peekFirst();
            return Math.max(1, (long) Math.ceil((oldest + windowMs - now) / 1000.0));
        }
    }
}
