// =============================================================================
// Service Worker初始化管理 - 解决Manifest V3浏览器重启问题
// =============================================================================

 // 全局状态管理
let downloadListener = null;
let nativePort = null;
let isConnecting = false;
let connectionPromise = null;
let isInitialized = false;
let webRequestListenerAdded = false;

// 常量集中管理（不改变逻辑，仅去除硬编码分散）
const COS_DOMAIN = 'aidata-1258344706.cos.ap-guangzhou.myqcloud.com';
const WEBREQUEST_TYPES = ["image"];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];

 // 轻量日志开关（默认开启）
let LOG_VERBOSE = true; // 可被存储覆盖
try {
  chrome.storage?.sync?.get?.({ debugLogs: true }, (cfg) => {
    if (typeof cfg?.debugLogs === 'boolean') {
      LOG_VERBOSE = cfg.debugLogs;
    }
  });
} catch (_) {}

// 纯函数：是否 JPEG
function isJpegUrl(u) {
  const l = u.toLowerCase();
  return !!(l.match(/\.(jpe?g)(\?|$)/) || l.includes('jpeg') || l.includes('jpg'));
}

// 纯函数：图片类别
function resolveImageType(u) {
  const isOriginalImage = u.includes('/target/');
  const isModifiedImage = u.includes('/attachment/');
  const imageType = isOriginalImage ? '原图' : (isModifiedImage ? '修改图' : '其他图片');
  return { isOriginalImage, isModifiedImage, imageType };
}

function buildCosImageMessage(url, details, stage, extra = {}) {
  const { isOriginalImage, isModifiedImage, imageType } = resolveImageType(url);
  return {
    type: 'COS_IMAGE_DETECTED',
    data: {
      url,
      isOriginal: isOriginalImage,
      isModified: isModifiedImage,
      imageType,
      stage,
      ...extra
    }
  };
}

// 网络请求拦截功能
function initializeNetworkInterception() {
  if (webRequestListenerAdded) {
    console.log('网络请求拦截器已初始化，跳过重复初始化');
    return;
  }

  if (LOG_VERBOSE) {
    console.log('初始化网络请求拦截功能');
    console.log('🚀 [网络拦截] 开始注册拦截器...');
  }
  
  // 拦截所有图片类型的请求
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const url = details.url;
      const isTargetDomain = url.includes(COS_DOMAIN);
      const isJpeg = isJpegUrl(url);

      if (isTargetDomain && isJpeg) {
        const { isOriginalImage, isModifiedImage, imageType } = resolveImageType(url);

        if (LOG_VERBOSE) {
          console.log('🎯 [COS拦截] JPEG图片请求:', url);
          console.log(`📸 [图片类型] ${imageType}: ${url}`);
        }

        const logData = {
          url: url,
          method: details.method,
          type: details.type,
          tabId: details.tabId,
          timeStamp: new Date(details.timeStamp).toLocaleString(),
          initiator: details.initiator,
          isJpeg: true,
          imageCategory: {
            isOriginal: isOriginalImage,
            isModified: isModifiedImage,
            type: imageType
          }
        };
        
        if (LOG_VERBOSE) console.log('🔍 [COS拦截] 详细信息:', logData);
        
        // 发送网络请求数据到content script
        chrome.tabs.sendMessage(details.tabId, buildCosImageMessage(url, details, 'request', {
          method: details.method,
          type: details.type,
          timeStamp: details.timeStamp,
          initiator: details.initiator,
          isJpeg: true
        })).catch(() => {
          // 忽略发送失败（可能content script还未加载）
        });
      }
      
      // 不阻止请求，只记录日志
      return {};
    },
    {
      urls: ["*://aidata-1258344706.cos.ap-guangzhou.myqcloud.com/*"],
      types: ["image"]
    },
    []
  );

  // 拦截响应头，获取更多图片信息
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      const url = details.url;
      const isTargetDomain = url.includes(COS_DOMAIN);
      const isJpegByUrl = isJpegUrl(url);

      if (isTargetDomain && isJpegByUrl) {
        const contentType = details.responseHeaders?.find(h =>
          h.name.toLowerCase() === 'content-type'
        )?.value;

        const contentLength = details.responseHeaders?.find(h =>
          h.name.toLowerCase() === 'content-length'
        )?.value;

        const isJpegByContentType = contentType && contentType.toLowerCase().includes('jpeg');
        const isJpeg = isJpegByContentType || isJpegByUrl;

        const { isOriginalImage, isModifiedImage, imageType } = resolveImageType(url);

        const logData = {
          url: url,
          statusCode: details.statusCode,
          contentType: contentType,
          contentLength: contentLength ? `${contentLength} bytes` : 'unknown',
          tabId: details.tabId,
          timeStamp: new Date(details.timeStamp).toLocaleString(),
          isJpeg: isJpeg,
          imageType: imageType,
          jpegDetection: {
            byContentType: isJpegByContentType,
            byUrl: isJpegByUrl
          }
        };
        
        if (LOG_VERBOSE) console.log(`📥 [COS拦截] ${imageType}响应头:`, logData);
        
        // 发送响应数据到content script
        chrome.tabs.sendMessage(details.tabId, buildCosImageMessage(url, details, 'response', {
          statusCode: details.statusCode,
          contentType: contentType,
          contentLength: contentLength,
          isJpeg: isJpeg,
          jpegDetection: {
            byContentType: isJpegByContentType,
            byUrl: isJpegByUrl
          }
        })).catch(() => {
          // 忽略发送失败
        });
      }
      
      return {};
    },
    {
      urls: ["*://aidata-1258344706.cos.ap-guangzhou.myqcloud.com/*"],
      types: ["image"]
    },
    ["responseHeaders"]
  );

  // 拦截请求完成事件
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      const url = details.url;
      const isTargetDomain = url.includes(COS_DOMAIN);
      const isJpegByUrl = isJpegUrl(url);

      if (isTargetDomain && isJpegByUrl) {
        const { isOriginalImage, isModifiedImage, imageType } = resolveImageType(url);

        const logData = {
          url: url,
          statusCode: details.statusCode,
          tabId: details.tabId,
          timeStamp: new Date(details.timeStamp).toLocaleString(),
          imageType: imageType,
          isJpeg: isJpegByUrl
        };
        
        if (LOG_VERBOSE) console.log(`✅ [COS拦截] ${imageType}请求完成:`, logData);
        
        // 发送完成状态到content script
        chrome.tabs.sendMessage(details.tabId, buildCosImageMessage(url, details, 'completed', {
          statusCode: details.statusCode,
          isJpeg: isJpegByUrl
        })).catch(() => {
          // 忽略发送失败
        });
      }
    },
    {
      urls: ["*://aidata-1258344706.cos.ap-guangzhou.myqcloud.com/*"],
      types: ["image"]
    }
  );

  webRequestListenerAdded = true;
  console.log('✅ 网络请求拦截器初始化完成');
  console.log('🔍 [网络拦截] 拦截器已激活，等待图片请求...');
}

// 统一初始化函数
function initializeExtension() {
  if (isInitialized) {
    console.log('扩展已初始化，跳过重复初始化');
    return Promise.resolve();
  }

  console.log('开始初始化扩展功能');
  
  return new Promise((resolve) => {
    // 创建右键菜单
    chrome.contextMenus.create({
      id: "downloadImage", 
      title: "快捷下载图片",
      contexts: ["image"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.log('菜单创建失败或已存在:', chrome.runtime.lastError.message);
      } else {
        console.log('右键菜单创建成功');
      }
    });
    
    // 初始化下载监听器
    initializeDownloadListener();
    console.log('下载监听器已初始化');
    
    // 初始化网络请求拦截
    initializeNetworkInterception();
    
    // 初始化Native Messaging
    initializeNativeMessaging()
      .then(() => {
        console.log('扩展初始化完成 - Native Messaging连接成功');
        isInitialized = true;
        resolve();
      })
      .catch((error) => {
        console.log('扩展初始化完成 - Native Messaging连接失败:', error.message);
        isInitialized = true;
        resolve();
      });
  });
}

// Keep-alive机制 - 防止service worker休眠
function startKeepAlive() {
  const KEEP_ALIVE_INTERVAL = 25000; // 25秒，避免30秒超时
  
  const keepAlive = () => {
    chrome.runtime.getPlatformInfo((info) => {
      console.log(`Keep-alive ping: ${info.os} - ${new Date().toISOString()}`);
    });
  };
  
  // 立即执行一次
  keepAlive();
  
  // 定期执行
  setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
  if (LOG_VERBOSE) console.log('Keep-alive机制已启动');
}

// =============================================================================
// 事件监听器 - 必须在顶层同步注册
// =============================================================================

// 扩展安装/更新事件
chrome.runtime.onInstalled.addListener(() => {
  if (LOG_VERBOSE) console.log('onInstalled事件触发');
  initializeExtension().then(() => {
    startKeepAlive();
  });
});

// 浏览器启动事件
chrome.runtime.onStartup.addListener(() => {
  if (LOG_VERBOSE) console.log('onStartup事件触发');
  isInitialized = false; // 重置初始化状态
  initializeExtension().then(() => {
    startKeepAlive();
  });
});

// 标签页激活事件 - 触发初始化
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!isInitialized) {
    if (LOG_VERBOSE) console.log('标签页激活，触发初始化检查');
    initializeExtension().then(() => {
      startKeepAlive();
    });
  }
});

// 标签页更新事件 - 触发初始化 
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isInitialized && tab.url && tab.url.includes('qlabel.tencent.com')) {
    if (LOG_VERBOSE) console.log('目标页面加载，触发初始化检查');
    initializeExtension().then(() => {
      startKeepAlive();
    });
  }
});

// Service Worker立即启动初始化
if (LOG_VERBOSE) console.log('Service Worker启动，开始初始化');
initializeExtension().then(() => {
  startKeepAlive();
});

// =============================================================================
// 事件处理器
// =============================================================================

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "downloadImage") {
    downloadImage(info.srcUrl, tab.url);
  } else if (info.menuItemId === "openLastDownloaded") {
    openLastDownloadedImage();
  }
});

// 初始化Native Messaging连接 - 优化版本
function initializeNativeMessaging() {
  // 如果已经在连接中，返回现有的Promise
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }
  
  // 如果已经连接，直接返回成功的Promise
  if (nativePort) {
    return Promise.resolve(nativePort);
  }
  
  isConnecting = true;
  
  connectionPromise = new Promise((resolve, reject) => {
    try {
      const port = chrome.runtime.connectNative('com.annotateflow.assistant');
      
      // 优化消息监听器 - 只处理相关消息
      port.onMessage.addListener((response) => {
        if (LOG_VERBOSE) console.log('Native Host响应:', response);
        
        // 处理文件打开响应
        if (response.success !== undefined) {
          if (response.success) {
            console.log('图片已通过Native Host成功打开');
          } else if (response.error) {
            console.error('Native Host打开失败:', response.error);
          }
        }
        
        // 文件检查响应由专门的监听器处理，这里不需要处理
      });
      
      port.onDisconnect.addListener(() => {
        if (LOG_VERBOSE) console.log('Native Host连接断开');
        nativePort = null;
        isConnecting = false;
        connectionPromise = null;
      });
      
      nativePort = port;
      isConnecting = false;
      if (LOG_VERBOSE) console.log('Native Messaging连接已建立');
      resolve(port);
      
    } catch (error) {
      console.error('Native Messaging连接失败:', error);
      isConnecting = false;
      connectionPromise = null;
      reject(error);
    }
  });
  
  return connectionPromise;
}

// 初始化下载监听器
function initializeDownloadListener() {
  if (downloadListener) {
    chrome.downloads.onChanged.removeListener(downloadListener);
  }
  
  downloadListener = (delta) => {
    if (LOG_VERBOSE) console.log('下载状态变化:', delta);
    
    // 检查下载是否完成
    if (delta.state && delta.state.current === 'complete') {
      console.log('下载完成，ID:', delta.id);
      
      // 获取下载项信息
      chrome.downloads.search({id: delta.id}, (downloads) => {
        if (downloads && downloads.length > 0) {
          const download = downloads[0];
          console.log('下载项信息:', download);
          
          // 检查是否是图片文件
          const filename = download.filename || '';
          const isImage = IMAGE_EXTS.some(ext => filename.toLowerCase().endsWith(ext));
          
          if (LOG_VERBOSE) {
            console.log('文件名:', filename);
            console.log('是否为图片:', isImage);
          }
          
          if (isImage) {
            // 获取用户设置
            chrome.storage.sync.get({autoOpenImages: true}, (settings) => {
              if (LOG_VERBOSE) console.log('自动打开设置:', settings.autoOpenImages);
              
              if (settings.autoOpenImages) {
                if (LOG_VERBOSE) console.log('尝试自动打开图片');
                
                // 立即尝试打开图片，使用更智能的文件就绪检测
                openImageWithBestMethod(delta.id, download.filename);
              } else {
                if (LOG_VERBOSE) console.log('用户设置不自动打开图片');
              }
            });
          } else {
            if (LOG_VERBOSE) console.log('非图片文件，不自动打开');
          }
        }
      });
    }
  };
  
  chrome.downloads.onChanged.addListener(downloadListener);
}

// 通过多种方式打开图片 (不依赖用户手势) - 优化版本
function openImageWithBestMethod(downloadId, filePath) {
  if (LOG_VERBOSE) console.log('尝试打开图片，下载ID:', downloadId, '文件路径:', filePath);
  
  // 简化的文件就绪检测 - 直接尝试打开，减少延迟
  if (nativePort) {
    if (LOG_VERBOSE) console.log('使用现有Native Host连接');
    // 直接尝试打开，不进行复杂的文件检查
    setTimeout(() => {
      tryNativeHostOpen(filePath);
    }, 50); // 最小延迟确保文件写入完成
  } else {
    if (LOG_VERBOSE) console.log('Native Host未连接，尝试连接');
    initializeNativeMessaging()
      .then(() => {
        if (LOG_VERBOSE) console.log('Native Host连接成功，打开图片');
        // 连接成功后稍微延迟确保稳定
        setTimeout(() => {
          tryNativeHostOpen(filePath);
        }, 100);
      })
      .catch((error) => {
        console.error('Native Host连接失败，尝试备用方法:', error);
        tryAlternativeOpen(filePath);
      });
  }
}

// 简化的文件就绪检测 - 仅在必要时使用
function checkFileReadyIfNeeded(filePath, callback, retryCount = 0) {
  const maxRetries = 2; // 进一步减少重试次数
  const retryDelay = 150; // 适中的延迟
  
  // 只在文件可能未就绪时进行检查
  if (nativePort && retryCount === 0) {
    try {
      const checkId = `check_${Date.now()}`;
      
      nativePort.postMessage({
        action: 'check_file',
        file_path: filePath,
        check_id: checkId
      });
      
      const checkListener = (response) => {
        if (response.action === 'check_file_result' && response.check_id === checkId) {
          nativePort.onMessage.removeListener(checkListener);
          
          if (response.exists && response.readable && response.size > 0) {
            console.log(`文件就绪 (${response.size} bytes)，立即打开`);
            callback();
          } else if (retryCount < maxRetries) {
            console.log(`文件未就绪，延迟重试`);
            setTimeout(() => {
              callback(); // 直接回调，不再检查
            }, retryDelay);
          } else {
            console.log('直接尝试打开文件');
            callback();
          }
        }
      };
      
      nativePort.onMessage.addListener(checkListener);
      
      // 较短的超时时间
      setTimeout(() => {
        nativePort.onMessage.removeListener(checkListener);
        console.log('文件检查超时，直接打开');
        callback();
      }, 200);
      
    } catch (error) {
      console.error('文件检查失败:', error);
      callback();
    }
  } else {
    // 直接执行回调
    callback();
  }
}

// 通过Native Host打开图片 - 优化版本
function tryNativeHostOpen(filePath) {
  if (LOG_VERBOSE) console.log('使用Native Host打开图片');
  
  if (!nativePort) {
    console.error('Native Host未连接，无法打开图片');
    console.log('提示: 请运行install_native_host.bat安装Native Host支持');
    return;
  }
  
  try {
    if (LOG_VERBOSE) console.log('发送打开请求到Native Host:', filePath);
    
    // 创建唯一的打开请求ID
    const openId = `open_${Date.now()}`;
    
    nativePort.postMessage({
      action: 'open_file',
      file_path: filePath,
      open_id: openId
    });
    
    if (LOG_VERBOSE) console.log('Native Host打开请求已发送，等待系统处理');
    
  } catch (error) {
    console.error('Native Host方法失败:', error);
  }
}

// 显示通知提示用户手动打开
function showOpenFileNotification(filePath) {
  if (LOG_VERBOSE) console.log('显示打开文件通知');
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: '图片下载完成',
    message: `图片已保存到: ${filePath}\n点击此通知打开文件夹`,
    buttons: [{
      title: '打开文件夹'
    }]
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('通知创建失败:', chrome.runtime.lastError.message);
    } else {
      console.log('通知已显示:', notificationId);
    }
  });
}

// 下载图片函数
async function downloadImage(imageUrl, pageUrl) {
  return downloadImageWithCustomName(imageUrl, pageUrl, null);
}

// 支持自定义文件名的下载函数
async function downloadImageWithCustomName(imageUrl, pageUrl, customFilename) {
  try {
    if (LOG_VERBOSE) console.log('开始下载图片:', imageUrl);
    
    let filename;
    if (customFilename) {
      filename = customFilename;
    } else {
      // 从URL中提取文件名
      const url = new URL(imageUrl);
      filename = url.pathname.split('/').pop();
      
      // 如果没有文件名或扩展名，生成一个
      if (!filename || !filename.includes('.')) {
        const timestamp = new Date().getTime();
        filename = `image_${timestamp}.jpg`;
      }
    }
    
    if (LOG_VERBOSE) console.log('文件名:', filename);
    
    // 开始下载
    const downloadId = await chrome.downloads.download({
      url: imageUrl,
      filename: filename,
      saveAs: false
    });
    
    console.log('下载ID:', downloadId);
    return downloadId;
    
  } catch (error) {
    console.error('下载图片失败:', error);
    throw error;
  }
}

// 处理来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (LOG_VERBOSE) console.log('收到消息:', request);
  
  if (request.action === "downloadImage") {
    // 支持自定义文件名
    const filename = request.filename || null;
    downloadImageWithCustomName(request.imageUrl, sender.tab?.url || '', filename)
      .then(() => {
        sendResponse({success: true, message: '下载已开始'});
      })
      .catch((error) => {
        console.error('下载失败:', error);
        sendResponse({success: false, error: error.message});
      });
    return true; // 保持消息通道开放
  } else if (request.action === "checkSettings") {
    // 检查设置并返回状态
    chrome.storage.sync.get({autoOpenImages: true}, (settings) => {
      sendResponse({
        success: true,
        autoOpenImages: settings.autoOpenImages,
        extensionVersion: chrome.runtime.getManifest().version
      });
    });
    return true; // 保持消息通道开放
  } else if (request.action === "testNativeHost") {
    // 测试Native Host连接
    if (nativePort) {
      sendResponse({
        success: true,
        message: 'Native Host已连接'
      });
    } else {
      // 尝试重新连接
      initializeNativeMessaging();
      setTimeout(() => {
        sendResponse({
          success: !!nativePort,
          message: nativePort ? 'Native Host连接成功' : 'Native Host连接失败'
        });
      }, 1000);
    }
    return true; // 保持消息通道开放
  } else if (request.action === "fetchCOSImage") {
    // 代理获取COS图片，解决跨域问题
    fetchCOSImageProxy(request.url)
      .then((result) => {
        sendResponse({
          success: true,
          data: result
        });
      })
      .catch((error) => {
        console.error('代理获取COS图片失败:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true; // 保持消息通道开放
  }
});

// COS图片代理获取函数
async function fetchCOSImageProxy(imageUrl) {
  try {
    if (LOG_VERBOSE) console.log('🌐 代理获取COS图片:', imageUrl);
    
    // 使用background script获取图片（无跨域限制）
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // 获取blob数据
    const blob = await response.blob();
    
    // 转换为base64以便传递给content script
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    const result = {
      url: imageUrl,
      size: blob.size,
      type: blob.type,
      base64: base64,
      dataUrl: `data:${blob.type};base64,${base64}`
    };
    
    if (LOG_VERBOSE) {
      console.log('✅ COS图片代理获取成功:', {
        url: imageUrl,
        size: blob.size,
        type: blob.type
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ COS图片代理获取失败:', error);
    throw error;
  }
}
