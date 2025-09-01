# Native Host 安装说明

## 🎯 功能说明
Native Host 可以绕过Chrome的安全限制，实现真正的自动打开图片功能，无需用户交互。

## 📋 安装步骤

### 1. 确保Python环境
- 确保系统已安装Python 3.6+
- 可以通过命令行运行 `python --version` 检查

### 2. 安装Native Host

#### Windows用户：
1. 双击运行 `install_native_host.bat`
2. 按提示完成安装
3. 重启Chrome浏览器

#### 手动安装（所有系统）：
1. 将 `com.annotateflow.assistant.json` 复制到以下位置：
   - **Windows**: `%USERPROFILE%\AppData\Local\Google\Chrome\User Data\NativeMessagingHosts\`
   - **macOS**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
   - **Linux**: `~/.config/google-chrome/NativeMessagingHosts/`

2. 确保 `native_host.py` 和 `com.annotateflow.assistant.json` 在同一目录

3. 修改 `com.annotateflow.assistant.json` 中的路径为绝对路径：
   ```json
   {
     "name": "com.annotateflow.assistant",
     "description": "AnnotateFlow Assistant Native Host",
     "path": "C:\\完整路径\\到\\native_host.py",
     "type": "stdio",
     "allowed_origins": [
       "chrome-extension://__MSG_@@extension_id__/"
     ]
   }
   ```

### 3. 验证安装
1. 重新加载扩展
2. 下载一张图片
3. 图片应该会自动打开

## 🔧 故障排除

### 如果图片没有自动打开：
1. 检查Chrome控制台是否有错误信息
2. 确认Python脚本有执行权限
3. 验证路径配置是否正确
4. 检查系统默认图片查看器设置

### 常见错误：
- **"Native Host未连接"**: 检查清单文件路径和权限
- **"File not found"**: 检查下载路径和文件是否存在
- **"Permission denied"**: 确保Python脚本有执行权限

## 🚀 优势
- ✅ 真正的自动打开，无需用户交互
- ✅ 绕过Chrome安全限制
- ✅ 跨平台支持（Windows/macOS/Linux）
- ✅ 使用系统默认应用打开
- ✅ 稳定可靠

## 📝 注意事项
- 需要管理员权限安装
- 首次使用可能需要允许Python脚本运行
- 某些杀毒软件可能会拦截，需要添加信任
