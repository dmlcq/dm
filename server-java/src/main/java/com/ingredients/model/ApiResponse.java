package com.ingredients.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * API 响应包装类
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {
    
    private Integer code;
    private String msg;
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "success", data);
    }

    public static <T> ApiResponse<T> error(String msg) {
        return new ApiResponse<>(500, msg, null);
    }

    public static <T> ApiResponse<T> error(Integer code, String msg) {
        return new ApiResponse<>(code, msg, null);
    }
}