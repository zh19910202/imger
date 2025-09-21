/**
 * 智能图片对比管理器
 * 负责W键触发的智能图片对比功能，包括COS图片拦截和多策略对比逻辑
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    window.debugLog = function (message, data) {
        console.log('[SmartComparisonManager]', message, data || '')
    }
}

class SmartComparisonManager {
    constructor() {
        this.initialized = false
        this.cosImageCache = new Map()
        this.capturedOriginalImage = null
        this.capturedModifiedImage = null
        this.shouldAutoCompare = false
        this.autoCompareEnabled = true
    }

    isInitialized () {
        return this.initialized
    }

    initialize () {
        try {
            debugLog('初始化 SmartComparisonManager')
            this.initializeCOSImageListener()
            this.initialized = true
            debugLog('SmartComparisonManager 初始化完成')
        } catch (error) {
            debugLog('SmartComparisonManager 初始化失败:', error)
            throw error
        }
    }

    // 初始化COS图片监听器
    initializeCOSImageListener () {
        debugLog('初始化COS图片拦截监听器')

        // 监听来自background.js的COS图片拦截消息
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.type === 'COS_IMAGE_DETECTED') {
                    this.handleCOSImageDetection(message.data)
                }
            })

            console.log('✅ COS图片拦截监听器已启动')
        } else {
            console.warn('⚠️ Chrome runtime不可用，无法监听COS图片')
        }
    }

    // 处理COS图片检测 - 简化版
    handleCOSImageDetection (data) {
        debugLog('COS图片检测', data)

        const { url, isOriginal, isModified, imageType, stage } = data

        // 只处理请求完成阶段，避免重复处理
        if (stage !== 'completed') {
            return
        }

        // 缓存图片信息
        this.cosImageCache.set(url, {
            ...data,
            timestamp: Date.now()
        })

        if (isOriginal) {
            console.log('📸 捕获到原图:', url)
            this.capturedOriginalImage = url

            // 如果当前原图未锁定或为空，更新原图引用
            if (!window.originalImageLocked || !window.originalImage) {
                this.updateOriginalImageFromCOS(url)
            }

            debugLog('原图已捕获', { url, originalImageLocked: window.originalImageLocked })
        }

        if (isModified) {
            console.log('🔧 捕获到修改图:', url)
            this.capturedModifiedImage = url

            debugLog('修改图已捕获', { url })

            // 如果用户正在对比模式，更新对比
            if (window.isComparisonModalOpen) {
                this.triggerSmartComparisonWithFallback()
            }
        }

        // 自动触发智能对比（如果需要且开关开启）
        if (this.shouldAutoCompare && this.autoCompareEnabled && this.capturedOriginalImage) {
            this.triggerSmartComparison()
        } else if (this.shouldAutoCompare && !this.autoCompareEnabled) {
            debugLog('跳过自动智能对比 - 自动对比功能已关闭')
            this.shouldAutoCompare = false // 重置标记
        }
    }

    // 强健原图检测机制 - 不依赖等待时间，直接强化检测能力
    async ensureOriginalImageAvailable () {
        debugLog('🔍 启动强健原图检测机制')

        // 1. 检查现有原图
        if (this.capturedOriginalImage || window.originalImage) {
            debugLog('✅ 已存在原图，无需检测')
            return true
        }

        // 2. 执行智能检测策略
        debugLog('🚀 执行智能原图检测')

        // 策略1: 直接DOM扫描
        const selectors = [
            'div[data-v-92a52416].safe-image img[src]',
            'div.safe-image img[src]',
            'img[data-v-92a52416][src]',
            '.image-item img[src]',
            'img[src*="cos.ap-guangzhou.myqcloud.com"]'
        ]

        for (const selector of selectors) {
            const imgs = document.querySelectorAll(selector)
            for (const img of imgs) {
                if (this.isValidOriginalImage(img)) {
                    debugLog('✅ DOM扫描找到有效原图:', selector)
                    this.setFoundOriginalImage(img)
                    return true
                }
            }
        }

        // 策略2: 检测已加载的图片
        const allImages = document.querySelectorAll('img[src]')
        for (const img of allImages) {
            if (img.complete && img.naturalWidth > 0 && this.isValidOriginalImage(img)) {
                debugLog('✅ 已加载图片检测找到有效原图')
                this.setFoundOriginalImage(img)
                return true
            }
        }

        // 策略3: 通过图片属性检测
        for (const img of allImages) {
            const hasDataV = Array.from(img.attributes).some(attr =>
                attr.name.startsWith('data-v-')
            )

            if (hasDataV && this.isValidOriginalImage(img)) {
                debugLog('✅ 属性检测找到有效原图')
                this.setFoundOriginalImage(img)
                return true
            }
        }

        // 策略4: 强制调用原有检测
        if (typeof recordOriginalImages === 'function') {
            debugLog('🔥 调用原有检测函数')
            recordOriginalImages()

            // 给一个很短的时间让DOM更新
            await new Promise(resolve => setTimeout(resolve, 100))

            if (window.originalImage) {
                debugLog('✅ 原有检测成功')
                return true
            }
        }

        // 策略5: 最终回退 - 选择第一个有效图片
        for (const img of allImages) {
            if (this.isValidOriginalImage(img)) {
                debugLog('🎯 最终回退策略找到图片')
                this.setFoundOriginalImage(img)
                return true
            }
        }

        debugLog('❌ 所有检测策略都失败了')
        return false
    }

    // 检查图片是否有效
    isValidOriginalImage (img) {
        if (!img || !img.src) return false

        // 检查图片格式
        const supportedFormats = /\.(jpe?g|png|webp|gif|bmp|tiff)(\?|$)/i
        if (!supportedFormats.test(img.src)) return false

        // 排除明显的缩略图
        const thumbnailPatterns = /(thumb|thumbnail|small|mini|tiny|preview|_s\.|_m\.)/i
        if (thumbnailPatterns.test(img.src)) return false

        // 检查尺寸（如果可用）
        const width = img.naturalWidth || img.width || 0
        const height = img.naturalHeight || img.height || 0
        if (width > 0 && height > 0 && (width < 50 || height < 50)) return false

        return true
    }

    // 设置找到的原图
    setFoundOriginalImage (img) {
        const imageInfo = {
            src: img.src,
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
            name: this.extractFileNameFromUrl(img.src),
            element: img
        }

        // 设置到全局变量
        window.originalImage = imageInfo
        window.originalImageLocked = true

        debugLog('✅ 原图已设置', {
            src: imageInfo.src.substring(0, 50) + '...',
            size: `${imageInfo.width}x${imageInfo.height}`
        })

        if (typeof showNotification === 'function') {
            showNotification(`🎯 原图检测成功: ${imageInfo.width}×${imageInfo.height}`, 2000)
        }
    }

    // 智能图片对比 - 包含回退逻辑 (W键主入口) - 强健原图检测
    async triggerSmartComparisonWithFallback () {
        debugLog('启动智能图片对比 (强健原图检测)')

        console.log('📊 图片对比状态检查:', {
            capturedOriginalImage: this.capturedOriginalImage,
            capturedModifiedImage: this.capturedModifiedImage,
            uploadedImage: window.uploadedImage ? window.uploadedImage.src : null,
            originalImage: !!window.originalImage,
            shouldAutoCompare: this.shouldAutoCompare,
            cosImageCache: this.cosImageCache.size
        })

        // 强健原图检测机制 - 不依赖等待时间，直接强化检测能力
        const hasOriginalImage = await this.ensureOriginalImageAvailable()

        if (!hasOriginalImage) {
            debugLog('所有原图检测策略都失败')
            if (typeof showNotification === 'function') {
                showNotification('未能检测到原图，请确认页面已加载完成或按N键重新检测', 3000)
            }
            return
        }

        let comparisonPair = null

        // 策略1: 使用COS拦截的图片（最优）
        if (this.capturedOriginalImage && this.capturedModifiedImage) {
            comparisonPair = {
                image1: { src: this.capturedOriginalImage, label: '原图' },
                image2: { src: this.capturedModifiedImage, label: '修改图' },
                mode: 'COS原图vs修改图'
            }
            debugLog('策略1: 使用COS拦截图片', comparisonPair)
            if (typeof showNotification === 'function') {
                showNotification('🎯 使用COS拦截图片对比', 1000)
            }
        }
        // 策略2: 原图 vs 用户上传图片
        else if (this.capturedOriginalImage && window.uploadedImage) {
            comparisonPair = {
                image1: { src: this.capturedOriginalImage, label: '原图' },
                image2: { src: window.uploadedImage.src, label: '上传图片' },
                mode: 'COS原图vs上传图'
            }
            debugLog('策略2: COS原图vs用户上传', comparisonPair)
            if (typeof showNotification === 'function') {
                showNotification('📷 原图vs上传图对比', 1000)
            }
        }
        // 策略3: 现有逻辑 - 保障原图 vs 上传图片
        else if (window.originalImage && window.uploadedImage) {
            comparisonPair = {
                image1: { src: window.originalImage.src, label: '页面原图' },
                image2: { src: window.uploadedImage.src, label: '上传图片' },
                mode: '页面原图vs上传图'
            }
            debugLog('策略3: 页面原图vs用户上传', comparisonPair)
            if (typeof showNotification === 'function') {
                showNotification('📋 页面原图vs上传图对比', 1000)
            }
        }
        // 策略4: 如果只有COS原图，与页面其他图片对比
        else if (this.capturedOriginalImage) {
            const pageImages = document.querySelectorAll('img')
            if (pageImages.length >= 2) {
                comparisonPair = {
                    image1: { src: this.capturedOriginalImage, label: '原图' },
                    image2: { src: pageImages[1].src, label: '页面图片' },
                    mode: '原图vs页面图片'
                }
                debugLog('策略4: 原图vs页面图片', comparisonPair)
                if (typeof showNotification === 'function') {
                    showNotification('🔄 原图vs页面图片对比', 1000)
                }
            }
        }
        // 策略5: 使用保障机制找到的原图进行对比
        else if (window.originalImage) {
            const pageImages = document.querySelectorAll('img')
            if (pageImages.length >= 2) {
                comparisonPair = {
                    image1: { src: window.originalImage.src, label: '保障原图' },
                    image2: { src: pageImages[1].src, label: '页面图片' },
                    mode: '保障原图vs页面图片'
                }
                debugLog('策略5: 保障原图vs页面图片', comparisonPair)
                if (typeof showNotification === 'function') {
                    showNotification('🔒 保障原图vs页面图片对比', 1000)
                }
            }
        }
        // 策略6: 页面图片互相对比（最终回退）
        else {
            const pageImages = document.querySelectorAll('img')
            if (pageImages.length >= 2) {
                comparisonPair = {
                    image1: { src: pageImages[0].src, label: '页面图片1' },
                    image2: { src: pageImages[1].src, label: '页面图片2' },
                    mode: '页面图片对比'
                }
                debugLog('策略6: 页面图片对比', comparisonPair)
                if (typeof showNotification === 'function') {
                    showNotification('🖼️ 页面图片对比', 1000)
                }
            }
        }

        if (comparisonPair) {
            debugLog('执行图片对比', comparisonPair.mode)
            this.showSmartComparison(comparisonPair)
            this.shouldAutoCompare = false
        } else {
            debugLog('所有策略都无法找到可对比的图片')
            if (typeof showNotification === 'function') {
                showNotification('❌ 无可用图片进行对比，请上传图片或等待页面加载', 2000)
            }
        }
    }

    // 智能对比逻辑 - 简化版
    triggerSmartComparison () {
        debugLog('触发智能对比')

        if (!this.capturedOriginalImage) {
            debugLog('无原图，跳过智能对比')
            if (typeof showNotification === 'function') {
                showNotification('⏳ 等待原图加载...', 2000)
            }
            return
        }

        let comparisonPair = null

        // 优先使用服务器修改图进行对比
        if (this.capturedModifiedImage) {
            comparisonPair = {
                image1: { src: this.capturedOriginalImage, label: '原图' },
                image2: { src: this.capturedModifiedImage, label: '修改图' },
                mode: '原图vs修改图对比'
            }
        }
        // 如果没有修改图，使用用户上传的图片
        else if (window.uploadedImage) {
            comparisonPair = {
                image1: { src: this.capturedOriginalImage, label: '原图' },
                image2: { src: window.uploadedImage.src, label: '上传图片' },
                mode: '原图vs上传图对比'
            }
        }
        // 都没有则提示等待
        else {
            debugLog('等待对比图片')
            if (typeof showNotification === 'function') {
                showNotification('⏳ 等待对比图片...', 2000)
            }
            return
        }

        debugLog('启动智能对比', comparisonPair.mode)
        if (typeof showNotification === 'function') {
            showNotification(`🔍 启动${comparisonPair.mode}`, 1000)
        }
        this.showSmartComparison(comparisonPair)
        this.shouldAutoCompare = false // 重置自动对比标志
    }

    // 显示智能对比弹窗 - 仅显示模式（无跨域问题）
    async showSmartComparison (comparisonPair) {
        debugLog('显示智能对比 (仅显示模式)', comparisonPair)

        try {
            // 仅显示模式：直接创建img元素，无需blob转换
            const img1 = await this.createImageElementForDisplay(comparisonPair.image1.src)
            const img2 = await this.createImageElementForDisplay(comparisonPair.image2.src)

            // 调用现有的对比函数
            if (typeof createComparisonModal === 'function') {
                createComparisonModal(img1, img2, img2)
            } else {
                throw new Error('createComparisonModal 函数不可用')
            }

            debugLog('智能对比弹窗已创建', {
                image1: comparisonPair.image1.label,
                image2: comparisonPair.image2.label,
                mode: comparisonPair.mode
            })

        } catch (error) {
            debugLog('智能对比失败', error)
            if (typeof showNotification === 'function') {
                showNotification('❌ 图片对比失败: ' + error.message, 3000)
            }
        }
    }

    // 为显示创建图片元素 - 无需跨域处理
    createImageElementForDisplay (imageUrl) {
        const self = this // 保存this引用
        return new Promise((resolve, reject) => {
            const img = new Image()

            // 设置较短的超时时间
            const timeout = setTimeout(() => {
                img.onload = img.onerror = null
                reject(new Error('图片加载超时'))
            }, 8000)

            img.onload = function () {
                clearTimeout(timeout)
                debugLog('图片加载成功 (仅显示)', {
                    src: imageUrl,
                    width: this.naturalWidth,
                    height: this.naturalHeight
                })

                // 创建一个包含必要属性的图片对象
                const imageObj = {
                    src: this.src,
                    width: this.naturalWidth,
                    height: this.naturalHeight,
                    name: self.extractFileNameFromUrl(this.src),
                    element: this
                }

                resolve(imageObj)
            }

            img.onerror = function () {
                clearTimeout(timeout)
                reject(new Error('图片加载失败'))
            }

            // COS图片也可以正常显示，只是不能进行canvas操作
            img.src = imageUrl
        })
    }

    // 从COS更新原图引用 - 仅显示模式
    async updateOriginalImageFromCOS (imageUrl) {
        debugLog('从COS更新原图引用 (仅显示模式)', imageUrl)

        try {
            // 仅显示模式：直接创建img元素，无需代理
            const img = await this.createImageElementForDisplay(imageUrl)

            window.originalImage = img
            window.originalImageLocked = true
            debugLog('原图从COS加载成功 (仅显示)', {
                src: imageUrl,
                width: img.naturalWidth,
                height: img.naturalHeight
            })

            if (typeof showNotification === 'function') {
                showNotification('✅ 原图已获取 (显示模式)', 2000)
            }

        } catch (error) {
            debugLog('原图从COS加载失败', error)
            if (typeof showNotification === 'function') {
                showNotification('❌ 原图加载失败: ' + error.message, 3000)
            }
        }
    }

    // 从URL提取文件名的辅助函数
    extractFileNameFromUrl (url) {
        if (typeof extractFileNameFromUrl === 'function') {
            return extractFileNameFromUrl(url)
        }

        // 简单的回退实现
        try {
            const urlObj = new URL(url)
            const pathname = urlObj.pathname
            const filename = pathname.split('/').pop()
            return filename || 'unknown'
        } catch (error) {
            return 'unknown'
        }
    }

    // 设置自动对比开关
    setAutoCompareEnabled (enabled) {
        this.autoCompareEnabled = enabled
        debugLog('自动对比功能', enabled ? '已启用' : '已禁用')
    }

    // 获取当前状态
    getStatus () {
        return {
            initialized: this.initialized,
            capturedOriginalImage: this.capturedOriginalImage,
            capturedModifiedImage: this.capturedModifiedImage,
            shouldAutoCompare: this.shouldAutoCompare,
            autoCompareEnabled: this.autoCompareEnabled,
            cosImageCacheSize: this.cosImageCache.size
        }
    }

    // 清理缓存
    clearCache () {
        this.cosImageCache.clear()
        this.capturedOriginalImage = null
        this.capturedModifiedImage = null
        this.shouldAutoCompare = false

        // 清理全局状态
        window.uploadedImage = null
        window.shouldAutoCompare = false

        // 清理全局代理变量（避免跨页面状态污染）
        if (typeof window.capturedOriginalImage !== 'undefined') {
            window.capturedOriginalImage = null
        }
        if (typeof window.capturedModifiedImage !== 'undefined') {
            window.capturedModifiedImage = null
        }

        debugLog('SmartComparisonManager 缓存已清理（包括全局上传图片状态和代理变量）')
    }
}

// 全局实例
let smartComparisonManagerInstance = null

// 获取全局实例
function getSmartComparisonManager () {
    if (!smartComparisonManagerInstance) {
        smartComparisonManagerInstance = new SmartComparisonManager()
        // 设置到全局变量以保持兼容性
        window.smartComparisonManager = smartComparisonManagerInstance
    }
    return smartComparisonManagerInstance
}

// 兼容性函数 - 保持向后兼容
function triggerSmartComparisonWithFallback () {
    const manager = getSmartComparisonManager()
    if (!manager.isInitialized()) {
        manager.initialize()
    }
    return manager.triggerSmartComparisonWithFallback()
}

function triggerSmartComparison () {
    const manager = getSmartComparisonManager()
    if (!manager.isInitialized()) {
        manager.initialize()
    }
    return manager.triggerSmartComparison()
}

// 初始化函数
function initializeSmartComparisonManager () {
    try {
        const manager = getSmartComparisonManager()
        manager.initialize()
        debugLog('SmartComparisonManager 全局初始化完成')
        return manager
    } catch (error) {
        debugLog('SmartComparisonManager 全局初始化失败:', error)
        throw error
    }
}

// 导出到全局作用域
window.SmartComparisonManager = SmartComparisonManager
window.getSmartComparisonManager = getSmartComparisonManager
window.initializeSmartComparisonManager = initializeSmartComparisonManager

// 兼容性函数导出
window.triggerSmartComparisonWithFallback = triggerSmartComparisonWithFallback
window.triggerSmartComparison = triggerSmartComparison

debugLog('SmartComparisonManager 模块加载完成')