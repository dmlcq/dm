#!/bin/bash

# Java 后端启动脚本

cd /workspace/projects/server-java

echo "========================================"
echo "  食品配料表 AI 分析服务 (Java版)"
echo "========================================"

# 检查 Maven 是否安装
if ! command -v mvn &> /dev/null; then
    echo "错误: Maven 未安装"
    echo "请先安装 Maven: apt install maven"
    exit 1
fi

# 编译项目
echo "编译项目..."
mvn clean package -DskipTests

# 启动服务
echo "启动服务..."
java -jar target/ingredients-analyzer-1.0.0.jar