# Content.js 重构 API 文档

## 📚 API 概览

本文档详细描述了重构后各模块的公共API接口，包括方法签名、参数说明、返回值和使用示例。

## 🎯 core/ - 核心模块 API

### StateManager API

#### 构造函数
```javascript
new StateManager()
```
创建一个新的状态管理器实例。

#### 核心方法

##### `get(key: string): any`
获取指定键的状态值。

**参数:**
- `key` - 状态键名

**返回值:**
- 状态值，如果键不存在则返回 `undefined`

**示例:**
```javascript
const stateManager = new StateManager();
const soundEnabled = stateManager.get('soundEnabled');
```

##### `set(key: string, value: any): StateManager`
设置指定键的状态值。

**参数:**
- `key` - 状态键名
- `value` - 要设置的值

**返回值:**
- 返回 StateManager 实例，支持链式调用

**示例:**
```javascript
stateManager.set('soundEnabled', true)
           .set('debugMode', false);
```

##### `setState(updates: Object): StateManager`
批量设置多个状态值。

**参数:**
- `updates` - 包含要更新的键值对的对象

**返回值:**
- 返回 StateManager 实例

**示例:**
```javascript
stateManager.setState({
    soundEnabled: true,
    debugMode: false,
    originalImage: imageData
});
```

##### `subscribe(key: string, callback: Function): Function`
订阅状态变化。

**参数:**
- `key` - 要监听的状态键名
- `callback` - 状态变化时的回调函数 `(newValue, oldValue, key) => void`

**返回值:**
- 取消订阅的函数

**示例:**
```javascript
const unsubscribe = stateManager.subscribe('soundEnabled', (newValue, oldValue) => {
    console.log(`Sound setting changed from ${oldValue} to ${newValue}`);
});

// 取消订阅
unsubscribe();
```

##### `getSnapshot(): Object`
获取当前状态的快照。

**返回值:**
- 包含所有状态的对象副本

**示例:**
```javascript
const snapshot = stateManager.getSnapshot();
console.log('Current state:', snapshot);
```

##### `reset(key: string): void`
重置指定状态为默认值。

**参数:**
- `key` - 要重置的状态键名

**示例:**
```javascript
stateManager.reset('originalImage');
```

##### `checkPageChange(): boolean`
检查页面是否发生变化。

**返回值:**
- 如果页面发生变化返回 `true`，否则返回 `false`

**示例:**
```javascript
if (stateManager.checkPageChange()) {
    console.log('Page changed, resetting image states');
}
```

### EventManager API

#### 构造函数
```javascript
new EventManager(dependencies: Object)
```

**参数:**
- `dependencies` - 依赖对象，包含所需的其他模块实例

**示例:**
```javascript
const eventManager = new EventManager({
    stateManager,
    imageDownloader,
    modalManager,
    notificationManager
});
```

#### 核心方法

##### `initialize(): void`
初始化事件监听器。

**示例:**
```javascript
eventManager.initialize();
```

##### `destroy(): void`
销毁事件监听器，清理资源。

**示例:**
```javascript
eventManager.destroy();
```

### ConfigManager API

#### 构造函数
```javascript
new ConfigManager(stateManager: StateManager)
```

#### 核心方法

##### `initialize(): Promise<void>`
初始化配置管理器，加载所有配置。

**示例:**
```javascript
await configManager.initialize();
```

##### `loadSoundSettings(): Promise<void>`
加载音效设置。

##### `saveSoundSettings(enabled: boolean): Promise<void>`
保存音效设置。

**参数:**
- `enabled` - 是否启用音效

**示例:**
```javascript
await configManager.saveSoundSettings(true);
```

##### `getAllSettings(): Object`
获取所有当前配置。

**返回值:**
- 包含所有配置的对象

**示例:**
```javascript
const settings = configManager.getAllSettings();
console.log('Current settings:', settings);
```

## 🖼️ image/ - 图片处理模块 API

### ImageDetector API

#### 构造函数
```javascript
new ImageDetector(stateManager: StateManager)
```

#### 核心方法

##### `recordOriginalImages(): void`
记录页面中的原图。

**示例:**
```javascript
imageDetector.recordOriginalImages();
```

##### `detectOriginalImage(): Object|null`
检测当前的原图。

**返回值:**
- 原图对象或 `null`

**示例:**
```javascript
const originalImage = imageDetector.detectOriginalImage();
if (originalImage) {
    console.log('Found original image:', originalImage.src);
}
```

##### `isOriginalImage(imageUrl: string): boolean`
判断指定URL是否为原图。

**参数:**
- `imageUrl` - 图片URL

**返回值:**
- 如果是原图返回 `true`

**示例:**
```javascript
if (imageDetector.isOriginalImage(imageUrl)) {
    console.log('This is an original image');
}
```

##### `getImageDimensions(imageUrl: string): Promise<Object>`
获取图片尺寸。

**参数:**
- `imageUrl` - 图片URL

**返回值:**
- Promise，解析为包含 `width`、`height` 和 `aspectRatio` 的对象

**示例:**
```javascript
try {
    const dimensions = await imageDetector.getImageDimensions(imageUrl);
    console.log(`Image size: ${dimensions.width}x${dimensions.height}`);
} catch (error) {
    console.error('Failed to get image dimensions:', error);
}
```

### ImageDownloader API

#### 构造函数
```javascript
new ImageDownloader(stateManager: StateManager, notificationManager: NotificationManager)
```

#### 核心方法

##### `downloadImage(imageUrl: string, autoOpen?: boolean): Promise<void>`
下载指定的图片。

**参数:**
- `imageUrl` - 图片URL
- `autoOpen` - 可选，是否自动打开下载的文件，默认为 `false`

**示例:**
```javascript
try {
    await imageDownloader.downloadImage('https://example.com/image.jpg', true);
    console.log('Download started');
} catch (error) {
    console.error('Download failed:', error);
}
```

##### `generateFileName(imageUrl: string, prefix?: string): string`
生成下载文件名。

**参数:**
- `imageUrl` - 图片URL
- `prefix` - 可选，文件名前缀

**返回值:**
- 生成的文件名

**示例:**
```javascript
const fileName = imageDownloader.generateFileName(imageUrl, 'original');
console.log('Generated filename:', fileName);
```

### ImageComparison API

#### 构造函数
```javascript
new ImageComparison(stateManager: StateManager, modalManager: ModalManager, imageDetector: ImageDetector)
```

#### 核心方法

##### `showImageComparison(): void`
显示图片对比界面。

**示例:**
```javascript
imageComparison.showImageComparison();
```

##### `canPerformComparison(): boolean`
检查是否可以进行图片对比。

**返回值:**
- 如果可以对比返回 `true`

**示例:**
```javascript
if (imageComparison.canPerformComparison()) {
    imageComparison.showImageComparison();
} else {
    console.log('Cannot perform comparison - missing images');
}
```

##### `closeComparison(): void`
关闭图片对比界面。

**示例:**
```javascript
imageComparison.closeComparison();
```

## 🎨 ui/ - 用户界面模块 API

### NotificationManager API

#### 构造函数
```javascript
new NotificationManager(stateManager: StateManager)
```

#### 核心方法

##### `showNotification(message: string, duration?: number): void`
显示通知消息。

**参数:**
- `message` - 通知消息内容
- `duration` - 可选，显示持续时间（毫秒），默认为 3000

**示例:**
```javascript
notificationManager.showNotification('操作成功完成', 2000);
```

##### `showSuccessNotification(message: string): void`
显示成功类型的通知。

**参数:**
- `message` - 通知消息内容

**示例:**
```javascript
notificationManager.showSuccessNotification('图片下载成功');
```

##### `showErrorNotification(message: string): void`
显示错误类型的通知。

**参数:**
- `message` - 错误消息内容

**示例:**
```javascript
notificationManager.showErrorNotification('下载失败，请重试');
```

##### `playNotificationSound(): void`
播放通知音效。

**示例:**
```javascript
if (stateManager.get('soundEnabled')) {
    notificationManager.playNotificationSound();
}
```

### ModalManager API

#### 构造函数
```javascript
new ModalManager(stateManager: StateManager)
```

#### 核心方法

##### `createModal(config: Object): HTMLElement`
创建模态框。

**参数:**
- `config` - 模态框配置对象

**配置选项:**
```javascript
{
    title: string,           // 标题
    content: string|Element, // 内容
    className: string,       // CSS类名
    closable: boolean,       // 是否可关闭
    width: string,           // 宽度
    height: string,          // 高度
    onClose: Function        // 关闭回调
}
```

**返回值:**
- 创建的模态框元素

**示例:**
```javascript
const modal = modalManager.createModal({
    title: '图片信息',
    content: '<p>图片尺寸: 1920x1080</p>',
    className: 'image-info-modal',
    closable: true,
    onClose: () => console.log('Modal closed')
});
```

##### `showModal(modal: HTMLElement): void`
显示模态框。

**参数:**
- `modal` - 要显示的模态框元素

**示例:**
```javascript
modalManager.showModal(modal);
```

##### `hideModal(modal: HTMLElement): void`
隐藏模态框。

**参数:**
- `modal` - 要隐藏的模态框元素

**示例:**
```javascript
modalManager.hideModal(modal);
```

##### `createDimensionCheckModal(imageData: Object): HTMLElement`
创建尺寸检查模态框。

**参数:**
- `imageData` - 图片数据对象，包含 `url`、`width`、`height` 等属性

**返回值:**
- 创建的尺寸检查模态框元素

**示例:**
```javascript
const modal = modalManager.createDimensionCheckModal({
    url: 'https://example.com/image.jpg',
    width: 1920,
    height: 1080
});
modalManager.showModal(modal);
```

##### `checkAndCloseModalIfOpen(keyName: string): boolean`
检查并关闭打开的模态框。

**参数:**
- `keyName` - 触发的按键名称

**返回值:**
- 如果关闭了模态框返回 `true`

**示例:**
```javascript
if (modalManager.checkAndCloseModalIfOpen('d')) {
    return; // 先关闭模态框，不执行其他操作
}
```

### DebugPanel API

#### 构造函数
```javascript
new DebugPanel(stateManager: StateManager, logger: Logger)
```

#### 核心方法

##### `initialize(): void`
初始化调试面板。

**示例:**
```javascript
debugPanel.initialize();
```

##### `show(): void`
显示调试面板。

**示例:**
```javascript
debugPanel.show();
```

##### `hide(): void`
隐藏调试面板。

**示例:**
```javascript
debugPanel.hide();
```

##### `toggle(): void`
切换调试面板的显示状态。

**示例:**
```javascript
debugPanel.toggle();
```

##### `updateStateInfo(): void`
更新状态信息显示。

**示例:**
```javascript
debugPanel.updateStateInfo();
```

##### `clearLogs(): void`
清空调试日志。

**示例:**
```javascript
debugPanel.clearLogs();
```

##### `exportLogs(): void`
导出调试日志到文件。

**示例:**
```javascript
debugPanel.exportLogs();
```

## 🌐 network/ - 网络通信模块 API

### RunningHubAPI API

#### 构造函数
```javascript
new RunningHubAPI(stateManager: StateManager, configManager: ConfigManager)
```

#### 核心方法

##### `loadConfig(): Promise<Object>`
加载RunningHub配置。

**返回值:**
- Promise，解析为配置对象

**示例:**
```javascript
try {
    const config = await runningHubAPI.loadConfig();
    console.log('Config loaded:', config);
} catch (error) {
    console.error('Failed to load config:', error);
}
```

##### `callWorkflow(params: Object): Promise<Object>`
调用RunningHub工作流。

**参数:**
- `params` - 工作流参数对象

**返回值:**
- Promise，解析为工作流结果

**示例:**
```javascript
try {
    const result = await runningHubAPI.callWorkflow({
        imageUrl: 'https://example.com/image.jpg',
        taskType: 'analysis'
    });
    console.log('Workflow result:', result);
} catch (error) {
    console.error('Workflow failed:', error);
}
```

##### `getCachedResult(taskId: string): Object|null`
获取缓存的任务结果。

**参数:**
- `taskId` - 任务ID

**返回值:**
- 缓存的结果对象或 `null`

**示例:**
```javascript
const cachedResult = runningHubAPI.getCachedResult('task-123');
if (cachedResult) {
    console.log('Using cached result:', cachedResult);
}
```

## 🛠️ utils/ - 工具模块 API

### Logger API

#### 静态方法

##### `Logger.debugLog(message: string, data?: any): void`
记录调试日志。

**参数:**
- `message` - 日志消息
- `data` - 可选，附加数据

**示例:**
```javascript
Logger.debugLog('Image detected', { url: imageUrl, size: fileSize });
```

##### `Logger.info(message: string, data?: any): void`
记录信息日志。

**示例:**
```javascript
Logger.info('Application initialized successfully');
```

##### `Logger.warn(message: string, data?: any): void`
记录警告日志。

**示例:**
```javascript
Logger.warn('Image format not optimal', { format: 'png', recommended: 'jpeg' });
```

##### `Logger.error(message: string, data?: any): void`
记录错误日志。

**示例:**
```javascript
Logger.error('Download failed', { error: error.message, url: imageUrl });
```

##### `Logger.toggleDebugMode(): void`
切换调试模式。

**示例:**
```javascript
Logger.toggleDebugMode();
```

##### `Logger.clearLogs(): void`
清空所有日志。

**示例:**
```javascript
Logger.clearLogs();
```

##### `Logger.exportLogs(): void`
导出日志到文件。

**示例:**
```javascript
Logger.exportLogs();
```

### DOMUtils API

#### 静态方法

##### `DOMUtils.querySelector(selector: string, context?: Element): Element|null`
安全的元素查询。

**参数:**
- `selector` - CSS选择器
- `context` - 可选，查询上下文，默认为 `document`

**返回值:**
- 找到的元素或 `null`

**示例:**
```javascript
const button = DOMUtils.querySelector('button[title="跳过"]');
if (button) {
    button.click();
}
```

##### `DOMUtils.createElement(tag: string, props?: Object, children?: Array): Element`
创建元素并设置属性。

**参数:**
- `tag` - 元素标签名
- `props` - 可选，属性对象
- `children` - 可选，子元素数组

**返回值:**
- 创建的元素

**示例:**
```javascript
const button = DOMUtils.createElement('button', {
    className: 'btn btn-primary',
    textContent: '下载',
    onclick: () => downloadImage()
});
```

##### `DOMUtils.waitForElement(selector: string, timeout?: number): Promise<Element>`
等待元素出现。

**参数:**
- `selector` - CSS选择器
- `timeout` - 可选，超时时间（毫秒），默认为 5000

**返回值:**
- Promise，解析为找到的元素

**示例:**
```javascript
try {
    const element = await DOMUtils.waitForElement('.dynamic-content', 10000);
    console.log('Element appeared:', element);
} catch (error) {
    console.error('Element did not appear within timeout');
}
```

##### `DOMUtils.isElementVisible(element: Element): boolean`
检查元素是否可见。

**参数:**
- `element` - 要检查的元素

**返回值:**
- 如果元素可见返回 `true`

**示例:**
```javascript
if (DOMUtils.isElementVisible(modal)) {
    console.log('Modal is currently visible');
}
```

### FileUtils API

#### 静态方法

##### `FileUtils.generateFileName(imageUrl: string, prefix?: string): string`
生成文件名。

**参数:**
- `imageUrl` - 图片URL
- `prefix` - 可选，文件名前缀

**返回值:**
- 生成的文件名

**示例:**
```javascript
const fileName = FileUtils.generateFileName(
    'https://example.com/image.jpg',
    'original'
);
// 返回: "original_image_20250918T150000.jpg"
```

##### `FileUtils.getImageDimensions(imageUrl: string): Promise<Object>`
获取图片尺寸。

**参数:**
- `imageUrl` - 图片URL

**返回值:**
- Promise，解析为包含尺寸信息的对象

**示例:**
```javascript
try {
    const dimensions = await FileUtils.getImageDimensions(imageUrl);
    console.log(`Size: ${dimensions.width}x${dimensions.height}`);
    console.log(`Aspect ratio: ${dimensions.aspectRatio}`);
} catch (error) {
    console.error('Failed to get dimensions:', error);
}
```

##### `FileUtils.isImageFile(file: File): boolean`
检查文件是否为图片。

**参数:**
- `file` - File对象

**返回值:**
- 如果是图片文件返回 `true`

**示例:**
```javascript
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (FileUtils.isImageFile(file)) {
        console.log('Selected file is an image');
    }
});
```

##### `FileUtils.formatFileSize(bytes: number): string`
格式化文件大小。

**参数:**
- `bytes` - 字节数

**返回值:**
- 格式化的文件大小字符串

**示例:**
```javascript
console.log(FileUtils.formatFileSize(1024));      // "1 KB"
console.log(FileUtils.formatFileSize(1048576));   // "1 MB"
console.log(FileUtils.formatFileSize(1073741824)); // "1 GB"
```

## 🔧 使用示例

### 完整的功能实现示例

#### 图片下载功能
```javascript
// 在EventManager中实现D键下载功能
class EventManager {
    async handleDownloadImage(event) {
        try {
            // 1. 检查并关闭模态框
            if (this.modalManager.checkAndCloseModalIfOpen('d')) {
                this.notificationManager.showNotification('模态框已关闭，请重新按D键下载', 1500);
                return;
            }
            
            // 2. 获取当前选中的图片
            const selectedImage = this.stateManager.get('selectedImage') || 
                                 this.stateManager.get('lastHoveredImage');
            
            if (!selectedImage) {
                this.notificationManager.showErrorNotification('未找到可下载的图片');
                return;
            }
            
            // 3. 执行下载
            await this.imageDownloader.downloadImage(selectedImage.src);
            
            // 4. 播放音效（如果启用）
            if (this.stateManager.get('soundEnabled')) {
                this.notificationManager.playNotificationSound();
            }
            
        } catch (error) {
            Logger.error('图片下载失败', error);
            this.notificationManager.showErrorNotification('下载失败: ' + error.message);
        }
    }
}
```

#### 图片对比功能
```javascript
// 在ImageComparison中实现智能对比功能
class ImageComparison {
    showImageComparison() {
        try {
            // 1. 检查对比条件
            if (!this.canPerformComparison()) {
                this.notificationManager.showWarningNotification('无法进行对比：缺少原图或上传图片');
                return;
            }
            
            // 2. 获取图片数据
            const originalImage = this.stateManager.get('originalImage');
            const uploadedImage = this.stateManager.get('uploadedImage');
            
            // 3. 创建对比模态框
            const modal = this.modalManager.createComparisonModal({
                original: originalImage,
                uploaded: uploadedImage
            });
            
            // 4. 显示模态框
            this.modalManager.showModal(modal);
            this.stateManager.set('isComparisonModalOpen', true);
            
            // 5. 记录调试信息
            Logger.debugLog('图片对比已开启', {
                originalUrl: originalImage.src,
                uploadedUrl: uploadedImage.src
            });
            
        } catch (error) {
            Logger.error('显示图片对比失败', error);
            this.notificationManager.showErrorNotification('对比功能出错: ' + error.message);
        }
    }
}
```

#### 状态管理示例
```javascript
// 在应用初始化时设置状态监听
class AnnotateFlowAssistant {
    initialize() {
        // 监听原图状态变化
        this.stateManager.subscribe('originalImage', (newImage, oldImage) => {
            if (newImage) {
                Logger.debugLog('原图已更新', { url: newImage.src });
                this.notificationManager.showSuccessNotification('✅ 原图检测成功');
                
                // 如果同时有上传图片，触发自动对比
                if (this.stateManager.get('uploadedImage') && 
                    this.stateManager.get('autoCompareEnabled')) {
                    setTimeout(() => {
                        this.imageComparison.showImageComparison();
                    }, 500);
                }
            }
        });
        
        // 监听调试模式变化
        this.stateManager.subscribe('debugMode', (enabled) => {
            if (enabled) {
                this.debugPanel.show();
            } else {
                this.debugPanel.hide();
            }
        });
    }
}
```

## 🚨 错误处理

### 标准错误处理模式
```javascript
// 在模块方法中使用统一的错误处理
class ImageDownloader {
    async downloadImage(imageUrl, autoOpen = false) {
        try {
            // 1. 参数验证
            if (!imageUrl) {
                throw new Error('图片URL不能为空');
            }
            
            // 2. URL验证
            if (!FileUtils.isValidURL(imageUrl)) {
                throw new Error('无效的图片URL');
            }
            
            // 3. 执行下载逻辑
            const fileName = this.generateFileName(imageUrl);
            await this.downloadViaChrome(imageUrl, fileName, autoOpen);
            
            // 4. 成功通知
            this.notificationManager.showSuccessNotification(`✅ 开始下载: ${fileName}`);
            
        } catch (error) {
            // 5. 错误日志记录
            Logger.error('图片下载失败', {
                imageUrl,
                error: error.message,
                stack: error.stack
            });
            
            // 6. 用户通知
            this.notificationManager.showErrorNotification(`下载失败: ${error.message}`);
            
            // 7. 重新抛出错误供上层处理
            throw error;
        }
    }
}
```

## 📋 最佳实践

### 1. 模块初始化
```javascript
// 推荐的模块初始化模式
class MyModule {
    constructor(dependencies) {
        this.stateManager = dependencies.stateManager;
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        try {
            // 初始化逻辑
            await this.setupEventListeners();
            await this.loadConfiguration();
            
            this.initialized = true;
            Logger.info('MyModule initialized successfully');
        } catch (error) {
            Logger.error('MyModule initialization failed', error);
            throw error;
        }
    }
}
```

### 2. 异步操作处理
```javascript
// 推荐的异步操作模式
class NetworkModule {
    async makeRequest(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
```

### 3. 内存管理
```javascript
// 推荐的资源清理模式
class UIModule {
    constructor() {
        this.eventListeners = [];
        this.observers = [];
        this.timers = [];
    }
    
    addEventListeners(element, events) {
        Object.entries(events).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
            this.eventListeners.push({ element, event, handler });
        });
    }
    
    destroy() {
        // 清理事件监听器
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        
        // 清理观察者
        this.observers.forEach(observer => observer.disconnect());
        
        // 清理定时器
        this.timers.forEach(timer => clearTimeout(timer));
        
        // 清空数组
        this.eventListeners = [];
        this.observers = [];
        this.timers = [];
    }
}
```

---

**文档版本**: v1.0  
**创建日期**: 2025-09-18  
**最后更新**: 2025-09-18  
**负责人**: CodeBuddy