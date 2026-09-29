package com.shinpo.repository;

import com.shinpo.entity.ConversationMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {

    List<ConversationMessage> findAllByConversation_IdOrderByCreatedAtAsc(Long conversationId);

    List<ConversationMessage> findTop20ByConversation_IdOrderByCreatedAtDesc(Long conversationId);
}
