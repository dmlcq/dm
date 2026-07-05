package com.ingredients;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 食品配料表 AI 分析服务
 * Spring Boot 主启动类
 */
@SpringBootApplication
public class IngredientsAnalyzerApplication {

    public static void main(String[] args) {
        SpringApplication.run(IngredientsAnalyzerApplication.class, args);
        System.out.println("========================================");
        System.out.println("  食品配料表 AI 分析服务启动成功！");
        System.out.println("  http://localhost:8080/api");
        System.out.println("========================================");
    }
}