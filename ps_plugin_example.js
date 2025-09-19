// PS插件示例代码 - CEP/UXP环境
// 这个文件展示了如何在Photoshop插件中与Chrome扩展通信

/**
 * PS插件主类
 */
class PSChromeIntegration {
    constructor() {
        this.apiBaseUrl = 'http://localhost:8888';
        this.timeout = 30000; // 30秒超时
    }

    /**
     * 发送数据到Chrome扩展进行处理
     * @param {string} textData - 文本数据
     * @param {string} imageData - Base64编码的图片数据
     * @param {Object} metadata - 元数据
     * @returns {Promise<Object>} 处理结果
     */
    async sendToChrome(textData, imageData = null, metadata = {}) {
        try {
            const requestData = {
                action: 'process_data',
                text_data: textData || '',
                image_data: imageData || '',
                metadata: {
                    timestamp: Date.now(),
                    source: 'photoshop',
                    ps_version: app.version,
                    ...metadata
                }
            };

            console.log('发送请求到Chrome扩展:', {
                text_length: textData?.length || 0,
                has_image: !!imageData,
                metadata
            });

            const response = await fetch(`${this.apiBaseUrl}/api/process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('收到Chrome扩展响应:', result);

            return result;

        } catch (error) {
            console.error('与Chrome扩展通信失败:', error);
            throw error;
        }
    }

    /**
     * 检查Chrome扩展连接状态
     * @returns {Promise<boolean>} 连接状态
     */
    async checkConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                const health = await response.json();
                console.log('Chrome扩展状态:', health);
                return health.status === 'healthy';
            }
            return false;
        } catch (error) {
            console.error('检查连接失败:', error);
            return false;
        }
    }

    /**
     * 获取当前活动文档的图片数据
     * @param {string} format - 图片格式 ('png', 'jpg')
     * @param {number} quality - 图片质量 (1-100)
     * @returns {Promise<string>} Base64编码的图片数据
     */
    async getCurrentDocumentImage(format = 'png', quality = 90) {
        try {
            if (!app.activeDocument) {
                throw new Error('没有活动文档');
            }

            // 创建临时文件
            const tempFile = new File(Folder.temp + `/ps_temp_${Date.now()}.${format}`);
            
            // 导出选项
            let exportOptions;
            if (format.toLowerCase() === 'png') {
                exportOptions = new PNGSaveOptions();
                exportOptions.compression = 6;
            } else {
                exportOptions = new JPEGSaveOptions();
                exportOptions.quality = quality;
            }

            // 导出文档
            app.activeDocument.exportDocument(tempFile, ExportType.SAVEFORWEB, exportOptions);

            // 读取文件并转换为Base64
            const base64Data = await this.fileToBase64(tempFile, format);
            
            // 清理临时文件
            if (tempFile.exists) {
                tempFile.remove();
            }

            return base64Data;

        } catch (error) {
            console.error('获取文档图片失败:', error);
            throw error;
        }
    }

    /**
     * 将文件转换为Base64编码
     * @param {File} file - 文件对象
     * @param {string} format - 图片格式
     * @returns {Promise<string>} Base64编码的数据
     */
    async fileToBase64(file, format) {
        return new Promise((resolve, reject) => {
            try {
                file.open('r');
                file.encoding = 'BINARY';
                const data = file.read();
                file.close();

                // 转换为Base64
                const base64 = btoa(data);
                const dataUrl = `data:image/${format};base64,${base64}`;
                
                resolve(dataUrl);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 处理Chrome扩展返回的图片数据
     * @param {string} base64Data - Base64编码的图片数据
     * @param {string} layerName - 新图层名称
     */
    async createLayerFromBase64(base64Data, layerName = 'Chrome处理结果') {
        try {
            if (!app.activeDocument) {
                throw new Error('没有活动文档');
            }

            // 解析Base64数据
            const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
            
            // 创建临时文件
            const tempFile = new File(Folder.temp + `/chrome_result_${Date.now()}.png`);
            
            // 写入Base64数据到文件
            tempFile.open('w');
            tempFile.encoding = 'BINARY';
            tempFile.write(atob(base64Content));
            tempFile.close();

            // 在PS中打开并复制到当前文档
            const resultDoc = app.open(tempFile);
            resultDoc.selection.selectAll();
            resultDoc.selection.copy();
            resultDoc.close(SaveOptions.DONOTSAVECHANGES);

            // 粘贴到当前文档
            app.activeDocument.paste();
            app.activeDocument.activeLayer.name = layerName;

            // 清理临时文件
            if (tempFile.exists) {
                tempFile.remove();
            }

            console.log(`已创建图层: ${layerName}`);

        } catch (error) {
            console.error('创建图层失败:', error);
            throw error;
        }
    }
}

/**
 * 示例使用函数
 */
async function exampleUsage() {
    const integration = new PSChromeIntegration();

    try {
        // 1. 检查连接
        console.log('检查Chrome扩展连接...');
        const isConnected = await integration.checkConnection();
        if (!isConnected) {
            alert('无法连接到Chrome扩展，请确保扩展已安装并运行');
            return;
        }

        // 2. 获取当前文档图片
        console.log('获取当前文档图片...');
        const imageData = await integration.getCurrentDocumentImage('png');

        // 3. 发送到Chrome扩展处理
        console.log('发送到Chrome扩展处理...');
        const result = await integration.sendToChrome(
            '请处理这张图片', 
            imageData,
            {
                operation: 'enhance',
                document_name: app.activeDocument.name,
                document_width: app.activeDocument.width.as('px'),
                document_height: app.activeDocument.height.as('px')
            }
        );

        // 4. 处理结果
        if (result.success) {
            console.log('处理成功:', result.result_data);
            
            // 如果有处理后的图片，创建新图层
            if (result.processed_image) {
                await integration.createLayerFromBase64(
                    result.processed_image, 
                    'Chrome处理结果'
                );
            }

            alert(`处理完成!\n结果: ${result.result_data}`);
        } else {
            alert(`处理失败: ${result.error}`);
        }

    } catch (error) {
        console.error('操作失败:', error);
        alert(`操作失败: ${error.message}`);
    }
}

/**
 * 创建UI面板
 */
function createUI() {
    // CEP面板HTML示例
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Chrome扩展集成</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            button { padding: 10px 20px; margin: 5px; cursor: pointer; }
            .status { margin: 10px 0; padding: 10px; border-radius: 4px; }
            .success { background-color: #d4edda; color: #155724; }
            .error { background-color: #f8d7da; color: #721c24; }
            .info { background-color: #d1ecf1; color: #0c5460; }
        </style>
    </head>
    <body>
        <h2>PS-Chrome扩展集成</h2>
        
        <div id="status" class="status info">
            准备就绪
        </div>
        
        <button onclick="checkConnection()">检查连接</button>
        <button onclick="processCurrentDocument()">处理当前文档</button>
        <button onclick="sendTextOnly()">发送文本</button>
        
        <div id="result" style="margin-top: 20px;"></div>
        
        <script>
            const integration = new PSChromeIntegration();
            
            async function checkConnection() {
                updateStatus('检查连接中...', 'info');
                try {
                    const connected = await integration.checkConnection();
                    if (connected) {
                        updateStatus('连接正常', 'success');
                    } else {
                        updateStatus('连接失败', 'error');
                    }
                } catch (error) {
                    updateStatus('连接错误: ' + error.message, 'error');
                }
            }
            
            async function processCurrentDocument() {
                updateStatus('处理文档中...', 'info');
                try {
                    await exampleUsage();
                    updateStatus('处理完成', 'success');
                } catch (error) {
                    updateStatus('处理失败: ' + error.message, 'error');
                }
            }
            
            async function sendTextOnly() {
                updateStatus('发送文本中...', 'info');
                try {
                    const result = await integration.sendToChrome('这是一个文本测试');
                    if (result.success) {
                        updateStatus('文本处理成功', 'success');
                        document.getElementById('result').innerHTML = 
                            '<strong>结果:</strong> ' + result.result_data;
                    } else {
                        updateStatus('文本处理失败: ' + result.error, 'error');
                    }
                } catch (error) {
                    updateStatus('发送失败: ' + error.message, 'error');
                }
            }
            
            function updateStatus(message, type) {
                const statusEl = document.getElementById('status');
                statusEl.textContent = message;
                statusEl.className = 'status ' + type;
            }
        </script>
    </body>
    </html>
    `;

    return htmlContent;
}

// 导出主要功能
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PSChromeIntegration,
        exampleUsage,
        createUI
    };
}