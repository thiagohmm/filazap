package com.filazap.application.port;

/** Gera identificadores únicos (equivalente ao idGenerator do container original). */
@FunctionalInterface
public interface IdGenerator {
    String generate();
}
