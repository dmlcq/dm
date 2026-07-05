package com.ingredients.controller;

import com.ingredients.model.*;
import com.ingredients.service.IngredientsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 配料分析 API Controller
 */
@RestController
@RequestMapping("/ingredients")
public class IngredientsController {

    @Autowired
    private IngredientsService service;

    /**
     * 上传并分析配料表图片
     * POST /api/ingredients/upload
     */
    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<AnalysisResult>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "identity", defaultValue = "adult") String identity) {
        
        try {
            AnalysisResult result = service.uploadAndAnalyze(file, identity);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                    .body(ApiResponse.error("分析失败: " + e.getMessage()));
        }
    }

    /**
     * 获取历史记录列表
     * GET /api/ingredients/history
     */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<List<ScanHistory>>> getHistory(
            @RequestParam(value = "identity", required = false) String identity) {
        
        List<ScanHistory> history = service.getHistory(identity);
        return ResponseEntity.ok(ApiResponse.success(history));
    }

    /**
     * 获取历史详情
     * GET /api/ingredients/history/{id}
     */
    @GetMapping("/history/{id}")
    public ResponseEntity<ApiResponse<ScanHistory>> getHistoryDetail(@PathVariable String id) {
        
        ScanHistory history = service.getHistoryDetail(id);
        if (history == null) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error(404, "记录不存在"));
        }
        return ResponseEntity.ok(ApiResponse.success(history));
    }

    /**
     * 删除历史记录
     * DELETE /api/ingredients/history/{id}
     */
    @DeleteMapping("/history/{id}")
    public ResponseEntity<ApiResponse<Boolean>> deleteHistory(@PathVariable String id) {
        
        boolean deleted = service.deleteHistory(id);
        if (!deleted) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error(404, "记录不存在"));
        }
        return ResponseEntity.ok(ApiResponse.success(true));
    }

    /**
     * 健康检查
     * GET /api/hello
     */
    @GetMapping("/hello")
    @ResponseBody
    public String hello() {
        return "Java Backend is running!";
    }
}