// Chrome扩展示例代码 - 处理PS插件请求
// 这个文件展示了Chrome扩展如何处理来自PS插件的请求

// background.js 或 service worker 中的代码
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "native-messaging") {
    port.onMessage.addListener((message) => {
      console.log("收到Native Host消息:", message);
      
      // 处理来自PS插件的请求
      if (message.action === "ps_request") {
        handlePSRequest(message, port);
      }
      // 处理原有的文件操作请求
      else if (message.action === "open_file" || message.action === "check_file") {
        // 原有逻辑保持不变
        console.log("处理文件操作:", message);
      }
    });
  }
});

/**
 * 处理来自PS插件的请求
 * @param {Object} message - 来自native_host.py的消息
 * @param {Object} port - Native Messaging端口
 */
async function handlePSRequest(message, port) {
  const { request_id, text_data, image_data, metadata } = message;
  
  try {
    console.log(`处理PS请求 ${request_id}:`, {
      text_length: text_data?.length || 0,
      has_image: !!image_data,
      metadata
    });
    
    // 模拟处理逻辑 - 这里你可以添加实际的业务逻辑
    const processedResult = await processDataFromPS({
      text_data,
      image_data,
      metadata
    });
    
    // 发送成功响应
    const response = {
      action: "ps_response",
      request_id: request_id,
      success: true,
      result_data: processedResult.text,
      processed_image: processedResult.image,
      metadata: {
        processing_time: processedResult.processingTime,
        operations_applied: processedResult.operations,
        timestamp: Date.now()
      }
    };
    
    port.postMessage(response);
    console.log(`PS请求 ${request_id} 处理完成`);
    
  } catch (error) {
    console.error(`处理PS请求 ${request_id} 失败:`, error);
    
    // 发送错误响应
    const errorResponse = {
      action: "ps_response",
      request_id: request_id,
      success: false,
      error: error.message,
      error_code: "PROCESSING_ERROR"
    };
    
    port.postMessage(errorResponse);
  }
}

/**
 * 实际的数据处理函数 - 根据你的业务需求实现
 * @param {Object} data - 来自PS的数据
 * @returns {Object} 处理结果
 */
async function processDataFromPS({ text_data, image_data, metadata }) {
  const startTime = Date.now();
  
  // 示例处理逻辑
  let processedText = text_data;
  let processedImage = image_data;
  const operations = [];
  
  // 文本处理示例
  if (text_data) {
    processedText = `[Chrome扩展处理] ${text_data} [处理完成]`;
    operations.push("text_processing");
  }
  
  // 图片处理示例
  if (image_data) {
    // 这里可以添加实际的图片处理逻辑
    // 例如：调用Canvas API、WebGL、或发送到服务器处理
    processedImage = await processImage(image_data);
    operations.push("image_processing");
  }
  
  // 模拟异步处理时间
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const processingTime = Date.now() - startTime;
  
  return {
    text: processedText,
    image: processedImage,
    processingTime,
    operations
  };
}

/**
 * 图片处理示例函数
 * @param {string} imageData - Base64编码的图片数据
 * @returns {string} 处理后的图片数据
 */
async function processImage(imageData) {
  // 这是一个示例实现，实际应用中你可能需要：
  // 1. 解码Base64图片
  // 2. 使用Canvas API进行图片处理
  // 3. 应用滤镜、调整大小等操作
  // 4. 重新编码为Base64
  
  return new Promise((resolve) => {
    // 模拟图片处理
    setTimeout(() => {
      // 返回处理后的图片（这里只是示例，实际应该是处理后的图片）
      resolve(imageData + "_processed");
    }, 500);
  });
}

// 连接到Native Host
function connectToNativeHost() {
  const port = chrome.runtime.connectNative("com.example.native_host");
  
  port.onMessage.addListener((message) => {
    console.log("Native Host消息:", message);
  });
  
  port.onDisconnect.addListener(() => {
    console.log("Native Host连接断开");
    if (chrome.runtime.lastError) {
      console.error("连接错误:", chrome.runtime.lastError.message);
    }
  });
  
  return port;
}

// 扩展启动时连接Native Host
let nativePort = null;
chrome.runtime.onStartup.addListener(() => {
  nativePort = connectToNativeHost();
});

chrome.runtime.onInstalled.addListener(() => {
  nativePort = connectToNativeHost();
});

// manifest.json 配置示例
/*
{
  "manifest_version": 3,
  "name": "PS Integration Extension",
  "version": "2.0.0",
  "description": "Chrome扩展与PS插件集成示例",
  
  "background": {
    "service_worker": "background.js"
  },
  
  "permissions": [
    "nativeMessaging"
  ],
  
  "host_permissions": [
    "http://localhost/*"
  ]
}
*/

// Native Messaging Host 清单文件示例 (com.example.native_host.json)
/*
{
  "name": "com.example.native_host",
  "description": "Native Host for PS-Chrome Integration",
  "path": "/path/to/native_host.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://your-extension-id/"
  ]
}
*/