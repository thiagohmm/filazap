package com.filazap.application.port;

import com.filazap.domain.entity.User;

public interface UserRepository {
    User save(User user);

    User findByEmail(String email);

    User findById(String id);
}
