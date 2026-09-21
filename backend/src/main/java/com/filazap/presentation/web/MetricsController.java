package com.filazap.presentation.web;

import com.filazap.application.usecase.GetMetrics;
import com.filazap.presentation.security.SessionHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/organizations/{organizationId}/metrics")
public class MetricsController {
    private final GetMetrics getMetrics;

    public MetricsController(GetMetrics getMetrics) {
        this.getMetrics = getMetrics;
    }

    @GetMapping
    public Map<String, Object> metrics(@PathVariable String organizationId) {
        var session = SessionHolder.require();
        return getMetrics.execute(session.userId(), organizationId);
    }
}
