#!/bin/bash

echo "正在安装 AnnotateFlow Assistant Native Host (macOS)..."

# 获取当前目录
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误：未找到Python3，请先安装Python 3.6+"
    exit 1
fi

# 检查文件是否存在
if [ ! -f "$CURRENT_DIR/native_host.py" ]; then
    echo "错误：native_host.py 文件不存在"
    exit 1
fi

if [ ! -f "$CURRENT_DIR/native_host_launcher.sh" ]; then
    echo "错误：native_host_launcher.sh 文件不存在"
    exit 1
fi

if [ ! -f "$CURRENT_DIR/com.annotateflow.assistant.json" ]; then
    echo "错误：com.annotateflow.assistant.json 文件不存在"
    exit 1
fi

# 创建NativeMessagingHosts目录
NATIVE_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$NATIVE_DIR"

# 复制文件到Chrome目录
cp "$CURRENT_DIR/com.annotateflow.assistant.json" "$NATIVE_DIR/"
cp "$CURRENT_DIR/native_host.py" "$NATIVE_DIR/"
cp "$CURRENT_DIR/native_host_launcher.sh" "$NATIVE_DIR/"

# 更新JSON文件中的路径
sed -i '' "s|native_host_launcher.bat|native_host_launcher.sh|g" "$NATIVE_DIR/com.annotateflow.assistant.json"

echo "Native Host 安装完成！"
echo "文件已复制到：$NATIVE_DIR"
echo "请重启Chrome浏览器以使更改生效。"