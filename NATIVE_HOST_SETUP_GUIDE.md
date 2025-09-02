# 🔧 Native Host 修复完成指南

## ✅ 已修复的问题

1. **添加了 nativeMessaging 权限**
   - 在 `manifest.json` 中添加了 `"nativeMessaging"` 权限
   - 解决了 `chrome.runtime.connectNative is not a function` 错误

2. **修复了 Native Host 配置**
   - 更新了 `com.annotateflow.assistant.json` 中的扩展ID
   - 改进了 `install_native_host.bat` 安装脚本
   - 添加了注册表自动注册功能

3. **Native Host 文件已正确安装**
   - 文件位置: `%USERPROFILE%\AppData\Local\Google\Chrome\User Data\NativeMessagingHosts\`
   - 包含: `com.annotateflow.assistant.json` 和 `native_host.py`

## 🚀 使用步骤

### 1. 重新加载Chrome扩展
1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 找到 "AnnotateFlow Assistant" 扩展
4. 点击 🔄 **重新加载** 按钮

### 2. 测试功能
1. 访问 [qlabel.tencent.com](https://qlabel.tencent.com)
2. 在图片页面按 **D** 键下载图片
3. 图片应该自动用默认应用打开（不是浏览器标签页）

### 3. 验证修复
打开测试页面验证所有功能：
```
file:///d:/app/imgerV2/test_native_host_final.html
```

## 🔍 故障排除

### 如果图片仍然在浏览器中打开
1. 确保已重新加载Chrome扩展
2. 检查扩展设置中的"自动打开图片"是否已启用
3. 重启Chrome浏览器

### 如果Native Host连接失败
1. 重新运行 `install_native_host.bat`
2. 确保Python已正确安装
3. 检查Windows注册表中的Native Host注册

### 检查注册表项
```
HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.annotateflow.assistant
```

## 📋 功能说明

### 快捷键
- **D**: 下载当前图片并自动打开
- **Space**: 跳过当前图片
- **S**: 提交标注
- **A**: 上传图片
- **F**: 查看历史

### 自动打开机制
1. **主要方法**: Native Host调用系统默认应用
2. **备用方法**: 如果Native Host失败，会显示通知
3. **用户控制**: 可在扩展弹窗中开启/关闭自动打开

## ✨ 技术细节

### Native Host工作原理
- Chrome扩展通过Native Messaging与Python脚本通信
- Python脚本调用系统API打开文件
- Windows: `os.startfile()`
- macOS: `open` 命令
- Linux: `xdg-open` 命令

### 文件结构
```
d:\app\imgerV2\
├── manifest.json                    # 扩展清单（已添加nativeMessaging权限）
├── background.js                    # 后台脚本
├── native_host.py                   # Native Host脚本
├── com.annotateflow.assistant.json  # Native Host配置
├── install_native_host.bat          # 安装脚本
└── test_native_host_final.html      # 测试页面
```

## 🎉 完成！

现在您可以：
1. 在qlabel平台上按D键下载图片
2. 图片会自动用默认应用（如Windows照片查看器）打开
3. 不再在浏览器标签页中打开图片

如有问题，请检查测试页面中的诊断信息。