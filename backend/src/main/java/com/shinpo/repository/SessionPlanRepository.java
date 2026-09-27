package com.shinpo.repository;

import com.shinpo.entity.SessionPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionPlanRepository extends JpaRepository<SessionPlan, Long> {
    List<SessionPlan> findAllByUser_Id(Long userId);
    Optional<SessionPlan> findByIdAndUser_Id(Long id, Long userId);
}