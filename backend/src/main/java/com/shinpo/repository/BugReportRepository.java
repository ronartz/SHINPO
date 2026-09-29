package com.shinpo.repository;

import com.shinpo.entity.BugReport;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface BugReportRepository extends JpaRepository<BugReport, Long> {
    Optional<BugReport> findByBugId(String bugId);
    List<BugReport> findAllByUser_IdOrderByCreatedAtDesc(Long userId);
}
