package com.ingredients.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.GetUrlRequest;

import java.net.URI;
import java.util.UUID;

/**
 * 对象存储服务 (兼容 TOS / S3)
 */
@Service
public class StorageService {

    @Value("${storage.endpoint}")
    private String endpoint;

    @Value("${storage.access-key}")
    private String accessKey;

    @Value("${storage.secret-key}")
    private String secretKey;

    @Value("${storage.bucket}")
    private String bucket;

    @Value("${storage.region}")
    private String region;

    /**
     * 上传文件
     */
    public String upload(MultipartFile file) throws Exception {
        S3Client s3Client = createS3Client();

        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null && originalFilename.contains(".") 
                ? originalFilename.substring(originalFilename.lastIndexOf(".")) 
                : ".jpg";
        
        String key = "ingredients/" + System.currentTimeMillis() + "_" + 
                     UUID.randomUUID().toString().substring(0, 8) + extension;

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(file.getContentType())
                .build();

        s3Client.putObject(request, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        return key;
    }

    /**
     * 获取公开访问 URL
     */
    public String getPublicUrl(String key) {
        S3Client s3Client = createS3Client();
        
        GetUrlRequest request = GetUrlRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        return s3Client.utilities().getUrl(request).toString();
    }

    /**
     * 创建 S3 客户端
     */
    private S3Client createS3Client() {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKey, secretKey);

        return S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .build();
    }
}