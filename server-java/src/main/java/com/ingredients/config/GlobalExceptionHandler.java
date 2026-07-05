package com.ingredients.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import com.ingredients.model.ApiResponse;

/**
 * 全局异常处理
 */
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    @ResponseBody
    public ApiResponse<String> handleException(HttpServletRequest request, Exception e) {
        e.printStackTrace();
        return ApiResponse.error(500, "服务错误: " + e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseBody
    public ApiResponse<String> handleIllegalArgument(HttpServletRequest request, IllegalArgumentException e) {
        return ApiResponse.error(400, "参数错误: " + e.getMessage());
    }
}