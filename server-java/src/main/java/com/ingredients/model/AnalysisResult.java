package com.ingredients.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.List;

/**
 * AI 分析结果
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisResult {
    
    private Integer healthScore;        // 健康评分 0-100
    private String recommendation;      // 整体建议：recommend/caution/avoid
    private String productName;         // 产品名称
    private List<Ingredient> ingredients;  // 配料列表
    private Boolean cached;             // 是否来自缓存
}