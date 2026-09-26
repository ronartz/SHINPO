package com.shinpo.repository;

import com.shinpo.entity.FocusSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FocusSessionRepository extends JpaRepository<FocusSession, Long> {

    List<FocusSession> findAllByUser_IdOrderByCreatedAtDesc(Long userId);

    Optional<FocusSession> findByIdAndUser_Id(Long id, Long userId);
}