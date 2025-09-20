 `content.js` 重构计划书

**目标:** 将 `content.js` 中的剩余逻辑，按照功能职责迁移至 `src/modules/` 和 `src/utils/` 目录下，使 `content.js` 最终成为一个清晰的、负责模块初始化的入口文件。

---

**当前文件结构:**

```
src/
├── config/
│   └── constants.js
├── modules/
│   ├── DownloadManager.js
│   ├── KeyboardManager.js
│   ├── RunningHubManager.js
│   └── StateManager.js
└── utils/
    └── Logger.js
```

---

**渐进式迁移原则 (Gradual Migration Principles):**

我们将采用逐个功能迁移的策略，确保每次改动的范围可控，便于测试和验证。

对于每一个功能的迁移（例如一个热键功能），都遵循以下流程：

1.  **创建 (Create)**: 为该功能创建一个新的、独立的模块文件。
2.  **迁移 (Migrate)**: 将 `content.js` 中与该功能相关的所有代码（包括UI创建、事件处理、业务逻辑等）完整地移动到新模块中，并进行封装。
3.  **删除 (Delete)**: **确认迁移成功后，必须从 `content.js` 中彻底删除被迁移的旧代码。**
4.  **替换 (Replace)**: 在 `content.js` 中，导入新创建的模块，并在原来的调用位置替换为对新模块接口的调用。
5.  **测试 (Test)**: 对迁移后的功能进行完整测试，确保其行为与原来一致。

---

**重构步骤:**

### 第一阶段：UI 相关逻辑拆分

目前 `content.js` 中包含了大量直接操作 DOM 以创建和管理界面的代码。我们将把这些功能拆分到独立的 UI 模块中。

1.  **创建 `ImageHelper.js`**:
    *   **职责**: 管理页面上图片的交互，如高亮、选择、尺寸提示等。
    *   **操作**: 新建 `src/modules/ui/ImageHelper.js` 文件。将 `content.js` 中与图片边框、高亮、鼠标悬浮提示相关的函数（例如处理 `mouseover` 和 `mouseout` 的逻辑）迁移至此。

2.  **创建 `ComparisonUIManager.js`**:
    *   **职责**: 负责图片对比弹窗的创建、显示、隐藏和交互。
    *   **操作**: 新建 `src/modules/ui/ComparisonUIManager.js` 文件。将 `content.js` 中用于创建对比弹窗（`comparison-modal`）的全部代码迁移至此。

3.  **创建 `NotificationManager.js`**:
    *   **职责**: 统一管理页面右下角的所有通知提示。
    *   **操作**: 新建 `src/modules/ui/NotificationManager.js` 文件。将 `content.js` 中显示成功、失败或信息提示的函数迁移至此。

### 第二阶段：核心业务逻辑拆分

这部分是插件的核心功能，需要被清晰地分离出来。

1.  **创建 `OriginalImageDetector.js`**:
    *   **职责**: 封装核心的“原图”检测和锁定逻辑。这是最复杂的部分之一。
    *   **操作**: 新建 `src/modules/core/OriginalImageDetector.js` 文件。将 `content.js` 中所有用于分析和确定哪个是“原图”的函数和逻辑迁移至此。

2.  **创建 `UploadHandler.js`**:
    *   **职责**: 监听和处理用户通过拖拽或粘贴上传图片的行为。
    *   **操作**: 新建 `src/modules/core/UploadHandler.js` 文件。将 `content.js` 中与 `paste` 和 `drop` 事件相关的监听器和处理函数迁移至此。

### 第三阶段：完善工具库

1.  **创建 `utils.js`**:
    *   **职责**: 存放不属于任何特定模块的通用辅助函数。
    *   **操作**: 新建 `src/utils/utils.js` 文件。将 `content.js` 中剩余的通用工具函数（如 `findButtonByText`, `sleep`, `isElementInViewport` 等）迁移至此。

### 第四阶段：整合与重构 `content.js`

完成以上步骤后，`content.js` 的代码量将大大减少。最后一步是将其改造为入口文件。

1.  **重构 `content.js`**:
    *   **职责**:
        *   导入所有需要的模块。
        *   初始化 `StateManager`，并将 state 实例在必要时传递给其他模块。
        *   实例化并初始化所有管理器（`KeyboardManager`, `ImageHelper`, `UploadHandler` 等）。
        *   将事件与处理程序绑定（例如，`KeyboardManager` 触发的事件应由相应的模块处理）。
    *   **结果**: `content.js` 将不再包含具体的业务逻辑实现，只负责组织和调用。

---

**重构后的建议目录结构:**

```
src/
├── config/
│   └── constants.js
├── modules/
│   ├── core/
│   │   ├── OriginalImageDetector.js
│   │   └── UploadHandler.js
│   ├── ui/
│   │   ├── ComparisonUIManager.js
│   │   ├── ImageHelper.js
│   │   └── NotificationManager.js
│   ├── DownloadManager.js
│   ├── KeyboardManager.js
│   ├── RunningHubManager.js
│   └── StateManager.js
├── utils/
│   ├── Logger.js
│   └── utils.js
└── content.js