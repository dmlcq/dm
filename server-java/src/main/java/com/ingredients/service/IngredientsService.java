package com.ingredients.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ingredients.model.*;
import com.ingredients.repository.ScanHistoryRepository;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 配料分析服务
 */
@Service
public class IngredientsService {

    @Autowired
    private ScanHistoryRepository repository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StorageService storageService;

    @Value("${llm.api-url}")
    private String llmApiUrl;

    @Value("${llm.api-key}")
    private String llmApiKey;

    @Value("${llm.model}")
    private String llmModel;

    // 内存缓存 (30分钟 TTL)
    private final ConcurrentHashMap<String, CacheEntry> memoryCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 30 * 60 * 1000;

    /**
     * 上传图片并分析
     */
    public AnalysisResult uploadAndAnalyze(MultipartFile file, String identity) throws Exception {
        // 1. 上传图片到对象存储
        String imageKey = storageService.upload(file);
        String imageUrl = storageService.getPublicUrl(imageKey);

        // 2. 调用 LLM 分析
        AnalysisResult result = analyzeWithLLM(imageUrl, identity);

        // 3. 生成配料内容 hash
        String contentHash = generateContentHash(result.getIngredients());

        // 4. 检查数据库缓存（相同配料+身份是否已分析过）
        Optional<ScanHistory> cached = repository.findByContentHashAndIdentity(contentHash, identity);
        if (cached.isPresent()) {
            result.setCached(true);
            return result;
        }

        // 5. 保存到数据库
        ScanHistory history = new ScanHistory();
        history.setImageKey(imageKey);
        history.setImageUrl(imageUrl);
        history.setHealthScore(result.getHealthScore());
        history.setRecommendation(result.getRecommendation());
        history.setProductName(result.getProductName());
        history.setIngredients(result.getIngredients());
        history.setContentHash(contentHash);
        history.setIdentity(identity);
        repository.save(history);

        // 6. 保存到内存缓存
        String cacheKey = contentHash + "_" + identity;
        memoryCache.put(cacheKey, new CacheEntry(result, System.currentTimeMillis()));

        result.setCached(false);
        return result;
    }

    /**
     * 调用 LLM 分析配料表
     */
    private AnalysisResult analyzeWithLLM(String imageUrl, String identity) throws Exception {
        // 根据身份生成不同的提示词
        String identityPrompt = getIdentityPrompt(identity);

        String prompt = """
            请分析这张食品配料表图片，提取所有配料信息并评估健康风险。
            
            %s
            
            请返回以下 JSON 格式的分析结果：
            {
              "healthScore": 0-100的健康评分,
              "recommendation": "recommend/caution/avoid",
              "productName": "产品名称",
              "ingredients": [
                {
                  "name": "配料名称",
                  "riskLevel": "safe/warning/danger",
                  "description": "说明",
                  "alternative": "替代建议（如适用）"
                }
              ]
            }
            
            风险等级标准：
            - safe: 安全成分，可以放心食用
            - warning: 存在风险，建议控制摄入量
            - danger: 高风险成分，建议避免
            """.formatted(identityPrompt);

        // 构建请求
        OkHttpClient client = new OkHttpClient();
        
        Map<String, Object> content = new HashMap<>();
        content.put("type", "image_url");
        content.put("image_url", Map.of("url", imageUrl));

        Map<String, Object> textContent = new HashMap<>();
        textContent.put("type", "text");
        textContent.put("text", prompt);

        Map<String, Object> message = new HashMap<>();
        message.put("role", "user");
        message.put("content", List.of(textContent, content));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", llmModel);
        requestBody.put("messages", List.of(message));

        String jsonBody = objectMapper.writeValueAsString(requestBody);

        Request request = new Request.Builder()
                .url(llmApiUrl)
                .addHeader("Authorization", "Bearer " + llmApiKey)
                .addHeader("Content-Type", "application/json")
                .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                .build();

        Response response = client.newCall(request).execute();
        String responseBody = response.body().string();

        // 解析响应
        Map<String, Object> responseMap = objectMapper.readValue(responseBody, Map.class);
        List<Map<String, Object>> choices = (List<Map<String, Object>>) responseMap.get("choices");
        Map<String, Object> firstChoice = choices.get(0);
        Map<String, Object> messageResp = (Map<String, Object>) firstChoice.get("message");
        String contentResp = (String) messageResp.get("content");

        // 提取 JSON（去除可能的 markdown 格式）
        String jsonStr = extractJson(contentResp);
        
        return objectMapper.readValue(jsonStr, AnalysisResult.class);
    }

    /**
     * 根据身份获取提示词
     */
    private String getIdentityPrompt(String identity) {
        switch (identity) {
            case "child":
                return "分析对象：儿童（12岁以下）。请特别注意儿童不宜的成分，如人工色素、防腐剂、过量糖分等，将这些标注为 danger。";
            case "pregnant":
                return "分析对象：孕妇。请特别注意孕妇不宜的成分，如咖啡因、某些防腐剂、人工甜味剂等，将这些标注为 danger。";
            case "adult":
                return "分析对象：成年人。适量添加剂可接受，标注为 warning，仅高风险成分标注为 danger。";
            default:
                return "分析对象：成年人。适量添加剂可接受，标注为 warning。";
        }
    }

    /**
     * 从响应中提取 JSON
     */
    private String extractJson(String content) {
        if (content.contains("```json")) {
            int start = content.indexOf("```json") + 7;
            int end = content.indexOf("```", start);
            return content.substring(start, end).trim();
        } else if (content.contains("```")) {
            int start = content.indexOf("```") + 3;
            int end = content.indexOf("```", start);
            return content.substring(start, end).trim();
        } else {
            int start = content.indexOf("{");
            int end = content.lastIndexOf("}") + 1;
            return content.substring(start, end);
        }
    }

    /**
     * 生成配料内容 hash
     */
    private String generateContentHash(List<Ingredient> ingredients) {
        if (ingredients == null || ingredients.isEmpty()) {
            return "";
        }
        
        // 提取配料名称，排序后拼接
        List<String> names = ingredients.stream()
                .map(i -> i.getName().trim().toLowerCase())
                .sorted()
                .toList();
        
        String content = String.join("|", names);
        
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(content.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                hexString.append(String.format("%02x", b));
            }
            return hexString.toString();
        } catch (Exception e) {
            return content;
        }
    }

    /**
     * 获取历史记录
     */
    public List<ScanHistory> getHistory(String identity) {
        if (identity != null && !identity.isEmpty()) {
            return repository.findByIdentityOrderByCreatedAtDesc(identity);
        }
        return repository.findAllByOrderByCreatedAtDesc();
    }

    /**
     * 获取历史详情
     */
    public ScanHistory getHistoryDetail(String id) {
        return repository.findById(id).orElse(null);
    }

    /**
     * 删除历史记录
     */
    public boolean deleteHistory(String id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return true;
        }
        return false;
    }

    /**
     * 内存缓存条目
     */
    private static class CacheEntry {
        final AnalysisResult result;
        final long timestamp;

        CacheEntry(AnalysisResult result, long timestamp) {
            this.result = result;
            this.timestamp = timestamp;
        }

        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > CACHE_TTL_MS;
        }
    }
}