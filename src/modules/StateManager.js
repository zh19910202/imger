/**
 * 状态管理器模块
 * 统一管理所有全局状态变量，提供中央化的状态访问和更新接口
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    window.debugLog = function (message, data) {
        console.log('[StateManager]', message, data || '')
    }
}

class StateManager {
    constructor() {
        this.initialized = false
        this.imageState = new ImageStateManager()
        this.modalState = new ModalStateManager()
        this.uiState = new UIStateManager()
        this.systemState = new SystemStateManager()
        this.f1State = new F1StateManager()
        this.cacheState = new CacheStateManager()
    }

    isInitialized () {
        return this.initialized
    }

    initialize () {
        try {
            debugLog('初始化 StateManager')

            // 初始化各个状态管理器
            this.imageState.initialize()
            this.modalState.initialize()
            this.uiState.initialize()
            this.systemState.initialize()
            this.f1State.initialize()
            this.cacheState.initialize()

            this.initialized = true
            debugLog('StateManager 初始化完成')
        } catch (error) {
            debugLog('StateManager 初始化失败:', error)
            throw error
        }
    }

    // 直接暴露子管理器（推荐访问方式）
    get image () {
        return this.imageState
    }

    get modal () {
        return this.modalState
    }

    get ui () {
        return this.uiState
    }

    get system () {
        return this.systemState
    }

    get f1 () {
        return this.f1State
    }

    get cache () {
        return this.cacheState
    }

    // 保留旧方法以确保兼容性
    getImageState () {
        return this.imageState
    }

    getModalState () {
        return this.modalState
    }

    getUIState () {
        return this.uiState
    }

    getSystemState () {
        return this.systemState
    }

    getF1State () {
        return this.f1State
    }

    getCacheState () {
        return this.cacheState
    }

    // 清除所有状态
    clearAll () {
        debugLog('清除所有状态')
        this.imageState.clear()
        this.modalState.clear()
        this.uiState.clear()
        this.systemState.clear()
        this.f1State.clear()
        this.cacheState.clear()
    }

    // 获取状态快照
    getSnapshot () {
        return {
            image: this.imageState.getSnapshot(),
            modal: this.modalState.getSnapshot(),
            ui: this.uiState.getSnapshot(),
            system: this.systemState.getSnapshot(),
            f1: this.f1State.getSnapshot(),
            cache: this.cacheState.getSnapshot()
        }
    }

    // 页面变化检测方法
    checkPageChange () {
        // 直接调用内部实现，避免递归
        const newUrl = window.location.href
        const currentUrl = this.systemState.currentPageUrl

        if (currentUrl && currentUrl !== newUrl) {
            debugLog('检测到页面跳转，重置状态')

            // 使用 StateManager 清理页面状态
            clearPageState()

            if (typeof showNotification === 'function') {
                showNotification('页面切换，正在重新检测原图...', 2000)
            }

            // 重新检测原图
            setTimeout(() => {
                if (typeof recordOriginalImages === 'function') {
                    recordOriginalImages()
                }
            }, 1000)
        }

        this.systemState.setCurrentPageUrl(newUrl)

        // 监听后续的URL变化
        if (!window._pageChangeObserverStarted) {
            window._pageChangeObserverStarted = true

            // 监听路由变化
            const originalPushState = history.pushState
            const originalReplaceState = history.replaceState

            const self = this
            history.pushState = function () {
                originalPushState.apply(history, arguments)
                setTimeout(() => self.checkPageChange(), 100)
            }

            history.replaceState = function () {
                originalReplaceState.apply(history, arguments)
                setTimeout(() => self.checkPageChange(), 100)
            }

            window.addEventListener('popstate', () => {
                setTimeout(() => self.checkPageChange(), 100)
            })

            // 定期检查URL变化
            setInterval(() => {
                if (window.location.href !== self.systemState.currentPageUrl) {
                    self.checkPageChange()
                }
            }, 1000)

            debugLog('页面变化监听器已启动')
        }
    }

    // 设置页面监听器方法
    setupPageListeners () {
        // 监听存储变化
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'sync') {
                    debugLog('检测到设置变化:', changes)
                    // 这里可以添加设置变化的处理逻辑
                }
            })
        }

        // 监听页面卸载
        window.addEventListener('beforeunload', () => this.cleanup())

        // 监听图片变化
        if (typeof observeImageChanges === 'function') {
            observeImageChanges()
        }

        debugLog('页面监听器已设置')
    }

    // 清理方法
    cleanup () {
        debugLog('执行清理函数')

        // 移除事件监听器
        if (typeof handleKeydownFallback === 'function') {
            document.removeEventListener('keydown', handleKeydownFallback)
        }

        // 清理模块状态
        clearPageState()

        // 重置初始化状态
        window._pageChangeObserverStarted = false
    }

    // 保留最常用的委托方法（兼容性 + 便捷性）
    setOriginalImage (image, force = false) {
        return this.imageState.setOriginalImage(image, force)
    }

    clearPageState () {
        this.imageState.clear()
        this.modalState.clear()
        this.systemState.clearPendingTimeouts()

        // 清理上传图片状态
        this.imageState.uploadedImage = null
        window.uploadedImage = null

        // 清理自动对比标志
        this.systemState.setShouldAutoCompare(false)

        // 清理SmartComparisonManager的缓存状态，避免跨页面的对比图遗留
        if (typeof getSmartComparisonManager === 'function') {
            const smartManager = getSmartComparisonManager()
            if (smartManager && typeof smartManager.clearCache === 'function') {
                smartManager.clearCache()
                debugLog('SmartComparisonManager缓存已清理，避免跨页面对比图遗留')
            }
        }

        debugLog('页面状态已清理（包括上传图片、自动对比状态和SmartComparisonManager缓存）')
    }
}

// 图片状态管理器
class ImageStateManager {
    constructor() {
        this.lastHoveredImage = null
        this.selectedImage = null
        this.originalImage = null
        this.uploadedImage = null
        this.originalImageLocked = false
        this.capturedOriginalImage = null
        this.capturedModifiedImage = null
        this.originalImageFromNetwork = null
        this.serverReturnedModifiedImage = null
        this.userUploadedImage = null
    }

    initialize () {
        // 同步到全局变量以保持兼容性
        this.syncToGlobals()
        debugLog('ImageStateManager 初始化完成')
    }

    syncToGlobals () {
        window.lastHoveredImage = this.lastHoveredImage
        window.selectedImage = this.selectedImage
        window.originalImage = this.originalImage
        window.uploadedImage = this.uploadedImage
        window.originalImageLocked = this.originalImageLocked
        window.capturedOriginalImage = this.capturedOriginalImage
        window.capturedModifiedImage = this.capturedModifiedImage
        window.originalImageFromNetwork = this.originalImageFromNetwork
        window.serverReturnedModifiedImage = this.serverReturnedModifiedImage
        window.userUploadedImage = this.userUploadedImage
    }

    syncFromGlobals () {
        this.lastHoveredImage = window.lastHoveredImage
        this.selectedImage = window.selectedImage
        this.originalImage = window.originalImage
        this.uploadedImage = window.uploadedImage
        this.originalImageLocked = window.originalImageLocked
        this.capturedOriginalImage = window.capturedOriginalImage
        this.capturedModifiedImage = window.capturedModifiedImage
        this.originalImageFromNetwork = window.originalImageFromNetwork
        this.serverReturnedModifiedImage = window.serverReturnedModifiedImage
        this.userUploadedImage = window.userUploadedImage
    }

    setLastHoveredImage (image) {
        this.lastHoveredImage = image
        window.lastHoveredImage = image
        debugLog('设置最后悬停图片', { src: image?.src?.substring(0, 50) })
    }

    setSelectedImage (image) {
        this.selectedImage = image
        window.selectedImage = image
        debugLog('设置选中图片', { src: image?.src?.substring(0, 50) })
    }

    setOriginalImage (image, force = false) {
        if (this.originalImageLocked && !force) {
            debugLog('原图已锁定，跳过设置')
            return false
        }

        this.originalImage = image
        window.originalImage = image
        this.originalImageLocked = true
        window.originalImageLocked = true
        debugLog('设置原图', { src: image?.src?.substring(0, 50), locked: true })
        return true
    }

    unlockOriginalImage () {
        this.originalImageLocked = false
        window.originalImageLocked = false
        debugLog('解锁原图')
    }

    clear () {
        this.lastHoveredImage = null
        this.selectedImage = null
        this.originalImage = null
        this.uploadedImage = null
        this.originalImageLocked = false
        this.capturedOriginalImage = null
        this.capturedModifiedImage = null
        this.originalImageFromNetwork = null
        this.serverReturnedModifiedImage = null
        this.userUploadedImage = null
        this.syncToGlobals()
        debugLog('图片状态已清除')
    }

    getSnapshot () {
        return {
            lastHoveredImage: !!this.lastHoveredImage,
            selectedImage: !!this.selectedImage,
            originalImage: !!this.originalImage,
            uploadedImage: !!this.uploadedImage,
            originalImageLocked: this.originalImageLocked
        }
    }
}

// 模态框状态管理器
class ModalStateManager {
    constructor() {
        this.comparisonModal = null
        this.isComparisonModalOpen = false
        this.dimensionCheckModal = null
        this.isDimensionCheckModalOpen = false
        this.lastDimensionCheckInfo = null
    }

    initialize () {
        this.syncToGlobals()
        debugLog('ModalStateManager 初始化完成')
    }

    syncToGlobals () {
        window.comparisonModal = this.comparisonModal
        window.isComparisonModalOpen = this.isComparisonModalOpen
        window.dimensionCheckModal = this.dimensionCheckModal
        window.isDimensionCheckModalOpen = this.isDimensionCheckModalOpen
        window.lastDimensionCheckInfo = this.lastDimensionCheckInfo
    }

    setComparisonModal (modal, isOpen) {
        this.comparisonModal = modal
        this.isComparisonModalOpen = isOpen
        window.comparisonModal = modal
        window.isComparisonModalOpen = isOpen
        debugLog('设置对比模态框状态', { isOpen })
    }

    setDimensionCheckModal (modal, isOpen) {
        this.dimensionCheckModal = modal
        this.isDimensionCheckModalOpen = isOpen
        window.dimensionCheckModal = modal
        window.isDimensionCheckModalOpen = isOpen
        debugLog('设置尺寸检查模态框状态', { isOpen })
    }

    setLastDimensionCheckInfo (info) {
        this.lastDimensionCheckInfo = info
        window.lastDimensionCheckInfo = info
        debugLog('设置最后尺寸检查信息')
    }

    clear () {
        this.comparisonModal = null
        this.isComparisonModalOpen = false
        this.dimensionCheckModal = null
        this.isDimensionCheckModalOpen = false
        this.lastDimensionCheckInfo = null
        this.syncToGlobals()
        debugLog('模态框状态已清除')
    }

    getSnapshot () {
        return {
            isComparisonModalOpen: this.isComparisonModalOpen,
            isDimensionCheckModalOpen: this.isDimensionCheckModalOpen,
            hasLastDimensionCheckInfo: !!this.lastDimensionCheckInfo
        }
    }
}

// UI状态管理器
class UIStateManager {
    constructor() {
        this.dimensionTooltip = null
        this.debugPanel = null
        this.debugMode = false
        this.soundEnabled = true
        this.autoCompareEnabled = true
        this.notificationAudio = null
    }

    initialize () {
        this.syncToGlobals()
        debugLog('UIStateManager 初始化完成')
    }

    syncToGlobals () {
        window.dimensionTooltip = this.dimensionTooltip
        window.debugPanel = this.debugPanel
        window.debugMode = this.debugMode
        window.soundEnabled = this.soundEnabled
        window.autoCompareEnabled = this.autoCompareEnabled
        window.notificationAudio = this.notificationAudio
    }

    setDebugMode (enabled) {
        this.debugMode = enabled
        window.debugMode = enabled
        debugLog('设置调试模式', { enabled })
    }

    setSoundEnabled (enabled) {
        this.soundEnabled = enabled
        window.soundEnabled = enabled
        debugLog('设置音效状态', { enabled })
    }

    setAutoCompareEnabled (enabled) {
        this.autoCompareEnabled = enabled
        window.autoCompareEnabled = enabled
        debugLog('设置自动对比状态', { enabled })
    }

    clear () {
        this.dimensionTooltip = null
        this.debugPanel = null
        this.debugMode = false
        this.syncToGlobals()
        debugLog('UI状态已清除')
    }

    getSnapshot () {
        return {
            debugMode: this.debugMode,
            soundEnabled: this.soundEnabled,
            autoCompareEnabled: this.autoCompareEnabled
        }
    }
}

// 系统状态管理器
class SystemStateManager {
    constructor() {
        this.currentPageUrl = ''
        this.pendingComparisonTimeouts = []
        this.shouldAutoCompare = false
        this.debugLogs = []
        this.cosImageCache = new Map()
        this.capturedImageRequests = new Map()
    }

    initialize () {
        this.currentPageUrl = window.location.href
        this.syncToGlobals()
        debugLog('SystemStateManager 初始化完成')
    }

    syncToGlobals () {
        window.currentPageUrl = this.currentPageUrl
        window.pendingComparisonTimeouts = this.pendingComparisonTimeouts
        window.shouldAutoCompare = this.shouldAutoCompare
        window.debugLogs = this.debugLogs

        // 检查是否已有代理属性，避免覆盖Object.defineProperty设置的属性
        if (!window.hasOwnProperty('cosImageCache') ||
            Object.getOwnPropertyDescriptor(window, 'cosImageCache')?.configurable !== false) {
            window.cosImageCache = this.cosImageCache
        }
        if (!window.hasOwnProperty('capturedImageRequests') ||
            Object.getOwnPropertyDescriptor(window, 'capturedImageRequests')?.configurable !== false) {
            window.capturedImageRequests = this.capturedImageRequests
        }
    }

    setCurrentPageUrl (url) {
        this.currentPageUrl = url
        window.currentPageUrl = url
        debugLog('设置当前页面URL', { url })
    }

    addPendingTimeout (timeoutId) {
        this.pendingComparisonTimeouts.push(timeoutId)
        window.pendingComparisonTimeouts = this.pendingComparisonTimeouts
    }

    clearPendingTimeouts () {
        this.pendingComparisonTimeouts.forEach(timeoutId => {
            try {
                clearTimeout(timeoutId)
            } catch (e) { }
        })
        this.pendingComparisonTimeouts = []
        window.pendingComparisonTimeouts = this.pendingComparisonTimeouts
        debugLog('清除待执行的对比任务')
    }

    setShouldAutoCompare (should) {
        this.shouldAutoCompare = should
        window.shouldAutoCompare = should
        debugLog('设置自动对比标记', { should })
    }

    addDebugLog (log) {
        this.debugLogs.push(log)
        if (this.debugLogs.length > 100) {
            this.debugLogs.shift()
        }
        window.debugLogs = this.debugLogs
    }

    clear () {
        this.currentPageUrl = ''
        this.clearPendingTimeouts()
        this.shouldAutoCompare = false
        this.debugLogs = []
        this.cosImageCache.clear()
        this.capturedImageRequests.clear()
        this.syncToGlobals()
        debugLog('系统状态已清除')
    }

    getSnapshot () {
        return {
            currentPageUrl: this.currentPageUrl,
            pendingTimeouts: this.pendingComparisonTimeouts.length,
            shouldAutoCompare: this.shouldAutoCompare,
            debugLogs: this.debugLogs.length,
            cosImageCache: this.cosImageCache.size,
            capturedRequests: this.capturedImageRequests.size
        }
    }
}

// F1批量操作状态管理器
class F1StateManager {
    constructor() {
        this.autoInvalidating = false
        this.intervalMs = 800
        this.maxRuns = 0
        this.timerId = null
        this.runCount = 0
    }

    initialize () {
        this.syncToGlobals()
        debugLog('F1StateManager 初始化完成')
    }

    syncToGlobals () {
        window.f1AutoInvalidating = this.autoInvalidating
        window.f1IntervalMs = this.intervalMs
        window.f1MaxRuns = this.maxRuns
        window.f1TimerId = this.timerId
        window.f1RunCount = this.runCount
    }

    startBatch () {
        this.autoInvalidating = true
        this.runCount = 0
        window.f1AutoInvalidating = true
        window.f1RunCount = 0
        debugLog('开始F1批量操作')
    }

    stopBatch () {
        this.autoInvalidating = false
        if (this.timerId) {
            clearTimeout(this.timerId)
            this.timerId = null
        }
        window.f1AutoInvalidating = false
        window.f1TimerId = null
        debugLog('停止F1批量操作')
    }

    setTimer (timerId) {
        this.timerId = timerId
        window.f1TimerId = timerId
    }

    incrementRunCount () {
        this.runCount++
        window.f1RunCount = this.runCount
        return this.runCount
    }

    setInterval (intervalMs) {
        this.intervalMs = intervalMs
        window.f1IntervalMs = intervalMs
        debugLog('设置F1间隔', { intervalMs })
    }

    setMaxRuns (maxRuns) {
        this.maxRuns = maxRuns
        window.f1MaxRuns = maxRuns
        debugLog('设置F1最大次数', { maxRuns })
    }

    clear () {
        this.stopBatch()
        this.intervalMs = 800
        this.maxRuns = 0
        this.runCount = 0
        this.syncToGlobals()
        debugLog('F1状态已清除')
    }

    getSnapshot () {
        return {
            autoInvalidating: this.autoInvalidating,
            intervalMs: this.intervalMs,
            maxRuns: this.maxRuns,
            runCount: this.runCount,
            hasTimer: !!this.timerId
        }
    }
}

// 缓存状态管理器（与RunningHub分离的通用缓存）
class CacheStateManager {
    constructor() {
        this.cosImageCache = new Map()
        this.capturedImageRequests = new Map()
        this.runningHubConfig = null
    }

    initialize () {
        this.syncToGlobals()
        debugLog('CacheStateManager 初始化完成')
    }

    syncToGlobals () {
        // 检查是否已有代理属性，避免覆盖Object.defineProperty设置的属性
        if (!window.hasOwnProperty('cosImageCache') ||
            Object.getOwnPropertyDescriptor(window, 'cosImageCache')?.configurable !== false) {
            window.cosImageCache = this.cosImageCache
        }
        if (!window.hasOwnProperty('capturedImageRequests') ||
            Object.getOwnPropertyDescriptor(window, 'capturedImageRequests')?.configurable !== false) {
            window.capturedImageRequests = this.capturedImageRequests
        }
        window.RUNNINGHUB_CONFIG = this.runningHubConfig
    }

    setCosImageCache (key, value) {
        this.cosImageCache.set(key, value)
        // 检查是否已有代理属性，避免覆盖Object.defineProperty设置的属性
        if (!window.hasOwnProperty('cosImageCache') ||
            Object.getOwnPropertyDescriptor(window, 'cosImageCache')?.configurable !== false) {
            window.cosImageCache = this.cosImageCache
        }
    }

    getCosImageCache (key) {
        return this.cosImageCache.get(key)
    }

    setCapturedRequest (key, value) {
        this.capturedImageRequests.set(key, value)
        // 检查是否已有代理属性，避免覆盖Object.defineProperty设置的属性
        if (!window.hasOwnProperty('capturedImageRequests') ||
            Object.getOwnPropertyDescriptor(window, 'capturedImageRequests')?.configurable !== false) {
            window.capturedImageRequests = this.capturedImageRequests
        }
    }

    getCapturedRequest (key) {
        return this.capturedImageRequests.get(key)
    }

    setRunningHubConfig (config) {
        this.runningHubConfig = config
        window.RUNNINGHUB_CONFIG = config
        debugLog('设置RunningHub配置')
    }

    clear () {
        this.cosImageCache.clear()
        this.capturedImageRequests.clear()
        this.runningHubConfig = null
        this.syncToGlobals()
        debugLog('缓存状态已清除')
    }

    getSnapshot () {
        return {
            cosImageCache: this.cosImageCache.size,
            capturedRequests: this.capturedImageRequests.size,
            hasRunningHubConfig: !!this.runningHubConfig
        }
    }
}

// 全局实例
let stateManagerInstance = null

// 获取全局实例
function getStateManager () {
    if (!stateManagerInstance) {
        stateManagerInstance = new StateManager()
        // 设置到全局变量以保持兼容性
        window.stateManager = stateManagerInstance
    }
    return stateManagerInstance
}

// 初始化函数
function initializeStateManager () {
    try {
        const manager = getStateManager()
        manager.initialize()
        debugLog('StateManager 全局初始化完成')
        return manager
    } catch (error) {
        debugLog('StateManager 全局初始化失败:', error)
        throw error
    }
}

// 页面清理函数
function clearPageState () {
    const manager = getStateManager()
    manager.getImageState().clear()
    manager.getModalState().clear()
    manager.getSystemState().clearPendingTimeouts()

    // 清理上传图片状态
    manager.getImageState().uploadedImage = null
    window.uploadedImage = null

    // 清理自动对比标志
    manager.getSystemState().setShouldAutoCompare(false)

    // 清理SmartComparisonManager的缓存状态，避免跨页面的对比图遗留
    if (typeof getSmartComparisonManager === 'function') {
        const smartManager = getSmartComparisonManager()
        if (smartManager && typeof smartManager.clearCache === 'function') {
            smartManager.clearCache()
            debugLog('SmartComparisonManager缓存已清理，避免跨页面对比图遗留')
        }
    }

    debugLog('页面状态已清理（包括上传图片、自动对比状态和SmartComparisonManager缓存）')
}

// 页面跳转检测和状态重置
function checkPageChangeAndReset () {
    const manager = getStateManager()
    const currentUrl = window.location.href
    const lastUrl = manager.getSystemState().currentPageUrl

    if (currentUrl !== lastUrl) {
        debugLog('检测到页面跳转，重置状态', { from: lastUrl, to: currentUrl })
        clearPageState()
        manager.getSystemState().setCurrentPageUrl(currentUrl)
        return true
    }
    return false
}

// 页面变化检测和处理（从content.js迁移）
function checkPageChange () {
    const manager = getStateManager()
    const newUrl = window.location.href
    const currentPageUrl = manager.getSystemState().currentPageUrl

    if (currentPageUrl && currentPageUrl !== newUrl) {
        debugLog('检测到页面跳转，重置状态')

        // 使用 StateManager 清理页面状态
        if (typeof clearPageState === 'function') {
            clearPageState()
        }

        if (typeof showNotification === 'function') {
            showNotification('页面切换，正在重新检测原图...', 2000)
        }

        // 重新检测原图
        setTimeout(() => {
            if (typeof recordOriginalImages === 'function') {
                recordOriginalImages()
            }
        }, 1000)
    }

    manager.getSystemState().setCurrentPageUrl(newUrl)

    // 监听后续的URL变化
    if (!window._pageChangeObserverStarted) {
        window._pageChangeObserverStarted = true

        // 监听路由变化
        const originalPushState = history.pushState
        const originalReplaceState = history.replaceState

        history.pushState = function () {
            originalPushState.apply(history, arguments)
            setTimeout(() => checkPageChange(), 100)
        }

        history.replaceState = function () {
            originalReplaceState.apply(history, arguments)
            setTimeout(() => checkPageChange(), 100)
        }

        window.addEventListener('popstate', () => {
            setTimeout(() => checkPageChange(), 100)
        })

        // 定期检查URL变化
        setInterval(() => {
            if (window.location.href !== manager.getSystemState().currentPageUrl) {
                checkPageChange()
            }
        }, 1000)

        debugLog('页面变化监听器已启动')
    }
}

// 设置页面监听器（从content.js迁移）
function setupPageListeners () {
    // 监听存储变化
    if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                debugLog('检测到设置变化:', changes)
                // 这里可以添加设置变化的处理逻辑
            }
        })
    }

    // 监听页面卸载
    window.addEventListener('beforeunload', cleanup)

    // 监听图片变化
    if (typeof observeImageChanges === 'function') {
        observeImageChanges()
    }

    debugLog('页面监听器已设置')
}

// 清理函数（从content.js迁移）
function cleanup () {
    debugLog('执行清理函数')

    // 移除事件监听器
    if (typeof handleKeydownFallback === 'function') {
        document.removeEventListener('keydown', handleKeydownFallback)
    }

    // 清理模块状态
    if (typeof clearPageState === 'function') {
        clearPageState()
    }

    // 重置初始化状态
    window._pageChangeObserverStarted = false
}

// 导出到全局作用域
window.StateManager = StateManager
window.getStateManager = getStateManager
window.initializeStateManager = initializeStateManager
window.clearPageState = clearPageState
window.checkPageChangeAndReset = checkPageChangeAndReset
// 避免与content.js中的函数名冲突
window.checkPageChangeFromStateManager = checkPageChange
window.setupPageListenersFromStateManager = setupPageListeners
window.cleanupFromStateManager = cleanup

debugLog('StateManager 模块加载完成')