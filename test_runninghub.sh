#!/bin/bash

# RunningHub API 测试脚本
# 测试图片上传和AI应用任务创建功能

set -e  # 遇到错误就退出

# 配置
API_KEY="${RUNNINGHUB_API_KEY:-}"
IMAGE_FILE="1.png"
WEBAPP_ID="1967790629851922434"
PROMPT="1 girl in classroom"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    if ! command -v curl &> /dev/null; then
        log_error "curl 未安装，请先安装 curl"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_warning "jq 未安装，JSON格式化将不可用"
    fi

    log_success "依赖检查完成"
}

# 检查API密钥
check_api_key() {
    log_info "检查API密钥..."

    if [ -z "$API_KEY" ]; then
        echo -n "请输入您的RunningHub API Key: "
        read -r API_KEY

        if [ -z "$API_KEY" ]; then
            log_error "API Key不能为空"
            exit 1
        fi
    fi

    log_success "API Key已配置"
}

# 检查图片文件
check_image_file() {
    log_info "检查图片文件..."

    if [ ! -f "$IMAGE_FILE" ]; then
        log_error "图片文件 '$IMAGE_FILE' 不存在"
        log_info "当前目录内容:"
        ls -la
        exit 1
    fi

    # 检查文件大小
    file_size=$(stat -f%z "$IMAGE_FILE" 2>/dev/null || stat -c%s "$IMAGE_FILE" 2>/dev/null)
    file_size_mb=$((file_size / 1024 / 1024))

    if [ $file_size -gt 31457280 ]; then  # 30MB
        log_error "图片文件过大 (${file_size_mb}MB)，超过30MB限制"
        exit 1
    fi

    log_success "图片文件检查完成 (${file_size_mb}MB)"
}

# 上传图片
upload_image() {
    log_info "上传图片到RunningHub..."

    local response=$(curl -s \
        -H "Host: www.runninghub.cn" \
        -F "apiKey=$API_KEY" \
        -F "file=@$IMAGE_FILE" \
        -F "fileType=image" \
        "https://www.runninghub.cn/task/openapi/upload")

    echo "$response" > upload_response.json

    if command -v jq &> /dev/null; then
        echo "$response" | jq .
    else
        echo "$response"
    fi

    # 检查响应
    local code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d: -f2)
    if [ "$code" != "0" ]; then
        local msg=$(echo "$response" | grep -o '"msg":"[^"]*"' | cut -d: -f2 | tr -d '"')
        log_error "图片上传失败: $msg"
        exit 1
    fi

    # 提取文件名
    IMAGE_FILENAME=$(echo "$response" | grep -o '"fileName":"[^"]*"' | cut -d: -f2 | tr -d '"')
    log_success "图片上传成功: $IMAGE_FILENAME"
}

# 创建AI应用任务
create_ai_app_task() {
    log_info "创建AI应用任务..."

    local json_payload=$(cat << EOF
{
    "webappId": "$WEBAPP_ID",
    "apiKey": "$API_KEY",
    "nodeInfoList": [
        {
            "nodeId": "189",
            "fieldName": "image",
            "fieldValue": "$IMAGE_FILENAME",
            "description": "image"
        },
        {
            "nodeId": "191",
            "fieldName": "prompt",
            "fieldValue": "$PROMPT",
            "description": "prompt"
        }
    ]
}
EOF
)

    local response=$(curl -s \
        -H "Host: www.runninghub.cn" \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        "https://www.runninghub.cn/task/openapi/ai-app/run")

    echo "$response" > task_response.json

    if command -v jq &> /dev/null; then
        echo "$response" | jq .
    else
        echo "$response"
    fi

    # 检查响应
    local code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d: -f2)
    if [ "$code" != "0" ]; then
        local msg=$(echo "$response" | grep -o '"msg":"[^"]*"' | cut -d: -f2 | tr -d '"')
        log_error "任务创建失败: $msg"
        exit 1
    fi

    # 提取任务ID
    TASK_ID=$(echo "$response" | grep -o '"taskId":"[^"]*"' | cut -d: -f2 | tr -d '"')
    log_success "任务创建成功: $TASK_ID"
}

# 查询任务状态
check_task_status() {
    log_info "查询任务状态..."

    local json_payload=$(cat << EOF
{
    "apiKey": "$API_KEY",
    "taskId": "$TASK_ID"
}
EOF
)

    local response=$(curl -s \
        -H "Host: www.runninghub.cn" \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        "https://www.runninghub.cn/task/openapi/status")

    echo "$response" > status_response.json

    if command -v jq &> /dev/null; then
        echo "$response" | jq .
    else
        echo "$response"
    fi

    # 提取状态
    local status=$(echo "$response" | grep -o '"data":"[^"]*"' | cut -d: -f2 | tr -d '"')
    log_info "任务状态: $status"

    echo "$status"
}

# 获取任务输出
get_task_outputs() {
    log_info "获取任务输出..."

    local json_payload=$(cat << EOF
{
    "apiKey": "$API_KEY",
    "taskId": "$TASK_ID"
}
EOF
)

    local response=$(curl -s \
        -H "Host: www.runninghub.cn" \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        "https://www.runninghub.cn/task/openapi/outputs")

    echo "$response" > outputs_response.json

    if command -v jq &> /dev/null; then
        echo "$response" | jq .
    else
        echo "$response"
    fi

    # 检查是否有输出
    local code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d: -f2)
    if [ "$code" = "0" ]; then
        log_success "任务输出获取成功"

        # 尝试提取图片URL
        local file_urls=$(echo "$response" | grep -o '"fileUrl":"[^"]*"' | cut -d: -f2-3 | tr -d '"')
        if [ -n "$file_urls" ]; then
            log_info "生成的图片URL:"
            echo "$file_urls"
        fi
    else
        local msg=$(echo "$response" | grep -o '"msg":"[^"]*"' | cut -d: -f2 | tr -d '"')
        log_warning "获取输出失败或任务未完成: $msg"
    fi
}

# 轮询任务直到完成
poll_task_until_complete() {
    log_info "开始轮询任务状态..."

    local max_attempts=60  # 最多轮询60次 (5分钟)
    local attempt=0
    local interval=5  # 每5秒查询一次

    while [ $attempt -lt $max_attempts ]; do
        local status=$(check_task_status)

        case "$status" in
            "SUCCESS")
                log_success "任务执行成功!"
                get_task_outputs
                return 0
                ;;
            "FAILED"|"ERROR")
                log_error "任务执行失败: $status"
                return 1
                ;;
            "QUEUED"|"RUNNING")
                log_info "任务正在执行中... ($((attempt + 1))/$max_attempts)"
                ;;
            *)
                log_warning "未知状态: $status"
                ;;
        esac

        attempt=$((attempt + 1))
        sleep $interval
    done

    log_warning "轮询超时，任务可能仍在执行中"
    log_info "您可以稍后手动查询任务状态: $TASK_ID"
}

# 清理临时文件
cleanup() {
    log_info "清理临时文件..."
    rm -f upload_response.json task_response.json status_response.json outputs_response.json
}

# 主函数
main() {
    echo "=========================================="
    echo "RunningHub API 功能测试脚本"
    echo "=========================================="

    # 设置清理陷阱
    trap cleanup EXIT

    # 执行测试步骤
    check_dependencies
    check_api_key
    check_image_file

    echo ""
    log_info "开始测试流程..."
    echo ""

    # 步骤1: 上传图片
    upload_image
    echo ""

    # 步骤2: 创建任务
    create_ai_app_task
    echo ""

    # 步骤3: 轮询直到完成
    poll_task_until_complete
    echo ""

    log_success "测试完成!"
    log_info "任务ID: $TASK_ID"
    log_info "响应文件已保存到当前目录"
}

# 运行主函数
main "$@"