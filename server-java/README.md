# Java 后端 - 食品配料表 AI 分析服务

## 项目结构

```
server-java/
├── pom.xml                              # Maven 依赖配置
├── start.sh                             # 启动脚本
├── src/main/
│   ├── java/com/ingredients/
│   │   ├── IngredientsAnalyzerApplication.java  # 主启动类
│   │   ├── controller/
│   │   │   └── IngredientsController.java       # API 控制器
│   │   ├── service/
│   │   │   ├── IngredientsService.java          # 配料分析服务
│   │   │   └── StorageService.java              # 对象存储服务
│   │   ├── repository/
│   │   │   └── ScanHistoryRepository.java       # 数据访问层
│   │   ├── model/
│   │   │   ├── ScanHistory.java                 # 历史记录实体
│   │   │   ├── Ingredient.java                  # 配料实体
│   │   │   ├── AnalysisResult.java              # 分析结果
│   │   │   └── ApiResponse.java                 # API 响应包装
│   │   └── config/
│   │       ├── CorsConfig.java                  # 跨域配置
│   │       └── GlobalExceptionHandler.java      # 异常处理
│   └── resources/
│       └── application.yml                      # 配置文件
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/ingredients/upload` | POST | 上传图片并分析 |
| `/api/ingredients/history` | GET | 获取历史记录 |
| `/api/ingredients/history/{id}` | GET | 获取历史详情 |
| `/api/ingredients/history/{id}` | DELETE | 删除历史记录 |
| `/api/hello` | GET | 健康检查 |

## 配置说明

### 数据库 (PostgreSQL)

```yaml
spring.datasource.url: jdbc:postgresql://host:port/database
spring.datasource.username: 用户名
spring.datasource.password: 密码
```

### 对象存储 (TOS/S3)

```yaml
storage.endpoint: https://tos-cn-beijing.volces.com
storage.access-key: 你的access-key
storage.secret-key: 你的secret-key
storage.bucket: bucket名称
```

### LLM API

```yaml
llm.api-url: https://ark.cn-beijing.volces.com/api/v3/chat/completions
llm.api-key: 你的API密钥
llm.model: doubao-seed-2-0-pro-260215
```

## 启动方式

### 方式 1: 使用启动脚本
```bash
chmod +x start.sh
./start.sh
```

### 方式 2: Maven 启动
```bash
mvn spring-boot:run
```

### 方式 3: 打包后运行
```bash
mvn clean package -DskipTests
java -jar target/ingredients-analyzer-1.0.0.jar
```

## 依赖版本

- Spring Boot 3.2.0
- Java 17
- PostgreSQL Driver
- AWS S3 SDK (兼容 TOS)
- OkHttp 4.12.0 (LLM API 调用)