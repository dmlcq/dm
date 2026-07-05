package com.ingredients.repository;

import com.ingredients.model.ScanHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 扫描历史 Repository
 */
@Repository
public interface ScanHistoryRepository extends JpaRepository<ScanHistory, String> {
    
    List<ScanHistory> findByIdentityOrderByCreatedAtDesc(String identity);
    
    List<ScanHistory> findAllByOrderByCreatedAtDesc();
    
    Optional<ScanHistory> findByContentHashAndIdentity(String contentHash, String identity);
    
    void deleteById(String id);
}