/**
 * 图片上传管理器
 * 负责A键触发的图片上传功能，包括文件监听、图片处理和自动触发对比
 * 完美复刻原版功能
 */

// 确保 debugLog 函数可用
if (typeof debugLog === 'undefined') {
  window.debugLog = function (message, data) {
    console.log('[UploadManager]', message, data || '')
  }
}

class UploadManager {
  constructor() {
    this.initialized = false
    this.fileInputMonitoringActive = false
    this.fileInputObserver = null
    this.fileCheckInterval = null
    this.pendingComparisonTimeouts = []
  }

  isInitialized () {
    return this.initialized
  }

  initialize () {
    try {
      debugLog('初始化 UploadManager')
      this.initialized = true
      debugLog('UploadManager 初始化完成')
    } catch (error) {
      debugLog('UploadManager 初始化失败:', error)
      throw error
    }
  }

  // A键主入口：触发图片上传
  triggerImageUpload () {
    debugLog('A键触发 - 图片上传功能')

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

  // 处理图片上传（完整原版复刻，包含自动对比逻辑）
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

        // 存储上传的图片信息（完全复刻原版结构）
        window.uploadedImage = {
          src: imageDataUrl,
          width: img.width,
          height: img.height,
          name: file.name,
          type: file.type,
          size: file.size,
          file: file,
          element: inputElement  // 原版包含的字段
        }

        // 设置自动对比标志（关键：触发自动对比的核心机制）
        window.shouldAutoCompare = true

        // 在上传图片时执行B键逻辑，重新检测原图，防止找不到原图（原版重要特性）
        debugLog('上传图片时自动重新检测原图（执行B键逻辑）')
        this.redetectOriginalImage()

        // 显示成功通知
        if (typeof showNotification === 'function') {
          showNotification(`✅ 图片上传成功: ${file.name} (${img.width}×${img.height})`, 3000)
        }

        // 更新调试面板信息（如果存在）
        if (window.debugMode && window.debugPanel && typeof updateDebugInfo === 'function') {
          updateDebugInfo()
        }

        // 设置延迟对比任务（原版核心逻辑：延迟1秒执行自动对比）
        this.scheduleAutoComparison()

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

  // 重新检测原图（复刻原版B键逻辑）
  redetectOriginalImage () {
    // 解锁原图锁定状态
    if (window.originalImageLocked !== undefined) {
      window.originalImageLocked = false
    }
    if (window.originalImage !== undefined) {
      window.originalImage = null
    }

    // 调用原图检测功能
    if (typeof recordOriginalImages === 'function') {
      recordOriginalImages()
    } else if (typeof window.getOriginalImageDetector === 'function') {
      const detector = window.getOriginalImageDetector()
      if (detector && typeof detector.detectOriginalImage === 'function') {
        detector.detectOriginalImage()
      }
    }

    debugLog('已重新检测原图')
  }

  // 安排自动对比任务（完整复刻原版延迟对比逻辑）
  scheduleAutoComparison () {
    debugLog('设置延迟对比任务')

    const timeoutId = setTimeout(() => {
      debugLog('延迟执行图片对比', {
        currentUrl: window.location.href.substring(0, 50) + '...',
        hasOriginal: !!window.originalImage,
        hasUploaded: !!window.uploadedImage,
        shouldAutoCompare: window.shouldAutoCompare
      })

      // 从待执行列表中移除
      const index = this.pendingComparisonTimeouts.indexOf(timeoutId)
      if (index > -1) {
        this.pendingComparisonTimeouts.splice(index, 1)
      }

      // 只有在应该自动对比且开关开启时才执行（即用户刚上传了图片）
      if (window.shouldAutoCompare && window.autoCompareEnabled) {
        debugLog('用户上传图片触发的自动对比')
        window.shouldAutoCompare = false // 重置标记，避免重复触发
        this.performImageComparison()
      } else if (window.shouldAutoCompare && !window.autoCompareEnabled) {
        debugLog('跳过自动对比 - 自动对比功能已关闭')
        window.shouldAutoCompare = false // 重置标记
      } else {
        debugLog('跳过自动对比 - 非用户上传触发')
      }
    }, 1000) // 原版使用1秒延迟

    // 记录待执行的任务
    this.pendingComparisonTimeouts.push(timeoutId)
    debugLog('已添加延迟对比任务', {
      timeoutId: timeoutId,
      totalPending: this.pendingComparisonTimeouts.length
    })
  }

  // 执行图片对比（调用已有的对比功能）
  performImageComparison () {
    // 优先使用新的SmartComparisonManager
    if (typeof window.getSmartComparisonManager === 'function') {
      const smartManager = window.getSmartComparisonManager()
      if (smartManager && typeof smartManager.triggerSmartComparisonWithFallback === 'function') {
        debugLog('使用SmartComparisonManager执行智能对比')
        smartManager.triggerSmartComparisonWithFallback()
        return
      }
    }

    // 回退到传统对比功能
    if (typeof performImageComparison === 'function') {
      debugLog('使用传统performImageComparison执行对比')
      performImageComparison()
    } else if (typeof triggerSmartComparisonWithFallback === 'function') {
      debugLog('使用triggerSmartComparisonWithFallback执行对比')
      triggerSmartComparisonWithFallback()
    } else {
      debugLog('未找到可用的图片对比功能')
      if (typeof showNotification === 'function') {
        showNotification('图片对比功能不可用', 2000)
      }
    }
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

  // 清理所有待执行的对比任务
  clearPendingComparisonTasks () {
    debugLog('清理待执行的对比任务', { count: this.pendingComparisonTimeouts.length })
    this.pendingComparisonTimeouts.forEach(timeoutId => {
      try {
        clearTimeout(timeoutId)
      } catch (e) { }
    })
    this.pendingComparisonTimeouts = []
  }

  // 获取当前状态
  getStatus () {
    return {
      initialized: this.initialized,
      fileInputMonitoringActive: this.fileInputMonitoringActive,
      pendingComparisonTasks: this.pendingComparisonTimeouts.length,
      hasUploadedImage: !!window.uploadedImage,
      shouldAutoCompare: !!window.shouldAutoCompare
    }
  }

  // 清理所有状态
  cleanup () {
    this.stopFileInputMonitoring()
    this.clearPendingComparisonTasks()
    debugLog('UploadManager 已清理')
  }
}

// 全局实例
let uploadManagerInstance = null

// 获取全局实例
function getUploadManager () {
  if (!uploadManagerInstance) {
    uploadManagerInstance = new UploadManager()
    // 设置到全局变量以保持兼容性
    window.uploadManager = uploadManagerInstance
  }
  return uploadManagerInstance
}

// 初始化函数
function initializeUploadManager () {
  try {
    const manager = getUploadManager()
    manager.initialize()
    debugLog('UploadManager 全局初始化完成')
    return manager
  } catch (error) {
    debugLog('UploadManager 全局初始化失败:', error)
    throw error
  }
}

// 兼容性函数 - 直接触发上传
function triggerImageUpload () {
  const manager = getUploadManager()
  if (!manager.isInitialized()) {
    manager.initialize()
  }
  return manager.triggerImageUpload()
}

// 导出到全局作用域
window.UploadManager = UploadManager
window.getUploadManager = getUploadManager
window.initializeUploadManager = initializeUploadManager
window.triggerImageUpload = triggerImageUpload

debugLog('UploadManager 模块加载完成')