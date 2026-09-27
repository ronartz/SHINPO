package com.shinpo.repository;

import com.shinpo.entity.SessionInterval;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SessionIntervalRepository extends JpaRepository<SessionInterval, Long> {
    List<SessionInterval> findAllByPlan_IdOrderByIntervalOrderAsc(Long planId);
}