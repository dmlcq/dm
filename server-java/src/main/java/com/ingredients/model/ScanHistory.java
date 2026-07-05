package com.ingredients.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 扫描历史记录实体
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "scan_history")
public class ScanHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private String id;

    @Column(name = "image_key", length = 255)
    private String imageKey;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "health_score")
    private Integer healthScore;

    @Column(name = "recommendation", columnDefinition = "TEXT")
    private String recommendation;

    @Column(name = "product_name", length = 255)
    private String productName;

    @Column(name = "content_hash", length = 64)
    private String contentHash;

    @Column(name = "identity", length = 10)
    private String identity = "adult";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ingredients", columnDefinition = "jsonb")
    private List<Ingredient> ingredients;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}