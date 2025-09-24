#!/bin/bash
# AnnotateFlow-Assistant macOS 安装脚本
# 版本: {{VERSION}}

echo "正在安装 AnnotateFlow-Assistant..."

# 检查Homebrew
if ! command -v brew &> /dev/null
then
    echo "未检测到Homebrew，正在安装..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ $? -ne 0 ]; then
        echo "Homebrew安装失败，请手动安装后再运行此脚本"
        exit 1
    fi
fi

# 检查Python环境
if ! command -v python3 &> /dev/null
then
    echo "未检测到Python环境，正在通过Homebrew安装..."
    brew install python
    if [ $? -ne 0 ]; then
        echo "Python安装失败"
        exit 1
    fi
fi

# 验证Python安装
PYTHON_VERSION=$(python3 --version 2>&1)
if [ $? -ne 0 ]; then
    echo "Python安装验证失败"
    exit 1
fi

echo "Python环境已准备就绪: $PYTHON_VERSION"

# 安装Python依赖（如果需要）
echo "正在安装Python依赖..."
pip3 install -r requirements.txt 2>/dev/null || echo "警告：无法安装Python依赖，可能需要手动安装"

# 配置Chrome Native Messaging Host
echo "正在配置Chrome Native Messaging Host..."

NATIVE_HOST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.annotateflow.assistant"
mkdir -p "$NATIVE_HOST_DIR"
cp native_host.py "$NATIVE_HOST_DIR/native_host.py"

# 创建manifest.json
cat > "$NATIVE_HOST_DIR/com.annotateflow.assistant.json" << EOF
{
  "name": "com.annotateflow.assistant",
  "description": "Chrome extension for Tencent QLabel annotation platform with PS integration",
  "path": "$NATIVE_HOST_DIR/native_host.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://__MSG_@@extension_id__/"
  ]
}
EOF

echo "安装完成！"
echo ""
echo "请在Chrome中加载扩展："
echo "1. 打开Chrome浏览器"
echo "2. 进入 chrome://extensions/"
echo "3. 启用\"开发者模式\""
echo "4. 点击\"加载已解压的扩展程序\""
echo "5. 选择extension文件夹"