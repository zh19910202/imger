#!/bin/bash

# Content.js 版本切换脚本
# 用于在原始版本和重构版本之间切换

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 显示当前状态
show_current_status() {
    echo -e "${BLUE}=== 当前版本状态 ===${NC}"
    
    if [ -f "manifest.json" ]; then
        if grep -q '"js": \["resource-extractor.js", "content.js"\]' manifest.json; then
            echo -e "📜 当前使用: ${YELLOW}原始版本 (v1.0.0)${NC}"
            echo -e "   文件: content.js (8373行, 300KB+)"
        elif grep -q '"js": \["resource-extractor.js", "src/content.js"\]' manifest.json; then
            echo -e "🚀 当前使用: ${GREEN}重构版本 (v2.0.0)${NC}"
            echo -e "   文件: src/content.js (模块化架构)"
        else
            echo -e "❓ 未知版本配置"
        fi
    else
        echo -e "${RED}❌ manifest.json 文件不存在${NC}"
        exit 1
    fi
    echo ""
}

# 切换到原始版本
switch_to_original() {
    echo -e "${YELLOW}切换到原始版本...${NC}"
    
    # 备份当前manifest
    cp manifest.json manifest.json.backup
    
    # 使用原始版本的manifest配置
    cat > manifest.json << 'EOF'
{
  "manifest_version": 3,
  "name": "Auxis",
  "version": "2.5.0",
  "description": "Annotation platform assistant: Fast image download with D key, skip with Space, submit with S key, upload with A key, history with F key, mark invalid with X key (auto-confirm), batch invalid with F1, AI image processing with R key (RunningHub integration)",
  "permissions": [
    "downloads",
    "contextMenus",
    "activeTab",
    "storage",
    "notifications",
    "tabs",
    "nativeMessaging",
    "webRequest"
  ],
  "host_permissions": [
    "<all_urls>",
    "*://aidata-1258344706.cos.ap-guangzhou.myqcloud.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "Auxis",
    "default_icon": {
      "16": "icon.png",
      "32": "icon.png",
      "48": "icon.png",
      "128": "icon.png"
    }
  },
  "icons": {
    "16": "icon.png",
    "32": "icon.png",
    "48": "icon.png",
    "128": "icon.png"
  },
  "content_scripts": [
    {
      "matches": ["https://qlabel.tencent.com/*", "http://localhost:*/*", "file://*/*"],
      "js": ["resource-extractor.js", "content.js"]
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["notification.mp3", "runninghub-config.json"],
      "matches": ["https://qlabel.tencent.com/*", "http://localhost:*/*", "file://*/*"]
    }
  ]
}
EOF
    
    echo -e "${GREEN}✅ 已切换到原始版本${NC}"
    echo -e "   请重新加载浏览器扩展以生效"
}

# 切换到重构版本
switch_to_refactored() {
    echo -e "${BLUE}切换到重构版本...${NC}"
    
    # 检查重构文件是否存在
    if [ ! -f "src/content.js" ]; then
        echo -e "${RED}❌ 重构版本文件不存在: src/content.js${NC}"
        echo -e "   请确保重构代码已正确部署"
        exit 1
    fi
    
    # 备份当前manifest
    cp manifest.json manifest.json.backup
    
    # 使用重构版本的manifest配置
    cp manifest-refactored.json manifest.json
    
    echo -e "${GREEN}✅ 已切换到重构版本${NC}"
    echo -e "   请重新加载浏览器扩展以生效"
}

# 恢复备份
restore_backup() {
    if [ -f "manifest.json.backup" ]; then
        echo -e "${YELLOW}恢复备份...${NC}"
        cp manifest.json.backup manifest.json
        echo -e "${GREEN}✅ 已恢复备份${NC}"
    else
        echo -e "${RED}❌ 没有找到备份文件${NC}"
    fi
}

# 显示帮助信息
show_help() {
    echo -e "${BLUE}Content.js 版本切换工具${NC}"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  original    切换到原始版本 (📜 v1.0.0)"
    echo "  refactored  切换到重构版本 (🚀 v2.0.0)"
    echo "  status      显示当前版本状态"
    echo "  restore     恢复备份"
    echo "  help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 status              # 查看当前版本"
    echo "  $0 refactored          # 切换到重构版本"
    echo "  $0 original            # 切换到原始版本"
    echo ""
    echo -e "${YELLOW}注意: 切换版本后需要重新加载浏览器扩展${NC}"
}

# 主逻辑
case "${1:-status}" in
    "original")
        show_current_status
        switch_to_original
        echo ""
        show_current_status
        ;;
    "refactored")
        show_current_status
        switch_to_refactored
        echo ""
        show_current_status
        ;;
    "status")
        show_current_status
        ;;
    "restore")
        restore_backup
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo -e "${RED}❌ 未知选项: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

echo -e "${BLUE}💡 提示:${NC}"
echo "1. 切换版本后，请在浏览器中重新加载扩展"
echo "2. 可以通过控制台检查版本: console.log(window.ANNOTATEFLOW_VERSION)"
echo "3. 使用 generateVersionReport() 获取详细版本信息"