# 📁 项目目录结构

项目已经重新组织，以提高可维护性和清晰度。

## 🏗️ 目录布局

```
auxis/
│
├── 📄 根目录文件（配置和启动）
│   ├── manifest.json              # Chrome扩展清单（主文件）
│   ├── package.json               # NPM配置
│   ├── package-lock.json
│   ├── README.md
│   ├── install_native_host.sh     # 原生主机安装脚本
│   ├── install_native_host.bat
│   ├── fix_native_host_windows.bat
│   ├── native_host_launcher.sh
│   ├── native_host_launcher.bat
│   └── test_runninghub.sh
│
├── 📦 src/                        # 源代码
│   ├── background.js              # 后台Service Worker
│   ├── content.js                 # 主要内容脚本
│   ├── popup.js                   # 弹窗脚本
│   ├── popup.html                 # 弹窗界面
│   ├── appen-data-collector.js    # Appen数据收集
│   ├── cardkey-validator.js       # 卡号验证器
│   └── native_host.py             # 原生消息主机（Python）
│
├── ⚙️ config/                     # 配置文件
│   ├── platform-config.json       # 平台配置
│   ├── runninghub-config.json     # RunningHub AI配置
│   ├── t8-config.json             # T8配置
│   └── com.annotateflow.assistant.json  # 原生消息清单
│
├── 🎨 assets/                     # 资源文件
│   └── icon.png                   # 扩展图标
│
├── 📚 docs/                       # 文档
│   ├── README.md                  # 项目说明
│   ├── CLAUDE.md                  # AI开发指南
│   ├── task.md                    # 任务列表
│   ├── api/                       # API文档
│   │   ├── api-documentation.md
│   │   └── task-api.md
│   └── guides/                    # 指南
│       ├── native-host-setup.md
│       ├── distribution.md
│       ├── distribution-guide.md
│       ├── auto-upload-implementation.md
│       ├── auto-upload-workflow.md
│       ├── external-app-integration.md
│       └── external-app-example.md
│
├── 🧪 tests/                      # 测试文件
│   ├── TEST_GUIDELINES.md         # 测试规范
│   ├── unit/                      # 单元测试
│   ├── integration/               # 集成测试
│   │   ├── simulate_external_app_js.js
│   │   └── auto-upload.test.js
│   ├── scripts/                   # 测试脚本
│   │   ├── test_native_messaging.py
│   │   └── test_ps_integration.py
│   └── fixtures/                  # 测试数据
│       └── test-cardkey.html
│
├── 🔨 build/                      # 构建相关
│   ├── templates/                 # 构建模板
│   └── dist/                      # 分发包（生成）
│
├── 📋 openspec/                   # OpenSpec规范
│   ├── project.md
│   ├── AGENTS.md
│   ├── specs/                     # 功能规范
│   └── changes/                   # 更改提案
│       └── archive/               # 已完成的更改
│
├── 🔐 .git/                       # Git仓库
└── 🔑 .claude/                    # Claude Code配置

```

## 📌 关键路径映射

### Chrome扩展配置
- manifest.json中的路径是相对于扩展根目录的
- 主要文件路径：
  ```json
  {
    "background": "src/background.js",
    "default_popup": "src/popup.html",
    "default_icon": "assets/icon.png",
    "content_scripts": ["src/cardkey-validator.js", "src/content.js", "src/appen-data-collector.js"],
    "web_accessible_resources": ["config/runninghub-config.json", ...]
  }
  ```

### 代码中的配置文件引用
- 配置文件位于 `config/` 目录
- Chrome扩展访问：使用相对于扩展根目录的路径
- Node.js脚本访问：需要调整路径为 `./config/...`

### 文档参考
- 项目文档：`docs/README.md`
- 开发指南：`docs/CLAUDE.md`
- API文档：`docs/api/`
- 各种指南：`docs/guides/`

### 测试
- 所有测试脚本位于 `tests/` 目录
- 不要在根目录或src中放置测试文件

## 🔄 迁移影响

### 已更新的文件
✅ manifest.json - 更新了所有文件路径
✅ 代码中的相对路径 - 如需引用config文件

### 需要验证的项目
- [ ] Chrome扩展在开发者模式下是否正常加载
- [ ] 所有内容脚本是否正常运行
- [ ] 配置文件是否能被正确访问
- [ ] RunningHub集成是否正常工作

## 📝 约定

- **src/**: 所有JavaScript和HTML源文件
- **config/**: JSON配置文件（不包括manifest.json）
- **assets/**: 图片、字体等静态资源
- **docs/**: 所有文档（Markdown格式）
- **tests/**: 所有测试文件，按类型分类
- **根目录**: 仅保留必要的配置和启动文件

## 🔗 相关文件

- [tests/TEST_GUIDELINES.md](tests/TEST_GUIDELINES.md) - 测试文件管理规范
- [docs/CLAUDE.md](docs/CLAUDE.md) - 项目开发指南
- [manifest.json](manifest.json) - Chrome扩展配置

---

**最后更新**: 2024年10月19日
**状态**: 目录结构重组完成 ✅
