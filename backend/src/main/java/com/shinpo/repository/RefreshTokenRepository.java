package com.shinpo.repository;

import com.shinpo.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    Optional<RefreshToken> findFirstByTokenHash(String tokenHash);

    List<RefreshToken> findAllByUser_Id(Long userId);

    @Modifying
    @Transactional
    void deleteAllByUser_Id(Long userId);
}
