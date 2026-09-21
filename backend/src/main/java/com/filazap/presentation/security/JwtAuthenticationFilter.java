package com.filazap.presentation.security;

import com.filazap.application.port.TokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final TokenService tokenService;

    public JwtAuthenticationFilter(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.toLowerCase().startsWith("bearer ")) {
            String token = header.substring(7).trim();
            if (!token.isEmpty()) {
                try {
                    var payload = tokenService.verify(token);
                    var authentication = new UsernamePasswordAuthenticationToken(payload, null, List.of());
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } catch (Exception ignored) {
                    // Token inválido: segue como anônimo; as rotas protegidas respondem 401.
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
