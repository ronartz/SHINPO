package com.shinpo.repository;

import com.shinpo.entity.SentinelPolicyRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SentinelPolicyRuleRepository extends JpaRepository<SentinelPolicyRule, Long> {

    List<SentinelPolicyRule> findAllByUser_IdOrderByCreatedAtDesc(Long userId);

    Optional<SentinelPolicyRule> findByUser_IdAndProcessNamePatternIgnoreCase(Long userId, String processNamePattern);

    Optional<SentinelPolicyRule> findByIdAndUser_Id(Long id, Long userId);

    boolean existsByUser_IdAndProcessNamePatternIgnoreCase(Long userId, String processNamePattern);
}
