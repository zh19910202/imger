# Content.js 模块架构设计

## 🏗️ 架构概览

本文档详细描述了重构后的模块架构设计，包括各模块的职责、接口和依赖关系。

### 架构原则
- **单一职责**: 每个模块只负责一个特定的功能域
- **低耦合**: 模块间通过明确的接口进行通信
- **高内聚**: 相关功能集中在同一模块内
- **可扩展**: 便于添加新功能和修改现有功能
- **可测试**: 每个模块都可以独立测试

### 整体架构图
```
┌─────────────────────────────────────────────────────────────┐
│                        content.js                          │
│                      (主入口文件)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│                    core/ (核心层)                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │StateManager │ │EventManager │ │    ConfigManager        │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│                  功能层 (Feature Layer)                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│ │   image/    │ │    ui/      │ │       network/          │ │
│ │             │ │             │ │                         │ │
│ └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│                   utils/ (工具层)                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   Logger    │ │  DOMUtils   │ │      FileUtils          │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📁 模块详细设计

### 🎯 core/ - 核心模块

#### StateManager.js - 状态管理器
**职责**: 统一管理应用的全局状态

```javascript
export class StateManager {
    // 核心方法
    get(key)                    // 获取状态值
    set(key, value)             // 设置状态值
    setState(updates)           // 批量设置状态
    subscribe(key, callback)    // 订阅状态变化
    
    // 辅助方法
    getSnapshot()              // 获取状态快照
    reset(key)                 // 重置特定状态
    resetAll()                 // 重置所有状态
    checkPageChange()          // 检查页面变化
    destroy()                  // 销毁状态管理器
}
```

**状态结构**:
```javascript
{
    // 图片相关状态
    lastHoveredImage: null,
    selectedImage: null,
    originalImage: null,
    uploadedImage: null,
    originalImageLocked: false,
    
    // 功能开关状态
    soundEnabled: true,
    autoCompareEnabled: true,
    debugMode: false,
    
    // UI状态
    dimensionTooltip: null,
    comparisonModal: null,
    isComparisonModalOpen: false,
    
    // F1自动无效化状态
    f1AutoInvalidating: false,
    f1IntervalMs: 800,
    f1MaxRuns: 0,
    f1TimerId: null,
    f1RunCount: 0,
    
    // 页面和缓存状态
    currentPageUrl: '',
    cosImageCache: new Map(),
    cachedRunningHubResults: null
}
```

#### EventManager.js - 事件管理器
**职责**: 统一管理键盘事件和用户交互

```javascript
export class EventManager {
    constructor(dependencies)   // 依赖注入
    
    // 核心方法
    initialize()               // 初始化事件监听
    handleKeydown(event)       // 键盘事件处理
    destroy()                  // 销毁事件监听器
    
    // 具体按键处理方法
    handleDownloadImage(event)     // D键处理
    handleSkipButton(event)        // 空格键处理
    handleSubmitContinue(event)    // S键处理
    handleUploadImage(event)       // A键处理
    handleViewHistory(event)       // F键处理
    handleSmartCompare(event)      // W键处理
    handleDebugMode(event)         // Z键处理
    // ... 其他按键处理方法
}
```

**依赖关系**:
```javascript
{
    stateManager: StateManager,
    imageDownloader: ImageDownloader,
    imageUploader: ImageUploader,
    imageComparison: ImageComparison,
    modalManager: ModalManager,
    notificationManager: NotificationManager,
    debugPanel: DebugPanel,
    runningHubAPI: RunningHubAPI
}
```

#### ConfigManager.js - 配置管理器
**职责**: 管理应用配置的加载、保存和同步

```javascript
export class ConfigManager {
    constructor(stateManager)
    
    // 初始化
    initialize()               // 初始化配置管理器
    
    // 配置加载
    loadSoundSettings()        // 加载音效设置
    loadF1Settings()           // 加载F1设置
    loadAutoCompareSettings()  // 加载自动对比设置
    loadDebugSettings()        // 加载调试设置
    
    // 配置保存
    saveSoundSettings(enabled)
    saveF1Settings(intervalMs, maxRuns)
    saveAutoCompareSettings(enabled)
    saveDebugSettings(enabled)
    
    // 工具方法
    getAllSettings()           // 获取所有配置
    resetToDefaults()          // 重置为默认值
    setupStorageListener()     // 设置存储监听器
}
```

### 🖼️ image/ - 图片处理模块

#### ImageDetector.js - 图片检测器
**职责**: 检测和识别页面中的图片

```javascript
export class ImageDetector {
    constructor(stateManager)
    
    // 核心检测方法
    recordOriginalImages()     // 记录原图
    detectOriginalImage()      // 检测原图
    detectUploadedImage()      // 检测上传图片
    
    // 图片分析方法
    isOriginalImage(imageUrl)  // 判断是否为原图
    isCOSImage(imageUrl)       // 判断是否为COS图片
    isJPEGFormat(imageUrl)     // 判断是否为JPEG格式
    
    // 监听方法
    observeImageChanges()      // 监听图片变化
    addImageEventListeners()   // 添加图片事件监听
    
    // 工具方法
    getImageDimensions(imageUrl)  // 获取图片尺寸
    checkImageAccessibility(imageUrl)  // 检查图片可访问性
}
```

#### ImageDownloader.js - 图片下载器
**职责**: 处理图片下载功能

```javascript
export class ImageDownloader {
    constructor(stateManager, notificationManager)
    
    // 核心下载方法
    downloadImage(imageUrl, autoOpen = false)  // 下载图片
    downloadViaChrome(imageUrl, fileName, autoOpen)  // Chrome API下载
    downloadViaFetch(imageUrl, fileName)       // Fetch下载
    
    // 文件处理方法
    generateFileName(imageUrl, prefix = '')    // 生成文件名
    validateImageUrl(imageUrl)                 // 验证图片URL
    
    // 下载策略方法
    selectDownloadStrategy(imageUrl)           // 选择下载策略
    handleDownloadError(error, imageUrl)       // 处理下载错误
}
```

#### ImageUploader.js - 图片上传监听器
**职责**: 监听和处理图片上传

```javascript
export class ImageUploader {
    constructor(stateManager, imageDetector)
    
    // 初始化方法
    initialize()               // 初始化上传监听
    
    // 监听方法
    observeFileInputs()        // 监听文件输入
    observeNetworkUploads()    // 监听网络上传
    addAlternativeUploadDetection()  // 添加替代检测方法
    
    // 处理方法
    handleFileInputChange(event)     // 处理文件输入变化
    handleNetworkUpload(request)     // 处理网络上传
    processUploadedImage(imageData)  // 处理上传的图片
    
    // 验证方法
    validateUploadedFile(file)       // 验证上传文件
    isImageFile(file)               // 判断是否为图片文件
}
```

#### ImageComparison.js - 图片对比器
**职责**: 处理图片对比功能

```javascript
export class ImageComparison {
    constructor(stateManager, modalManager, imageDetector)
    
    // 对比方法
    showImageComparison()      // 显示图片对比
    canPerformComparison()     // 检查是否可以对比
    performComparison(originalUrl, uploadedUrl)  // 执行对比
    
    // UI方法
    createComparisonModal()    // 创建对比模态框
    updateComparisonUI()       // 更新对比界面
    closeComparison()          // 关闭对比
    
    // 工具方法
    preloadImages(urls)        // 预加载图片
    calculateImageSimilarity(img1, img2)  // 计算图片相似度
    generateComparisonReport() // 生成对比报告
}
```

### 🎨 ui/ - 用户界面模块

#### NotificationManager.js - 通知管理器
**职责**: 管理通知显示和音效播放

```javascript
export class NotificationManager {
    constructor(stateManager)
    
    // 通知方法
    showNotification(message, duration = 3000)  // 显示通知
    hideNotification()                          // 隐藏通知
    showSuccessNotification(message)            // 显示成功通知
    showErrorNotification(message)              // 显示错误通知
    showWarningNotification(message)            // 显示警告通知
    
    // 音效方法
    initializeAudio()          // 初始化音效
    playNotificationSound()    // 播放通知音效
    setAudioEnabled(enabled)   // 设置音效开关
    
    // 队列管理
    addToQueue(notification)   // 添加到通知队列
    processQueue()             // 处理通知队列
    clearQueue()               // 清空通知队列
}
```

#### ModalManager.js - 模态框管理器
**职责**: 统一管理各种模态框

```javascript
export class ModalManager {
    constructor(stateManager)
    
    // 通用模态框方法
    createModal(config)        // 创建模态框
    showModal(modal)           // 显示模态框
    hideModal(modal)           // 隐藏模态框
    destroyModal(modal)        // 销毁模态框
    
    // 特定模态框方法
    createDimensionCheckModal(imageData)  // 创建尺寸检查模态框
    createComparisonModal(images)         // 创建对比模态框
    createConfirmModal(message, callback) // 创建确认模态框
    
    // 管理方法
    checkAndCloseModalIfOpen(keyName)     // 检查并关闭模态框
    ensureModalClosed()                   // 确保模态框关闭
    getActiveModals()                     // 获取活动模态框
    closeAllModals()                      // 关闭所有模态框
}
```

#### DebugPanel.js - 调试面板
**职责**: 管理调试面板的显示和功能

```javascript
export class DebugPanel {
    constructor(stateManager, logger)
    
    // 面板管理
    initialize()               // 初始化调试面板
    show()                     // 显示面板
    hide()                     // 隐藏面板
    toggle()                   // 切换显示状态
    destroy()                  // 销毁面板
    
    // 内容更新
    updateStateInfo()          // 更新状态信息
    updateImageInfo()          // 更新图片信息
    updateComparisonInfo()     // 更新对比信息
    updateLogDisplay()         // 更新日志显示
    
    // 交互功能
    clearLogs()                // 清空日志
    exportLogs()               // 导出日志
    exportState()              // 导出状态
    resetState()               // 重置状态
}
```

#### TooltipManager.js - 提示框管理器
**职责**: 管理各种提示框的显示

```javascript
export class TooltipManager {
    constructor()
    
    // 提示框方法
    showTooltip(element, content, options = {})  // 显示提示框
    hideTooltip(element)                         // 隐藏提示框
    updateTooltipContent(element, content)       // 更新提示框内容
    
    // 特定提示框
    showDimensionTooltip(imageElement, dimensions)  // 显示尺寸提示
    showImageInfoTooltip(imageElement, info)        // 显示图片信息提示
    
    // 管理方法
    hideAllTooltips()          // 隐藏所有提示框
    cleanupTooltips()          // 清理提示框
}
```

### 🌐 network/ - 网络通信模块

#### NetworkMonitor.js - 网络监听器
**职责**: 监听和拦截网络请求

```javascript
export class NetworkMonitor {
    constructor(stateManager)
    
    // 初始化方法
    initialize()               // 初始化网络监听
    
    // 监听方法
    interceptImageRequests()   // 拦截图片请求
    monitorUploadRequests()    // 监听上传请求
    trackNetworkActivity()     // 跟踪网络活动
    
    // 处理方法
    handleImageRequest(request)    // 处理图片请求
    handleUploadRequest(request)   // 处理上传请求
    cacheImageRequest(request)     // 缓存图片请求
    
    // 分析方法
    analyzeRequestPattern(requests)  // 分析请求模式
    detectImageUpload(request)       // 检测图片上传
    extractImageMetadata(response)   // 提取图片元数据
}
```

#### RunningHubAPI.js - RunningHub接口
**职责**: 处理与RunningHub的API通信

```javascript
export class RunningHubAPI {
    constructor(stateManager, configManager)
    
    // 配置方法
    loadConfig()               // 加载配置
    setApiEndpoint(endpoint)   // 设置API端点
    setApiKey(key)             // 设置API密钥
    
    // API调用方法
    callWorkflow(params)       // 调用工作流
    uploadImage(imageData)     // 上传图片
    getTaskStatus(taskId)      // 获取任务状态
    getTaskResult(taskId)      // 获取任务结果
    
    // 缓存方法
    getCachedResult(taskId)    // 获取缓存结果
    setCachedResult(taskId, result)  // 设置缓存结果
    clearCache()               // 清空缓存
    
    // 错误处理
    handleApiError(error)      // 处理API错误
    retryRequest(request, maxRetries = 3)  // 重试请求
}
```

### 🛠️ utils/ - 工具模块

#### Logger.js - 日志工具
**职责**: 提供调试日志功能

```javascript
export class Logger {
    // 静态属性
    static debugMode = false
    static debugLogs = []
    static debugPanel = null
    
    // 日志方法
    static debugLog(message, data = null)    // 记录调试日志
    static info(message, data = null)        // 记录信息日志
    static warn(message, data = null)        // 记录警告日志
    static error(message, data = null)       // 记录错误日志
    
    // 模式控制
    static toggleDebugMode()                 // 切换调试模式
    static setDebugMode(enabled)             // 设置调试模式
    
    // 日志管理
    static clearLogs()                       // 清空日志
    static exportLogs()                      // 导出日志
    static getLogs(filter = null)            // 获取日志
    
    // 面板管理
    static initializeDebugPanel()            // 初始化调试面板
    static updateDebugPanel()                // 更新调试面板
}
```

#### DOMUtils.js - DOM工具
**职责**: 提供DOM操作的工具函数

```javascript
export class DOMUtils {
    // 查询方法
    static querySelector(selector, context = document)
    static querySelectorAll(selector, context = document)
    static waitForElement(selector, timeout = 5000)
    
    // 创建方法
    static createElement(tag, props = {}, children = [])
    static createElementFromHTML(html)
    
    // 操作方法
    static isElementVisible(element)
    static scrollToElement(element, options = {})
    static getElementPosition(element)
    static isClickInsideElement(event, element)
    
    // 样式方法
    static setStyles(element, styles)
    static addClass(element, className)
    static removeClass(element, className)
    static toggleClass(element, className)
    
    // 事件方法
    static addEventListeners(element, events)
    static removeEventListeners(element, events)
    static delegateEvent(container, selector, event, handler)
}
```

#### FileUtils.js - 文件工具
**职责**: 提供文件处理的工具函数

```javascript
export class FileUtils {
    // 文件名处理
    static generateFileName(imageUrl, prefix = '')
    static sanitizeFileName(fileName)
    static getFileExtension(fileName)
    static changeFileExtension(fileName, newExt)
    
    // 图片处理
    static getImageDimensions(imageUrl)
    static getImageFormat(imageUrl)
    static isImageFile(file)
    static isCOSImage(imageUrl)
    static isOriginalImageFormat(imageUrl)
    
    // 文件操作
    static formatFileSize(bytes)
    static isFileTypeAccepted(file, acceptedTypes)
    static readFileAsDataURL(file)
    static downloadBlob(blob, fileName)
    
    // URL处理
    static isValidURL(url)
    static extractDomainFromURL(url)
    static addTimestampToURL(url)
}
```

## 🔗 模块间通信

### 依赖注入模式
```javascript
// 主入口文件中的依赖注入
class AnnotateFlowAssistant {
    constructor() {
        // 创建核心模块
        this.stateManager = new StateManager();
        this.configManager = new ConfigManager(this.stateManager);
        
        // 创建UI模块
        this.notificationManager = new NotificationManager(this.stateManager);
        this.modalManager = new ModalManager(this.stateManager);
        this.debugPanel = new DebugPanel(this.stateManager, Logger);
        
        // 创建图片处理模块
        this.imageDetector = new ImageDetector(this.stateManager);
        this.imageDownloader = new ImageDownloader(this.stateManager, this.notificationManager);
        this.imageUploader = new ImageUploader(this.stateManager, this.imageDetector);
        this.imageComparison = new ImageComparison(this.stateManager, this.modalManager, this.imageDetector);
        
        // 创建网络模块
        this.networkMonitor = new NetworkMonitor(this.stateManager);
        this.runningHubAPI = new RunningHubAPI(this.stateManager, this.configManager);
        
        // 创建事件管理器（依赖最多的模块）
        this.eventManager = new EventManager({
            stateManager: this.stateManager,
            imageDownloader: this.imageDownloader,
            imageUploader: this.imageUploader,
            imageComparison: this.imageComparison,
            modalManager: this.modalManager,
            notificationManager: this.notificationManager,
            debugPanel: this.debugPanel,
            runningHubAPI: this.runningHubAPI
        });
    }
}
```

### 事件驱动通信
```javascript
// 使用状态管理器的订阅机制进行模块间通信
class ImageDetector {
    constructor(stateManager) {
        this.stateManager = stateManager;
        
        // 订阅页面变化事件
        this.stateManager.subscribe('pageChanged', (newUrl, oldUrl) => {
            this.handlePageChange(newUrl, oldUrl);
        });
    }
    
    detectOriginalImage() {
        // 检测到原图后，更新状态
        this.stateManager.set('originalImage', imageData);
        // 其他模块会自动收到状态变化通知
    }
}

class ImageComparison {
    constructor(stateManager, modalManager, imageDetector) {
        this.stateManager = stateManager;
        
        // 订阅原图和上传图片的状态变化
        this.stateManager.subscribe('originalImage', () => {
            this.checkComparisonConditions();
        });
        
        this.stateManager.subscribe('uploadedImage', () => {
            this.checkComparisonConditions();
        });
    }
}
```

## 📊 接口规范

### 模块接口标准
```javascript
// 所有模块都应该实现的基础接口
interface ModuleInterface {
    constructor(dependencies)  // 构造函数，接收依赖
    initialize?()             // 可选的初始化方法
    destroy?()                // 可选的销毁方法
}

// 状态相关模块接口
interface StateAwareModule extends ModuleInterface {
    stateManager: StateManager  // 状态管理器引用
}

// UI相关模块接口
interface UIModule extends StateAwareModule {
    show?()                   // 显示UI
    hide?()                   // 隐藏UI
    update?()                 // 更新UI
}
```

### 错误处理规范
```javascript
// 统一的错误处理接口
class ModuleError extends Error {
    constructor(message, module, code = null, details = null) {
        super(message);
        this.name = 'ModuleError';
        this.module = module;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

// 模块中的错误处理示例
class ImageDownloader {
    async downloadImage(imageUrl) {
        try {
            // 下载逻辑
        } catch (error) {
            const moduleError = new ModuleError(
                '图片下载失败',
                'ImageDownloader',
                'DOWNLOAD_FAILED',
                { imageUrl, originalError: error.message }
            );
            
            Logger.error('下载错误', moduleError);
            this.notificationManager.showErrorNotification(moduleError.message);
            throw moduleError;
        }
    }
}
```

## 🧪 测试策略

### 单元测试
```javascript
// 每个模块都应该有对应的测试文件
// tests/core/StateManager.test.js
import { StateManager } from '../../modules/core/StateManager.js';

describe('StateManager', () => {
    let stateManager;
    
    beforeEach(() => {
        stateManager = new StateManager();
    });
    
    afterEach(() => {
        stateManager.destroy();
    });
    
    test('should set and get state correctly', () => {
        stateManager.set('testKey', 'testValue');
        expect(stateManager.get('testKey')).toBe('testValue');
    });
    
    test('should notify listeners on state change', () => {
        const listener = jest.fn();
        stateManager.subscribe('testKey', listener);
        stateManager.set('testKey', 'newValue');
        expect(listener).toHaveBeenCalledWith('newValue', undefined, 'testKey');
    });
});
```

### 集成测试
```javascript
// tests/integration/ImageWorkflow.test.js
import { AnnotateFlowAssistant } from '../../content.js';

describe('Image Workflow Integration', () => {
    let app;
    
    beforeEach(() => {
        app = new AnnotateFlowAssistant();
        app.initialize();
    });
    
    test('should detect and download image correctly', async () => {
        // 模拟图片检测
        const mockImage = { src: 'https://example.com/image.jpg' };
        app.imageDetector.recordOriginalImages();
        
        // 模拟下载操作
        const downloadSpy = jest.spyOn(app.imageDownloader, 'downloadImage');
        app.eventManager.handleDownloadImage({ key: 'd' });
        
        expect(downloadSpy).toHaveBeenCalledWith(mockImage.src);
    });
});
```

## 📈 性能优化

### 懒加载策略
```javascript
// 按需加载模块，减少初始加载时间
class AnnotateFlowAssistant {
    constructor() {
        // 只初始化核心模块
        this.stateManager = new StateManager();
        this.eventManager = new EventManager(this.stateManager);
        
        // 其他模块延迟初始化
        this._imageDownloader = null;
        this._imageComparison = null;
    }
    
    get imageDownloader() {
        if (!this._imageDownloader) {
            this._imageDownloader = new ImageDownloader(
                this.stateManager,
                this.notificationManager
            );
        }
        return this._imageDownloader;
    }
}
```

### 内存管理
```javascript
// 每个模块都应该实现销毁方法
class ImageDetector {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.observers = [];
        this.eventListeners = [];
    }
    
    destroy() {
        // 清理观察者
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        
        // 清理事件监听器
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        // 清理状态订阅
        this.stateManager = null;
    }
}
```

## 🔄 扩展指南

### 添加新功能模块
1. **创建模块文件**: 在相应的目录下创建新的模块文件
2. **实现标准接口**: 确保模块实现基础接口
3. **注册依赖**: 在主入口文件中注册模块依赖
4. **添加测试**: 为新模块编写单元测试
5. **更新文档**: 更新架构文档和API文档

### 修改现有模块
1. **保持接口兼容**: 修改时保持公共接口的兼容性
2. **更新测试**: 修改相关的测试用例
3. **版本控制**: 使用语义化版本控制
4. **文档更新**: 及时更新相关文档

---

**文档版本**: v1.0  
**创建日期**: 2025-09-18  
**最后更新**: 2025-09-18  
**负责人**: CodeBuddy