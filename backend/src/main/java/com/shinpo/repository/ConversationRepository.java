package com.shinpo.repository;

import com.shinpo.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    Optional<Conversation> findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(Long userId, String status);

    Optional<Conversation> findByConversationUuidAndUser_Id(String conversationUuid, Long userId);

    List<Conversation> findAllByUser_IdOrderByUpdatedAtDesc(Long userId);
}
