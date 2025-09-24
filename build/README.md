# AnnotateFlow Assistant 构建和分发工具

这个工具用于构建和打包AnnotateFlow Assistant Chrome扩展及其Native Host组件。

## 功能特性

1. **JavaScript混淆** - 使用javascript-obfuscator混淆content.js, background.js等核心文件
2. **Python代码保护** - 对Native Host Python代码进行基本保护
3. **一键安装** - 自动生成跨平台安装脚本
4. **自动Python安装** - 在Windows和macOS上自动检测并安装Python环境
5. **依赖管理** - 自动处理Python依赖安装

## 构建步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

或者清理后构建：

```bash
npm run dist
```

### 3. 分发包位置

构建完成的分发包位于：`build/dist/AnnotateFlow-Assistant-vX.X.X/`

## 安装说明

### Windows

1. 双击运行 `install.bat`
2. 脚本会自动检测并安装Python（如果缺失）
3. 按照提示在Chrome中加载扩展

### macOS

1. 在终端中运行 `./install.sh`
2. 脚本会自动安装Homebrew和Python（如果缺失）
3. 按照提示在Chrome中加载扩展

## 配置文件

- `build/config.json` - 主要配置文件
- `build/javascript-obfuscator-config.json` - JavaScript混淆配置

## 技术架构

```
build/
├── build.js              # 主构建脚本
├── config.json           # 构建配置
├── javascript-obfuscator-config.json  # 混淆配置
└── dist/                 # 构建输出目录
    └── AnnotateFlow-Assistant-vX.X.X/
        ├── extension/    # Chrome扩展文件
        ├── native-host/  # Native Host文件
        ├── install.bat   # Windows安装脚本
        ├── install.sh    # macOS安装脚本
        └── README.txt    # 安装说明
```

## 注意事项

1. 构建过程会修改原文件，请确保已提交所有更改
2. JavaScript混淆会改变变量名，但保持功能不变
3. Python代码保护是基础级别的，主要用于防止简单查看
4. 安装脚本需要管理员权限来安装Python（Windows）