package com.shinpo.repository;

import com.shinpo.entity.UserOnboarding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserOnboardingRepository extends JpaRepository<UserOnboarding, Long> {
    Optional<UserOnboarding> findByUserId(Long userId);
}

