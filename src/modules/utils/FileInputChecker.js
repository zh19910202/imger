/**
 * 文件输入检查器
 * 保持原有的I键文件输入检查逻辑完全不变
 */
window.FileInputChecker = class FileInputChecker {
    constructor(stateManager, notificationManager) {
        this.stateManager = stateManager;
        this.notificationManager = notificationManager;

        this.initializeGlobalFunctions();
    }

    /**
     * 初始化全局函数 - 保持原有的函数名不变
     */
    initializeGlobalFunctions() {
        // 将函数挂载到window对象，保持原有调用方式
        window.checkForFileInputChanges = this.checkForFileInputChanges.bind(this);
    }

    /**
     * 检查文件输入变化 - 原逻辑保持不变
     */
    checkForFileInputChanges() {
        window.Logger.debugLog('检查文件输入变化');

        const allInputs = document.querySelectorAll('input[type="file"]');
        window.Logger.debugLog('当前文件输入总数', allInputs.length);

        allInputs.forEach((input, index) => {
            window.Logger.debugLog(`文件输入 #${index} 状态`, {
                hasFiles: input.files && input.files.length > 0,
                filesCount: input.files ? input.files.length : 0,
                value: input.value,
                accept: input.accept,
                multiple: input.multiple,
                disabled: input.disabled,
                style: input.style.display
            });

            // 如果有文件被选中，显示详细信息
            if (input.files && input.files.length > 0) {
                for (let i = 0; i < input.files.length; i++) {
                    const file = input.files[i];
                    window.Logger.debugLog(`  文件 #${i}`, {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: new Date(file.lastModified).toLocaleString()
                    });
                }
            }
        });

        // 检查是否有隐藏的文件输入
        const hiddenInputs = Array.from(allInputs).filter(input => {
            const style = window.getComputedStyle(input);
            return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
        });

        if (hiddenInputs.length > 0) {
            window.Logger.debugLog(`发现 ${hiddenInputs.length} 个隐藏的文件输入`);
        }

        // 检查最近上传的图片
        this.checkRecentImageUploads();

        return {
            totalInputs: allInputs.length,
            hiddenInputs: hiddenInputs.length,
            inputsWithFiles: Array.from(allInputs).filter(input => input.files && input.files.length > 0).length
        };
    }

    /**
     * 检查最近上传的图片
     */
    checkRecentImageUploads() {
        // 检查页面上是否有新的图片元素（可能是上传后生成的）
        const images = document.querySelectorAll('img');
        const recentImages = [];

        images.forEach(img => {
            // 检查是否是blob URL或data URL（通常是刚上传的图片）
            if (img.src.startsWith('blob:') || img.src.startsWith('data:')) {
                recentImages.push({
                    src: img.src.substring(0, 50) + '...',
                    alt: img.alt,
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height
                });
            }
        });

        if (recentImages.length > 0) {
            window.Logger.debugLog('发现最近上传的图片', recentImages);

            // 更新状态
            if (recentImages.length > 0) {
                this.stateManager.set('uploadedImage', {
                    src: recentImages[0].src,
                    width: recentImages[0].width,
                    height: recentImages[0].height
                });
            }
        }
    }

    /**
     * 监听文件输入变化
     */
    startMonitoring() {
        // 监听文件输入变化事件
        document.addEventListener('change', (event) => {
            if (event.target.type === 'file') {
                window.Logger.debugLog('检测到文件输入变化', {
                    filesCount: event.target.files.length,
                    inputId: event.target.id,
                    inputName: event.target.name
                });

                // 自动检查文件输入状态
                setTimeout(() => {
                    this.checkForFileInputChanges();
                }, 100);
            }
        });

        window.Logger.debugLog('文件输入监听器已启动');
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        const result = this.checkForFileInputChanges();
        return {
            ...result,
            isMonitoring: true
        };
    }
}