package com.shinpo.repository;

import com.shinpo.entity.Mission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MissionRepository extends JpaRepository<Mission, Long> {
    List<Mission> findAllByGoal_User_Id(Long userId);
    List<Mission> findAllByGoal_User_IdOrderByCreatedAtDesc(Long userId);
}