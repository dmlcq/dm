package com.ingredients.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * 配料信息
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Ingredient {
    
    private String name;           // 配料名称
    private String riskLevel;      // 风险等级：safe/warning/danger
    private String description;    // 描述说明
    private String alternative;    // 替代建议
}