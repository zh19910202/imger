# AnnotateFlow Assistant 扩展安装指南

## 🚀 快速安装步骤

### 1. 准备工作
- 确保使用 Chrome 浏览器（版本 88+）
- 确保项目文件完整（包含 manifest.json、background.js、content.js 等）

### 2. 安装扩展

#### 方法一：开发者模式安装（推荐）
1. 打开 Chrome 浏览器
2. 在地址栏输入：`chrome://extensions/`
3. 开启右上角的"开发者模式"开关
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹 `d:\app\imgerV2`
6. 确认安装

#### 方法二：打包安装
1. 在扩展管理页面点击"打包扩展程序"
2. 选择项目文件夹
3. 生成 .crx 文件
4. 拖拽 .crx 文件到扩展管理页面

### 3. 验证安装
- 在扩展管理页面应该看到"AnnotateFlow Assistant"扩展
- 扩展状态应为"已启用"
- 点击扩展图标应显示设置弹窗

## 🔧 故障排除

### Chrome Runtime API 不可用问题

#### 症状
- 控制台显示："Chrome runtime API不可用"
- 扩展功能无法正常使用
- 自动打开图片功能失效

#### 可能原因
1. **扩展未正确加载**
   - 检查扩展管理页面是否显示扩展
   - 确认扩展状态为"已启用"
   - 尝试重新加载扩展

2. **权限配置问题**
   - 检查 manifest.json 中的 permissions 配置
   - 确保包含必要权限：downloads, contextMenus, activeTab, storage

3. **Content Script 注入失败**
   - 确保在正确的网站测试（https://qlabel.tencent.com/*）
   - 刷新页面重新加载扩展
   - 检查网站是否匹配 manifest.json 中的 matches 规则

4. **Service Worker 问题**
   - 在扩展管理页面点击"检查视图 service worker"
   - 查看控制台是否有错误信息
   - 尝试重启 Chrome 浏览器

#### 解决步骤

**步骤 1：使用诊断工具**
1. 在 Chrome 中打开：`file:///d:/app/imgerV2/extension_diagnostic.html`
2. 点击"开始诊断"按钮
3. 查看诊断结果，根据提示解决问题

**步骤 2：重新安装扩展**
1. 在扩展管理页面移除现有扩展
2. 重新按照安装步骤加载扩展
3. 确保所有文件权限正确

**步骤 3：检查文件完整性**
确保以下文件存在且内容正确：
- `manifest.json` - 扩展配置文件
- `background.js` - 后台脚本
- `content.js` - 内容脚本
- `popup.html` - 弹窗页面
- `popup.js` - 弹窗脚本
- `native_host.py` - 本地主机程序

**步骤 4：检查网站兼容性**
1. 确保在 https://qlabel.tencent.com/ 网站测试
2. 检查网站是否使用 HTTPS 协议
3. 尝试在其他支持的网站测试

## 🎯 使用说明

### 基本功能
- **D键**：下载当前选中的图片
- **空格键**：跳过当前图片
- **S键**：提交当前标注
- **A键**：上传图片
- **F键**：查看历史记录

### 设置选项
- **自动打开图片**：下载完成后自动打开图片
- **S键音效**：按S键时播放提示音

### 右键菜单
- 在图片上右键可看到"下载图片"选项
- 支持批量下载选中的图片

## 📋 系统要求

- **浏览器**：Chrome 88+ 或 Edge 88+
- **操作系统**：Windows 10+, macOS 10.14+, Linux
- **权限**：需要访问下载、存储、上下文菜单权限
- **网络**：需要访问目标网站的权限

## 🔍 调试信息

### 查看扩展日志
1. 打开扩展管理页面：`chrome://extensions/`
2. 找到 AnnotateFlow Assistant 扩展
3. 点击"检查视图"下的链接
4. 在开发者工具中查看 Console 标签

### 查看 Content Script 日志
1. 在目标网站按 F12 打开开发者工具
2. 切换到 Console 标签
3. 查看是否有扩展相关的日志信息

### 常见错误信息
- `Chrome runtime API不可用` - 扩展未正确加载
- `Extension context invalidated` - 扩展被重新加载
- `Could not establish connection` - Background script 通信失败

## 📞 技术支持

如果按照上述步骤仍无法解决问题，请：
1. 运行诊断工具获取详细信息
2. 检查浏览器控制台的错误信息
3. 确认系统环境符合要求
4. 尝试在不同的网站测试扩展功能

---

**注意**：此扩展主要为腾讯 QLabel 标注平台优化，在其他网站可能功能受限。