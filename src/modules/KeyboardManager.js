/**
 * 键盘管理器模块
 * 负责所有快捷键处理和事件管理，统一键盘交互逻辑
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
    window.debugLog = function (message, data) {
        console.log('[KeyboardManager]', message, data || '')
    }
}

class KeyboardManager {
    constructor() {
        this.initialized = false
        this.keyHandlers = new Map()
        this.isEnabled = true
        this.f1Manager = new F1BatchManager()
        this.escapeManager = new EscapeKeyManager()

        // A键文件上传相关属性
        this.fileInputMonitoringActive = false
        this.fileInputObserver = null
        this.fileCheckInterval = null
    }

    isInitialized () {
        return this.initialized
    }

    initialize () {
        try {
            debugLog('初始化 KeyboardManager')
            this.setupKeyHandlers()
            this.bindEventListeners()
            this.initialized = true
            debugLog('KeyboardManager 初始化完成')
        } catch (error) {
            debugLog('KeyboardManager 初始化失败:', error)
            throw error
        }
    }

    // 设置所有快捷键处理器
    setupKeyHandlers () {
        // D键 - 下载图片
        this.keyHandlers.set('d', {
            description: '下载图片',
            closeModal: true,
            handler: (event) => this.handleDownloadKey(event)
        })

        // Space键 - 跳过
        this.keyHandlers.set('space', {
            description: '跳过',
            closeModal: false, // 继续执行跳过功能
            handler: (event) => this.handleSkipKey(event)
        })

        // S键 - 提交
        this.keyHandlers.set('s', {
            description: '提交并继续标注',
            closeModal: false,
            handler: (event) => this.handleSubmitKey(event)
        })

        // A键 - 上传图片
        this.keyHandlers.set('a', {
            description: '上传图片',
            closeModal: false,
            handler: (event) => this.handleUploadKey(event)
        })

        // F键 - 查看历史
        this.keyHandlers.set('f', {
            description: '查看历史',
            closeModal: false,
            handler: (event) => this.handleHistoryKey(event)
        })

        // X键 - 标记无效
        this.keyHandlers.set('x', {
            description: '标记无效',
            closeModal: true,
            handler: (event) => this.handleInvalidKey(event)
        })

        // R键 - RunningHub尺寸检查
        this.keyHandlers.set('r', {
            description: 'RunningHub尺寸检查',
            closeModal: false,
            handler: (event) => this.handleRunningHubKey(event)
        })

        // F1键 - 批量标记无效
        this.keyHandlers.set('f1', {
            description: '批量标记无效',
            closeModal: true,
            handler: (event) => this.handleF1Key(event)
        })

        // F2键 - 智能尺寸检查
        this.keyHandlers.set('f2', {
            description: '智能尺寸检查',
            closeModal: false,
            handler: (event) => this.handleF2Key(event)
        })

        // N键 - 重新检测原图
        this.keyHandlers.set('n', {
            description: '重新检测原图',
            closeModal: false,
            handler: (event) => this.handleDetectKey(event)
        })

        // P键 - 智能尺寸检查
        this.keyHandlers.set('p', {
            description: '智能尺寸检查',
            closeModal: false,
            handler: (event) => this.handlePKey(event)
        })

        // W键 - 智能图片对比
        this.keyHandlers.set('w', {
            description: '智能图片对比',
            closeModal: false,
            handler: (event) => this.handleSmartComparisonKey(event)
        })
    }

    // 绑定事件监听器
    bindEventListeners () {
        document.addEventListener('keydown', (event) => this.handleKeydown(event))
        debugLog('键盘事件监听器已绑定')
    }

    // 主键盘事件处理器
    handleKeydown (event) {
        if (!this.isEnabled) return

        // 检查是否在输入框中
        if (this.isInInputField(event.target)) {
            return // 在输入框中，不处理快捷键
        }

        // 处理特殊键
        if (event.key === 'F1') {
            return this.keyHandlers.get('f1').handler(event)
        } else if (event.key === 'F2') {
            return this.keyHandlers.get('f2').handler(event)
        } else if (event.code === 'Space') {
            return this.keyHandlers.get('space').handler(event)
        }

        // 处理普通字母键
        const key = event.key.toLowerCase()
        const keyHandler = this.keyHandlers.get(key)

        if (keyHandler) {
            // 检查是否需要关闭模态框
            if (keyHandler.closeModal && typeof checkAndCloseModalIfOpen === 'function') {
                if (checkAndCloseModalIfOpen(key)) {
                    return // 如果关闭了模态框，停止执行
                }
            }

            return keyHandler.handler(event)
        }
    }

    // 检查是否在输入字段中
    isInInputField (element) {
        if (!element) return false

        const tagName = element.tagName.toLowerCase()
        const type = element.type?.toLowerCase()

        return (
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            element.contentEditable === 'true' ||
            element.isContentEditable ||
            (tagName === 'input' && ['text', 'password', 'email', 'search', 'url', 'tel'].includes(type))
        )
    }

    // D键处理 - 下载图片
    handleDownloadKey (event) {
        event.preventDefault()

        // 获取要下载的图片
        const imageToDownload = typeof getImageToDownload === 'function' ? getImageToDownload() : null

        if (imageToDownload && typeof downloadImage === 'function') {
            downloadImage(imageToDownload)
        } else {
            console.log('没有找到可下载的图片')
            if (typeof showNotification === 'function') {
                showNotification('请先鼠标悬停在图片上，然后按D键下载')
            }
        }
    }

    // Space键处理 - 跳过
    handleSkipKey (event) {
        // 检查并关闭模态框（但不停止执行）
        if (typeof checkAndCloseModalIfOpen === 'function') {
            checkAndCloseModalIfOpen('space')
        }

        // 如果对比页面打开，先关闭对比
        if (window.isComparisonModalOpen && typeof closeComparisonModal === 'function') {
            closeComparisonModal()
            // 延迟执行跳过功能
            setTimeout(() => {
                this.executeSkipAction(event)
            }, 100)
        } else {
            this.executeSkipAction(event)
        }
    }

    executeSkipAction (event) {
        const skipButton = typeof findButtonByText === 'function' ?
            findButtonByText(['跳过', 'Skip', '跳過']) : null

        if (skipButton && typeof clickButton === 'function') {
            event.preventDefault()
            clickButton(skipButton, '跳过')
        }
    }

    // S键处理 - 提交
    handleSubmitKey (event) {
        // 检查并关闭模态框（但不停止执行）
        if (typeof checkAndCloseModalIfOpen === 'function') {
            checkAndCloseModalIfOpen('s')
        }

        // 如果对比页面打开，先关闭对比
        if (window.isComparisonModalOpen && typeof closeComparisonModal === 'function') {
            closeComparisonModal()
            setTimeout(() => {
                this.executeSubmitAction(event)
            }, 100)
        } else {
            this.executeSubmitAction(event)
        }
    }

    executeSubmitAction (event) {
        const submitButton = typeof findButtonByText === 'function' ?
            findButtonByText(['提交并继续标注', '提交', 'Submit', '继续标注', 'Continue']) : null

        if (submitButton && typeof clickButton === 'function') {
            event.preventDefault()
            // 播放音效
            if (typeof playNotificationSound === 'function') {
                playNotificationSound()
            }
            clickButton(submitButton, '提交并继续标注')
        }
    }

    // A键处理 - 上传图片（委托给UploadManager）
    handleUploadKey (event) {
        event.preventDefault()

        // 检查并关闭模态框
        if (typeof checkAndCloseModalIfOpen === 'function') {
            checkAndCloseModalIfOpen('a')
        }

        // 如果对比页面打开，先关闭对比
        if (window.isComparisonModalOpen && typeof closeComparisonModal === 'function') {
            closeComparisonModal()
            setTimeout(() => {
                this.executeUploadAction()
            }, 100)
        } else {
            this.executeUploadAction()
        }
    }

    executeUploadAction () {
        // 使用UploadManager处理图片上传
        if (typeof getUploadManager === 'function') {
            const manager = getUploadManager()
            if (!manager.isInitialized()) {
                manager.initialize()
            }
            manager.triggerImageUpload()
        } else if (typeof triggerImageUpload === 'function') {
            // 回退到全局函数（兼容性）
            triggerImageUpload()
        } else {
            // 最终回退到原有逻辑
            this.executeUploadActionLegacy()
        }
    }

    // 保留原有逻辑作为最终回退方案
    executeUploadActionLegacy () {
        debugLog('A键触发 - 上传图片功能（回退模式）')

        // 首先尝试查找上传按钮
        const uploadButton = typeof findButtonByText === 'function' ?
            findButtonByText(['上传图片', '上传', 'Upload', '选择图片', '选择文件', '浏览', 'Browse', 'Choose File']) : null

        if (uploadButton && typeof clickButton === 'function') {
            debugLog('找到上传按钮，点击触发上传')
            clickButton(uploadButton, '上传图片')

            // 启动文件输入监听
            setTimeout(() => {
                this.startFileInputMonitoring()
            }, 200)

        } else {
            // 如果没有找到按钮，直接查找文件输入框
            debugLog('未找到上传按钮，直接查找文件输入框')
            this.findAndTriggerFileInput()
        }
    }

    // 查找并触发文件输入框
    findAndTriggerFileInput () {
        // 查找可见的文件输入框
        let fileInput = document.querySelector('input[type="file"]:not([style*="display: none"]):not([style*="visibility: hidden"])')

        if (!fileInput) {
            // 查找所有文件输入框（包括隐藏的）
            const allFileInputs = document.querySelectorAll('input[type="file"]')
            debugLog('查找到的文件输入框数量:', allFileInputs.length)

            if (allFileInputs.length > 0) {
                fileInput = allFileInputs[allFileInputs.length - 1] // 使用最新的
                debugLog('使用隐藏的文件输入框')
            }
        }

        if (fileInput) {
            debugLog('找到文件输入框，触发点击')
            // 触发文件选择对话框
            fileInput.click()

            // 启动文件输入监听
            this.startFileInputMonitoring()

            if (typeof showNotification === 'function') {
                showNotification('已触发文件选择对话框', 1500)
            }
        } else {
            debugLog('未找到任何文件输入框')
            if (typeof showNotification === 'function') {
                showNotification('未找到上传功能，请手动操作', 2000)
            }
        }
    }

    // 启动文件输入监听（完整原版复刻）
    startFileInputMonitoring () {
        if (this.fileInputMonitoringActive) {
            debugLog('文件输入监听已激活，跳过重复启动')
            return
        }

        this.fileInputMonitoringActive = true
        debugLog('启动文件输入监听系统')

        // 监听现有的文件输入框
        this.observeExistingFileInputs()

        // 监听动态添加的文件输入框
        this.observeDynamicFileInputs()

        // 定期检查文件输入变化
        this.startPeriodicFileCheck()

        // 5秒后停止监听（避免长期占用资源）
        setTimeout(() => {
            this.stopFileInputMonitoring()
        }, 5000)
    }

    // 监听现有文件输入框
    observeExistingFileInputs () {
        const fileInputs = document.querySelectorAll('input[type="file"]')
        debugLog('为现有文件输入框添加监听器，数量:', fileInputs.length)

        fileInputs.forEach((input, index) => {
            this.addFileInputListener(input, index)
        })
    }

    // 为文件输入框添加监听器
    addFileInputListener (input, index) {
        debugLog(`为文件输入框 #${index} 添加监听器`, {
            id: input.id || '无ID',
            name: input.name || '无name',
            className: input.className || '无class'
        })

        // 添加多种事件监听
        const events = ['change', 'input', 'blur']
        events.forEach(eventType => {
            input.addEventListener(eventType, (event) => {
                this.handleFileInputEvent(event, eventType, input)
            })
        })

        // 添加焦点和点击监听
        input.addEventListener('focus', () => {
            debugLog('文件输入框获得焦点')
        })

        input.addEventListener('click', () => {
            debugLog('文件输入框被点击')
            // 点击后延迟检查文件
            setTimeout(() => {
                this.checkInputFiles(input)
            }, 500)
        })
    }

    // 处理文件输入事件
    handleFileInputEvent (event, eventType, input) {
        const files = event.target.files
        const value = event.target.value

        debugLog(`检测到文件输入${eventType}事件`, {
            eventType: event.type,
            value: value,
            filesLength: files ? files.length : '无files属性'
        })

        if (files && files.length > 0) {
            debugLog('直接获取到文件')
            this.handleFilesFound(files, input)
        } else if (value) {
            // 如果files为空但value有值，尝试延迟获取
            debugLog('files为空但value有值，尝试延迟获取', value)
            setTimeout(() => {
                this.checkInputFiles(input)
            }, 100)
        }
    }

    // 检查输入框文件
    checkInputFiles (input) {
        if (input.files && input.files.length > 0) {
            debugLog('延迟检查发现文件', {
                filesLength: input.files.length
            })
            this.handleFilesFound(input.files, input)
        }
    }

    // 监听动态添加的文件输入框
    observeDynamicFileInputs () {
        if (this.fileInputObserver) {
            this.fileInputObserver.disconnect()
        }

        this.fileInputObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查新添加的元素是否是文件输入
                        if (node.tagName === 'INPUT' && node.type === 'file') {
                            debugLog('发现新的文件输入元素', node)
                            this.addFileInputListener(node, 'new')
                        }

                        // 检查新添加的元素内部是否有文件输入
                        const inputs = node.querySelectorAll && node.querySelectorAll('input[type="file"]')
                        if (inputs && inputs.length > 0) {
                            debugLog('在新元素中发现文件输入', inputs.length)
                            inputs.forEach((input, index) => {
                                this.addFileInputListener(input, `new-${index}`)
                            })
                        }
                    }
                })
            })
        })

        this.fileInputObserver.observe(document.body, {
            childList: true,
            subtree: true
        })

        debugLog('文件输入动态监听已启动')
    }

    // 定期检查文件输入变化
    startPeriodicFileCheck () {
        this.fileCheckInterval = setInterval(() => {
            this.checkAllFileInputs()
        }, 500)

        debugLog('定期文件检查已启动')
    }

    // 检查所有文件输入框
    checkAllFileInputs () {
        const allInputs = document.querySelectorAll('input[type="file"]')

        allInputs.forEach((input, index) => {
            if (input.files && input.files.length > 0) {
                debugLog(`文件输入 #${index} 有文件，开始处理`)
                this.handleFilesFound(input.files, input)
            }
        })
    }

    // 处理找到的文件（完整原版复刻）
    handleFilesFound (files, input) {
        debugLog('开始处理找到的文件', {
            fileCount: files.length,
            files: Array.from(files).map(f => ({
                name: f.name,
                type: f.type,
                size: f.size
            }))
        })

        // 停止监听（已找到文件）
        this.stopFileInputMonitoring()

        // 处理每个文件
        Array.from(files).forEach((file, index) => {
            if (file.type.startsWith('image/')) {
                debugLog('确认为图片文件，开始处理上传')
                this.handleImageUpload(file, input)
            } else {
                debugLog('非图片文件，跳过处理', {
                    fileName: file.name,
                    fileType: file.type
                })
            }
        })
    }

    // 处理图片上传（完整原版复刻）
    handleImageUpload (file, inputElement) {
        debugLog('开始处理图片上传', {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            inputId: inputElement ? inputElement.id : '无输入框'
        })

        // 显示上传通知
        if (typeof showNotification === 'function') {
            showNotification(`正在处理上传图片: ${file.name}`, 2000)
        }

        // 创建图片对象用于预览和处理
        const reader = new FileReader()
        reader.onload = (e) => {
            const imageDataUrl = e.target.result

            // 创建图片元素
            const img = new Image()
            img.onload = () => {
                debugLog('上传图片加载完成', {
                    width: img.width,
                    height: img.height,
                    fileName: file.name
                })

                // 存储上传的图片信息
                window.uploadedImage = {
                    src: imageDataUrl,
                    width: img.width,
                    height: img.height,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    file: file
                }

                // 设置自动对比标志
                window.shouldAutoCompare = true

                // 显示成功通知
                if (typeof showNotification === 'function') {
                    showNotification(`✅ 图片上传成功: ${file.name} (${img.width}×${img.height})`, 3000)
                }

                // 如果启用了自动对比，触发智能对比
                if (window.autoCompareEnabled && typeof performImageComparison === 'function') {
                    debugLog('自动对比已启用，延迟触发智能对比')
                    setTimeout(() => {
                        performImageComparison()
                    }, 1000)
                }

                // 播放音效
                if (typeof playNotificationSound === 'function') {
                    playNotificationSound()
                }
            }

            img.onerror = () => {
                debugLog('上传图片加载失败')
                if (typeof showNotification === 'function') {
                    showNotification('图片加载失败，请检查文件格式', 2000)
                }
            }

            img.src = imageDataUrl
        }

        reader.onerror = () => {
            debugLog('文件读取失败')
            if (typeof showNotification === 'function') {
                showNotification('文件读取失败，请重试', 2000)
            }
        }

        reader.readAsDataURL(file)
    }

    // 停止文件输入监听
    stopFileInputMonitoring () {
        if (!this.fileInputMonitoringActive) {
            return
        }

        this.fileInputMonitoringActive = false

        // 停止定期检查
        if (this.fileCheckInterval) {
            clearInterval(this.fileCheckInterval)
            this.fileCheckInterval = null
        }

        // 停止动态监听
        if (this.fileInputObserver) {
            this.fileInputObserver.disconnect()
            this.fileInputObserver = null
        }

        debugLog('文件输入监听已停止')
    }

    // F键处理 - 查看历史
    handleHistoryKey (event) {
        // 检查并关闭模态框
        if (typeof checkAndCloseModalIfOpen === 'function') {
            checkAndCloseModalIfOpen('f')
        }

        const historyLink = typeof findLinkByText === 'function' ?
            findLinkByText(['点击查看历史', '查看历史', '历史', 'History', '历史记录', '查看记录']) : null

        if (historyLink && typeof clickLink === 'function') {
            event.preventDefault()
            clickLink(historyLink, '查看历史')
        } else if (typeof showNotification === 'function') {
            showNotification('未找到查看历史链接')
        }
    }

    // X键处理 - 标记无效
    handleInvalidKey (event) {
        // 如果对比页面打开，先关闭对比
        if (window.isComparisonModalOpen && typeof closeComparisonModal === 'function') {
            closeComparisonModal()
            setTimeout(() => {
                this.executeInvalidAction(event)
            }, 100)
        } else {
            this.executeInvalidAction(event)
        }
    }

    executeInvalidAction (event) {
        const invalidButton = typeof findButtonByText === 'function' ?
            findButtonByText(['标记无效', '无效', 'Invalid', '标记为无效', 'Mark Invalid', '标记不合格']) : null

        if (invalidButton && typeof clickButton === 'function') {
            event.preventDefault()
            clickButton(invalidButton, '标记无效')
            // 尝试自动确认可能弹出的模态框
            if (typeof autoConfirmModalAfterAction === 'function') {
                autoConfirmModalAfterAction()
            }
        } else if (typeof showNotification === 'function') {
            showNotification('未找到标记无效按钮')
        }
    }

    // R键处理 - RunningHub尺寸检查
    handleRunningHubKey (event) {
        event.preventDefault()
        debugLog('R键触发 - 手动检查图片尺寸是否为8的倍数')

        if (typeof manualDimensionCheck === 'function') {
            manualDimensionCheck()
        } else {
            debugLog('manualDimensionCheck 函数不可用')
        }
    }

    // F1键处理 - 批量标记无效
    handleF1Key (event) {
        event.preventDefault()
        this.f1Manager.toggleBatchInvalid()
    }

    // F2键处理 - 智能尺寸检查
    handleF2Key (event) {
        event.preventDefault()
        debugLog('F2键触发 - 检查图片尺寸')

        if (typeof checkImageDimensionsAndShowModal === 'function') {
            checkImageDimensionsAndShowModal()
        } else {
            debugLog('checkImageDimensionsAndShowModal 函数不可用')
        }
    }

    // N键处理 - 重新检测原图
    handleDetectKey (event) {
        if (typeof recordOriginalImages === 'function') {
            event.preventDefault()
            recordOriginalImages()
            if (typeof showNotification === 'function') {
                showNotification('已重新检测原图，查看调试面板', 2000)
            }
        }
    }

    // P键处理 - 智能尺寸检查
    handlePKey (event) {
        if (typeof checkImageDimensionsAndShowModal === 'function') {
            event.preventDefault()
            checkImageDimensionsAndShowModal()
        }
    }

    // W键处理 - 智能图片对比
    handleSmartComparisonKey (event) {
        event.preventDefault()

        // 使用SmartComparisonManager处理智能对比
        if (typeof getSmartComparisonManager === 'function') {
            const manager = getSmartComparisonManager()
            if (!manager.isInitialized()) {
                manager.initialize()
            }
            manager.triggerSmartComparisonWithFallback()
        } else if (typeof triggerSmartComparisonWithFallback === 'function') {
            // 回退到全局函数（兼容性）
            triggerSmartComparisonWithFallback()
        } else {
            console.warn('W键智能对比功能不可用：SmartComparisonManager 或 triggerSmartComparisonWithFallback 函数未找到')
        }
    }

    // 启用/禁用键盘管理器
    setEnabled (enabled) {
        this.isEnabled = enabled
        debugLog('KeyboardManager', enabled ? '已启用' : '已禁用')
    }

    // 获取所有快捷键信息
    getShortcuts () {
        const shortcuts = []
        for (const [key, config] of this.keyHandlers) {
            shortcuts.push({
                key: key.toUpperCase(),
                description: config.description
            })
        }
        return shortcuts
    }
}

// F1 批量管理器
class F1BatchManager {
    constructor() {
        this.isActive = false
        this.runCount = 0
        this.timerId = null
        this.intervalMs = 800
        this.maxRuns = 0 // 0表示无限制
    }

    toggleBatchInvalid () {
        // 检查并关闭模态框
        if (typeof checkAndCloseModalIfOpen === 'function') {
            if (checkAndCloseModalIfOpen('f1')) {
                return // 如果关闭了模态框，停止执行
            }
        }

        if (!this.isActive) {
            this.startBatchInvalid()
        } else {
            this.stopBatchInvalid()
        }
    }

    startBatchInvalid () {
        this.isActive = true
        this.runCount = 0

        if (typeof showNotification === 'function') {
            showNotification(`F1 连续无效化启动（间隔 ${this.intervalMs}ms）`)
        }

        const runOnce = () => {
            if (!this.isActive) return

            // 检查是否有次数限制且已达到限制
            if (this.maxRuns > 0 && this.runCount >= this.maxRuns) {
                this.isActive = false
                if (typeof showNotification === 'function') {
                    showNotification('F1 连续无效化已达最大次数，自动停止')
                }
                return
            }

            this.runCount++

            // 复用 X 键逻辑：查找"标记无效"并点击
            const invalidButton = typeof findButtonByText === 'function' ?
                findButtonByText(['标记无效', '无效', 'Invalid', '标记为无效', 'Mark Invalid', '标记不合格']) : null

            if (invalidButton && typeof clickButton === 'function') {
                clickButton(invalidButton, `标记无效 (#${this.runCount})`)
                if (typeof autoConfirmModalAfterAction === 'function') {
                    autoConfirmModalAfterAction()
                }
            }

            // 安排下一次
            if (this.isActive) {
                this.timerId = setTimeout(runOnce, this.intervalMs)
            }
        }

        runOnce()
    }

    stopBatchInvalid () {
        this.isActive = false
        if (this.timerId) {
            clearTimeout(this.timerId)
            this.timerId = null
        }
        if (typeof showNotification === 'function') {
            showNotification('F1 连续无效化已停止')
        }
    }

    isRunning () {
        return this.isActive
    }

    setInterval (intervalMs) {
        this.intervalMs = intervalMs
    }

    setMaxRuns (maxRuns) {
        this.maxRuns = maxRuns
    }
}

// Escape键管理器
class EscapeKeyManager {
    constructor() {
        this.handlers = []
    }

    addHandler (handler) {
        this.handlers.push(handler)
    }

    removeHandler (handler) {
        const index = this.handlers.indexOf(handler)
        if (index > -1) {
            this.handlers.splice(index, 1)
        }
    }

    handleEscape (event) {
        // 依次调用所有注册的ESC处理器
        for (const handler of this.handlers) {
            try {
                if (handler(event) === true) {
                    // 如果处理器返回true，表示已处理，停止后续处理器
                    break
                }
            } catch (error) {
                debugLog('ESC处理器执行失败:', error)
            }
        }
    }
}

// 全局实例
let keyboardManagerInstance = null

// 获取全局实例
function getKeyboardManager () {
    if (!keyboardManagerInstance) {
        keyboardManagerInstance = new KeyboardManager()
        // 设置到全局变量以保持兼容性
        window.keyboardManager = keyboardManagerInstance
    }
    return keyboardManagerInstance
}

// 兼容性函数 - 保持向后兼容
function handleKeydown (event) {
    const manager = getKeyboardManager()
    if (!manager.isInitialized()) {
        manager.initialize()
    }
    return manager.handleKeydown(event)
}

function isInInputField (element) {
    const manager = getKeyboardManager()
    return manager.isInInputField(element)
}

// 初始化函数
function initializeKeyboardManager () {
    try {
        const manager = getKeyboardManager()
        manager.initialize()
        debugLog('KeyboardManager 全局初始化完成')
        return manager
    } catch (error) {
        debugLog('KeyboardManager 全局初始化失败:', error)
        throw error
    }
}

// 兼容模式的键盘事件处理（从content.js迁移）
function handleKeydownFallback (event) {
    // 检查是否在输入框中
    if (isInInputField(event.target)) {
        return
    }

    const key = event.key.toLowerCase()

    switch (key) {
        case 'd':
            event.preventDefault()
            handleDownloadImageFallback()
            break
        case ' ':
            event.preventDefault()
            handleSkipButtonFallback()
            break
        case 's':
            event.preventDefault()
            handleSubmitButtonFallback()
            break
        case 'a':
            event.preventDefault()
            handleUploadImageFallback()
            break
        case 'w':
            event.preventDefault()
            handleImageComparisonFallback()
            break
        default:
            // 其他键不处理
            break
    }
}

// 兼容模式处理函数
function handleDownloadImageFallback () {
    if (typeof downloadImage === 'function') {
        const img = getImageToDownloadFallback()
        if (img) {
            downloadImage(img)
        } else {
            if (typeof showNotification === 'function') {
                showNotification('未找到可下载的图片', 2000)
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('下载功能不可用', 2000)
        }
    }
}

function getImageToDownloadFallback () {
    // 如果 ImageHelper 可用，使用它
    if (typeof getImageHelper === 'function') {
        const imageHelper = getImageHelper()
        return imageHelper.getImageToDownload()
    }

    // 兼容模式：简单查找图片
    const images = document.querySelectorAll('img')
    for (const img of images) {
        if (img.naturalWidth > 100 && img.naturalHeight > 100) {
            return img
        }
    }

    return null
}

function handleSkipButtonFallback () {
    if (typeof findButtonByText === 'function') {
        const skipButton = findButtonByText(['跳过', 'Skip', '下一个', 'Next'])
        if (skipButton) {
            skipButton.click()
            if (typeof showNotification === 'function') {
                showNotification('已点击跳过按钮', 1000)
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification('未找到跳过按钮', 2000)
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('按钮查找功能不可用', 2000)
        }
    }
}

function handleSubmitButtonFallback () {
    if (typeof findButtonByText === 'function') {
        const submitButton = findButtonByText(['提交', 'Submit', '提交并继续标注', '继续'])
        if (submitButton) {
            submitButton.click()
            if (typeof showNotification === 'function') {
                showNotification('已点击提交按钮', 1000)
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification('未找到提交按钮', 2000)
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('按钮查找功能不可用', 2000)
        }
    }
}

function handleUploadImageFallback () {
    debugLog('A键兼容模式 - 上传图片功能')

    if (typeof findButtonByText === 'function') {
        const uploadButton = findButtonByText(['上传图片', '上传', 'Upload', '选择图片', '选择文件', '浏览', 'Browse', 'Choose File'])
        if (uploadButton) {
            uploadButton.click()
            if (typeof showNotification === 'function') {
                showNotification('已触发上传功能', 1000)
            }

            // 启动简化的文件监听
            setTimeout(() => {
                startSimpleFileMonitoring()
            }, 200)

        } else {
            // 直接查找文件输入框
            const fileInput = document.querySelector('input[type="file"]')
            if (fileInput) {
                fileInput.click()
                if (typeof showNotification === 'function') {
                    showNotification('已触发文件选择', 1000)
                }

                // 启动简化的文件监听
                setTimeout(() => {
                    startSimpleFileMonitoring()
                }, 200)
            } else {
                if (typeof showNotification === 'function') {
                    showNotification('未找到上传按钮或文件输入框', 2000)
                }
            }
        }
    } else {
        if (typeof showNotification === 'function') {
            showNotification('上传功能不可用', 2000)
        }
    }
}

// 简化的文件监听（兼容模式）
function startSimpleFileMonitoring () {
    debugLog('启动简化文件监听')

    let monitoringActive = true

    // 监听现有文件输入框
    const fileInputs = document.querySelectorAll('input[type="file"]')
    fileInputs.forEach(input => {
        input.addEventListener('change', (event) => {
            if (monitoringActive && event.target.files && event.target.files.length > 0) {
                debugLog('检测到文件选择')
                handleSimpleFileUpload(event.target.files[0])
                monitoringActive = false
            }
        })
    })

    // 5秒后停止监听
    setTimeout(() => {
        monitoringActive = false
        debugLog('简化文件监听已停止')
    }, 5000)
}

// 简化的文件上传处理
function handleSimpleFileUpload (file) {
    if (!file.type.startsWith('image/')) {
        debugLog('非图片文件，跳过处理')
        return
    }

    debugLog('处理上传的图片文件', {
        name: file.name,
        type: file.type,
        size: file.size
    })

    if (typeof showNotification === 'function') {
        showNotification(`图片已选择: ${file.name}`, 2000)
    }

    // 存储上传图片信息（简化版）
    const reader = new FileReader()
    reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
            window.uploadedImage = {
                src: e.target.result,
                width: img.width,
                height: img.height,
                name: file.name,
                type: file.type,
                size: file.size,
                file: file
            }

            window.shouldAutoCompare = true

            if (typeof showNotification === 'function') {
                showNotification(`✅ 图片处理完成: ${file.name} (${img.width}×${img.height})`, 3000)
            }
        }
        img.src = e.target.result
    }
    reader.readAsDataURL(file)
}

function handleImageComparisonFallback () {
    if (typeof performImageComparison === 'function') {
        performImageComparison()
    } else {
        if (typeof showNotification === 'function') {
            showNotification('图片对比功能不可用', 2000)
        }
    }
}

// 导出到全局作用域
window.KeyboardManager = KeyboardManager
window.getKeyboardManager = getKeyboardManager
window.initializeKeyboardManager = initializeKeyboardManager

// 兼容性函数导出
window.handleKeydown = handleKeydown
window.isInInputField = isInInputField
window.handleKeydownFallback = handleKeydownFallback

debugLog('KeyboardManager 模块加载完成')