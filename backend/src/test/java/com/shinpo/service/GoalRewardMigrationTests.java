package com.shinpo.service;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class GoalRewardMigrationTests {

    @Test
    void v25PreservesLegacyRewardsWithoutInventingGoalAssociations() throws Exception {
        String host = System.getenv().getOrDefault("POSTGRES_HOST", "127.0.0.1");
        String port = System.getenv().getOrDefault("POSTGRES_PORT", "5432");
        String database = System.getenv().getOrDefault("POSTGRES_DB", "shinpo_test");
        String username = System.getenv().getOrDefault("POSTGRES_USER", "shinpo");
        String password = System.getenv().getOrDefault("POSTGRES_PASSWORD", "shinpo_dev");
        String url = "jdbc:postgresql://" + host + ":" + port + "/" + database;
        String schema = "goal_history_" + UUID.randomUUID().toString().replace("-", "");

        Flyway.configure().dataSource(url, username, password)
                .schemas(schema).defaultSchema(schema).target("24").load().migrate();

        long userId;
        long goalId;
        try (var connection = DriverManager.getConnection(url + "?currentSchema=" + schema, username, password)) {
            try (var statement = connection.prepareStatement(
                    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id")) {
                statement.setString(1, "history_" + schema.substring(schema.length() - 36));
                statement.setString(2, schema + "@qa.test");
                statement.setString(3, "hash");
                try (var rows = statement.executeQuery()) {
                    rows.next();
                    userId = rows.getLong(1);
                }
            }
            try (var statement = connection.prepareStatement(
                    "INSERT INTO goals (user_id, title, start_date, status) VALUES (?, ?, CURRENT_DATE, 'COMPLETED') RETURNING id")) {
                statement.setLong(1, userId);
                statement.setString(2, "Legacy completed goal");
                try (var rows = statement.executeQuery()) {
                    rows.next();
                    goalId = rows.getLong(1);
                }
            }
            try (var statement = connection.prepareStatement(
                    "INSERT INTO progress_events (user_id, event_type, amount) VALUES (?, ?, ?)")) {
                statement.setLong(1, userId);
                statement.setString(2, "ONBOARDING_COMPLETED");
                statement.setInt(3, 50);
                statement.executeUpdate();
                statement.setString(2, "GOAL_COMPLETED");
                statement.setInt(3, 50);
                statement.executeUpdate();
            }
        }

        Flyway.configure().dataSource(url, username, password)
                .schemas(schema).defaultSchema(schema).load().migrate();

        try (var connection = DriverManager.getConnection(url + "?currentSchema=" + schema, username, password);
             var statement = connection.prepareStatement(
                     "SELECT COALESCE(SUM(amount), 0), COUNT(*), COUNT(goal_id) FROM progress_events WHERE user_id = ?")) {
            statement.setLong(1, userId);
            try (var rows = statement.executeQuery()) {
                rows.next();
                assertThat(rows.getInt(1)).isEqualTo(100);
                assertThat(rows.getInt(2)).isEqualTo(2);
                assertThat(rows.getInt(3)).isZero();
            }
        }
        assertThat(goalId).isPositive();
    }
}
