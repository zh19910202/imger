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
let downloadAutoOpenMap = new Map(); // 跟踪每个下载的自动打开设置

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

// 纯函数：是否图片URL - 增强后端检测
function isJpegUrl(u) {
  const l = u.toLowerCase();
  return !!(l.match(/\.(jpe?g)(\?|$)/) || l.includes('jpeg') || l.includes('jpg'));
}

// 增强的图片URL检测函数
function isImageUrl(url) {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  
  // 图片扩展名检测
  const imageExts = /\.(jpe?g|png|gif|webp|bmp|svg|tiff|ico)(\?|#|$)/i;
  const hasImageExt = imageExts.test(url);
  
  // 后端API图片路径检测
  const backendImagePaths = [
    '/api/image', '/api/upload', '/api/media', '/api/file',
    '/upload/image', '/media/image', '/attachment/',
    '/resource/image', '/storage/image'
  ];
  
  const hasBackendImagePath = backendImagePaths.some(path => lowerUrl.includes(path));
  
  // 图片相关关键词
  const imageKeywords = ['image', 'img', 'picture', 'photo', 'media'];
  const hasImageKeyword = imageKeywords.some(keyword => lowerUrl.includes(keyword));
  
  // Base64或Blob URL
  const isDataUrl = lowerUrl.startsWith('data:image/') || lowerUrl.startsWith('blob:');
  
  return hasImageExt || hasBackendImagePath || 
         (hasImageKeyword && lowerUrl.includes('/api/')) || isDataUrl;
}

// 纯函数：图片类别 - 增强COS原图检测
function resolveImageType(u) {
  const lowerUrl = u.toLowerCase();
  
  // COS原图特征检测 - 只检测JPEG格式的原图
  const isOriginalImage = isJpegUrl(u) && (
                         lowerUrl.includes('/target/') || 
                         lowerUrl.includes('/target/dataset/') ||
                         (lowerUrl.includes('cos.ap-guangzhou.myqcloud.com') && 
                          (lowerUrl.includes('/target/') || lowerUrl.includes('dataset')))
                         );
  
  // COS修改图特征检测
  const isModifiedImage = lowerUrl.includes('/attachment/') ||
                         lowerUrl.includes('/attachment/task-detail/') ||
                         (lowerUrl.includes('cos.ap-guangzhou.myqcloud.com') && 
                          lowerUrl.includes('/attachment/'));
  
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
  
  // 拦截所有图片类型的请求 - 增强后端图片检测
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const url = details.url;
      const isTargetDomain = url.includes(COS_DOMAIN);
      const isJpeg = isJpegUrl(url);
      
      // 检测后端图片API
      const isBackendImageApi = (
        url.includes('/api/image') ||
        url.includes('/api/upload') ||
        url.includes('/api/media') ||
        url.includes('/api/file') ||
        url.includes('/upload/') ||
        url.includes('/media/') ||
        url.includes('/attachment/')
      ) && (isJpegUrl(url) || url.toLowerCase().includes('image'));
      
      // 扩展检测条件
      if ((isTargetDomain && isJpeg) || isBackendImageApi) {
        const { isOriginalImage, isModifiedImage, imageType } = resolveImageType(url);

        if (LOG_VERBOSE) {
          console.log('🎯 [COS拦截] 图片请求:', url);
          console.log(`📸 [图片类型] ${imageType}: ${url}`);
          
          // 特别标记dataset路径的原图
          if (isOriginalImage && url.includes('dataset')) {
            console.log('🌟 [重要] 检测到dataset原图:', url.substring(0, 150));
          }
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
        if (details.tabId >= 0) {
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
      }
      
      // 不阻止请求，只记录日志
      return {};
    },
    {
      urls: [
        "*://aidata-1258344706.cos.ap-guangzhou.myqcloud.com/*",
        "*://*/api/image/*",
        "*://*/api/upload/*", 
        "*://*/api/media/*",
        "*://*/api/file/*",
        "*://*/upload/*",
        "*://*/media/*",
        "*://*/attachment/*",
        "*://*/resource/*"
      ],
      types: ["image", "xmlhttprequest", "other"]
    },
    []
  );

  // 拦截响应头，获取更多图片信息 - 增强后端检测
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      const url = details.url;
      const isTargetDomain = url.includes(COS_DOMAIN);
      const isJpegByUrl = isJpegUrl(url);
      
      // 检测后端图片响应
      const contentType = details.responseHeaders?.find(h =>
        h.name.toLowerCase() === 'content-type'
      )?.value?.toLowerCase() || '';
      
      const isBackendImage = (
        url.includes('/api/') ||
        url.includes('/upload/') ||
        url.includes('/media/')
      ) && (
        contentType.startsWith('image/') ||
        isJpegByUrl ||
        contentType.includes('octet-stream')
      );
      
      if ((isTargetDomain && isJpegByUrl) || isBackendImage) {
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
        if (details.tabId >= 0) {
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
      }
      
      return {};
    },
    {
      urls: [
        "*://aidata-1258344706.cos.ap-guangzhou.myqcloud.com/*",
        "*://*/api/image/*",
        "*://*/api/upload/*", 
        "*://*/api/media/*",
        "*://*/api/file/*",
        "*://*/upload/*",
        "*://*/media/*",
        "*://*/attachment/*",
        "*://*/resource/*"
      ],
      types: ["image", "xmlhttprequest", "other"]
    },
    ["responseHeaders"]
  );

  // 拦截请求完成事件 - 增强后端检测
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      const url = details.url;
      const isTargetDomain = url.includes(COS_DOMAIN);
      const isJpegByUrl = isJpegUrl(url);
      
      // 检测后端图片请求完成
      const isBackendImageComplete = (
        url.includes('/api/') ||
        url.includes('/upload/') ||
        url.includes('/media/') ||
        url.includes('/attachment/')
      ) && (
        isJpegUrl(url) ||
        url.toLowerCase().includes('image') ||
        details.statusCode === 200
      );
      
      if ((isTargetDomain && isJpegByUrl) || isBackendImageComplete) {
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
        if (details.tabId >= 0) {
          chrome.tabs.sendMessage(details.tabId, buildCosImageMessage(url, details, 'completed', {
            statusCode: details.statusCode,
            isJpeg: isJpegByUrl
          })).catch(() => {
            // 忽略发送失败
          });
        }
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
      
      // 优化消息监听器 - 处理所有Native Host消息
      port.onMessage.addListener((response) => {
        console.log('收到Native Host消息:', response);

        // 处理自动上传通知
        if (response.action === 'auto_upload_notification') {
          console.log('=== 收到Native Host自动上传通知 ===');
          console.log('通知内容:', response);

          // 获取当前活动标签页并发送通知
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            console.log('查询到的活动标签页:', tabs);
            if (tabs && tabs.length > 0) {
              const activeTab = tabs[0];
              console.log('找到活动标签页，ID:', activeTab.id);
              console.log('标签页URL:', activeTab.url);

              // 检查标签页是否为标注页面
              if (activeTab.url && activeTab.url.includes('qlabel.tencent.com')) {
                console.log('活动标签页是标注页面，发送自动上传通知');
                // 发送消息到当前活动标签页的content script
                if (activeTab.id >= 0) {
                  chrome.tabs.sendMessage(activeTab.id, {
                    action: 'trigger_auto_upload',
                    data: response
                  }, function(response) {
                    if (chrome.runtime.lastError) {
                      console.error('发送自动上传通知到content script失败:', chrome.runtime.lastError.message);
                    } else {
                      console.log('自动上传通知已发送到content script');
                    }
                  });
                } else {
                  console.error('活动标签页ID无效:', activeTab.id);
                }
              } else {
                console.log('活动标签页不是标注页面，但仍发送通知让content script自己判断');
                if (activeTab.id >= 0) {
                  chrome.tabs.sendMessage(activeTab.id, {
                    action: 'trigger_auto_upload',
                    data: response
                  }, function(response) {
                    if (chrome.runtime.lastError) {
                      console.error('发送自动上传通知到content script失败:', chrome.runtime.lastError.message);
                    } else {
                      console.log('自动上传通知已发送到content script（非标注页面）');
                    }
                  });
                } else {
                  console.error('活动标签页ID无效:', activeTab.id);
                }
              }
            } else {
              console.log('未找到活动标签页');
            }
          });
        }
        // 处理文件打开响应
        else if (response.success !== undefined) {
          if (response.success) {
            console.log('图片已通过Native Host成功打开');
          } else if (response.error) {
            console.error('Native Host打开失败:', response.error);
          }
        } else {
          // 处理其他类型的消息
          console.log('收到其他类型的Native Host消息:', response);
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
            // 检查这个特定下载的自动打开设置
            const shouldAutoOpen = downloadAutoOpenMap.get(delta.id);

            if (LOG_VERBOSE) {
              console.log('下载完成处理:', {
                downloadId: delta.id,
                filename: filename,
                shouldAutoOpen: shouldAutoOpen,
                hasAutoOpenSetting: downloadAutoOpenMap.has(delta.id)
              });
            }

            // 如果明确设置了自动打开行为，使用该设置
            if (shouldAutoOpen !== undefined) {
              if (shouldAutoOpen === true) {
                if (LOG_VERBOSE) console.log('明确设置为自动打开图片');
                openImageWithBestMethod(delta.id, download.filename);
              } else {
                if (LOG_VERBOSE) console.log('明确设置为不自动打开图片');
              }
              downloadAutoOpenMap.delete(delta.id); // 清理映射
              return;
            }

            // 如果没有明确设置，则使用用户的全局设置
            chrome.storage.sync.get({autoOpenImages: true}, (settings) => {
              if (LOG_VERBOSE) console.log('使用全局自动打开设置:', settings.autoOpenImages);

              if (settings.autoOpenImages) {
                if (LOG_VERBOSE) console.log('根据全局设置自动打开图片');
                openImageWithBestMethod(delta.id, download.filename);
              } else {
                if (LOG_VERBOSE) console.log('全局设置不自动打开图片');
              }

              downloadAutoOpenMap.delete(delta.id); // 清理映射
            });
          } else {
            if (LOG_VERBOSE) console.log('非图片文件，不自动打开');
            downloadAutoOpenMap.delete(delta.id); // 清理映射
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

// 支持自定义文件名和自动打开控制的下载函数
async function downloadImageWithCustomName(imageUrl, pageUrl, customFilename, autoOpen = true) {
  try {
    if (LOG_VERBOSE) console.log('开始下载图片:', imageUrl, { autoOpen });

    // 小工具：从 Content-Type 推断扩展名
    const extFromContentType = (ct) => {
      if (!ct) return null;
      const m = ct.toLowerCase();
      if (m.startsWith('image/')) {
        const sub = m.split('/')[1].split(';')[0].trim();
        // 常见映射
        const map = {
          'jpeg': '.jpg',
          'jpg': '.jpg',
          'png': '.png',
          'gif': '.gif',
          'webp': '.webp',
          'bmp': '.bmp',
          'tiff': '.tiff',
          'svg+xml': '.svg',
          'x-icon': '.ico',
          'vnd.microsoft.icon': '.ico',
          'heic': '.heic',
          'heif': '.heif',
          'avif': '.avif'
        };
        return map[sub] || (sub ? `.${sub.replace(/\W+/g, '')}` : null);
      }
      return null;
    };

    // 小工具：从 URL 推断文件名与扩展名
    const parseFilenameFromUrl = (raw) => {
      try {
        const url = new URL(raw);
        let name = url.pathname.split('/').pop() || '';
        // 去除查询中可能的 filename 参数
        const qpName = url.searchParams.get('filename') || url.searchParams.get('file') || url.searchParams.get('name');
        if ((!name || !name.includes('.')) && qpName) {
          name = qpName;
        }
        return name;
      } catch {
        return '';
      }
    };

    // 小工具：确保文件名有扩展名，必要时通过 HEAD 获取
    const ensureFilename = async (rawName) => {
      let filename = rawName;
      let hasExt = !!filename && filename.includes('.') && !filename.endsWith('.');
      if (!filename || !hasExt) {
        // 尝试 HEAD 请求探测 Content-Type
        try {
          const resp = await fetch(imageUrl, { method: 'HEAD' });
          const ct = resp.headers.get('content-type') || '';
          const ext = extFromContentType(ct);
          const ts = Date.now();
          if (!filename || filename === '' || filename.endsWith('.')) {
            filename = `image_${ts}${ext || '.img'}`;
          } else if (!hasExt) {
            filename = `${filename}${ext || '.img'}`;
          }
        } catch {
          // 无法探测时回退
          const ts = Date.now();
          filename = filename && filename !== '' ? `${filename}.img` : `image_${ts}.img`;
        }
      }
      return filename;
    };

    let filename = customFilename || parseFilenameFromUrl(imageUrl);
    filename = await ensureFilename(filename);

    if (LOG_VERBOSE) console.log('文件名:', filename);

    // 开始下载（保持原始数据与格式，不转码）
    const downloadId = await chrome.downloads.download({
      url: imageUrl,
      filename: filename,
      saveAs: false
    });

    // 保存自动打开设置
    downloadAutoOpenMap.set(downloadId, autoOpen);

    console.log('下载ID:', downloadId, '自动打开:', autoOpen);
    return downloadId;

  } catch (error) {
    console.error('下载图片失败:', error);
    throw error;
  }
}

// 处理来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (LOG_VERBOSE) console.log('收到消息:', request);

  // 处理推送Appen数据请求
  if (request.action === "pushAppenData") {
    pushAppenDataProxy(request.endpoint, request.data)
      .then((result) => {
        sendResponse({
          success: true,
          data: result
        });
      })
      .catch((error) => {
        console.error('推送Appen数据失败:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true; // 保持消息通道开放
  } else if (request.action === "downloadImage") {
    // 支持自定义文件名和自动打开控制
    const filename = request.filename || null;
    const autoOpen = request.autoOpen !== false; // 默认true，除非明确设置为false

    downloadImageWithCustomName(request.imageUrl, sender.tab?.url || '', filename, autoOpen)
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
  } else if (request.action === "send_native_message") {
    // 处理发送到 Native Host 的消息
    if (LOG_VERBOSE) console.log('转发消息到 Native Host:', request.nativeMessage);

    if (!nativePort) {
      // 尝试连接 Native Host
      initializeNativeMessaging()
        .then(() => {
          sendNativeMessage(request.nativeMessage, sendResponse);
        })
        .catch((error) => {
          console.error('Native Host 连接失败:', error);
          sendResponse({
            success: false,
            error: 'Native Host 连接失败: ' + error.message
          });
        });
    } else {
      sendNativeMessage(request.nativeMessage, sendResponse);
    }
    return true; // 保持消息通道开放
  } else if (request.action === "getAppenCookies") {
    // 获取Appen认证cookie
    getAppenCookies(request.url || "https://ui.appen.com.cn")
      .then((cookies) => {
        sendResponse({
          success: true,
          cookies: cookies
        });
      })
      .catch((error) => {
        console.error('获取Appen cookie失败:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true; // 保持消息通道开放
  }
});

// 发送消息到 Native Host 并处理响应
function sendNativeMessage(message, sendResponse) {
  if (!nativePort) {
    sendResponse({
      success: false,
      error: 'Native Host 未连接'
    });
    return;
  }

  try {
    if (LOG_VERBOSE) console.log('发送消息到 Native Host:', message);
    
    // 创建响应监听器
    const responseListener = (response) => {
      if (LOG_VERBOSE) console.log('收到 Native Host 响应:', response);
      
      // 检查是否是我们期待的响应
      if (response.action === 'read_device_fingerprint_result' && 
          message.action === 'read_device_fingerprint') {
        // 移除监听器
        nativePort.onMessage.removeListener(responseListener);
        
        // 发送响应给 content script
        sendResponse(response);
      }
    };
    
    // 添加响应监听器
    nativePort.onMessage.addListener(responseListener);
    
    // 发送消息
    nativePort.postMessage(message);
    
    // 设置超时，防止无响应
    setTimeout(() => {
      nativePort.onMessage.removeListener(responseListener);
      sendResponse({
        success: false,
        error: 'Native Host 响应超时'
      });
    }, 5000); // 5秒超时
    
  } catch (error) {
    console.error('发送 Native Host 消息失败:', error);
    sendResponse({
      success: false,
      error: '发送消息失败: ' + error.message
    });
  }
}

// 获取Appen认证cookie
async function getAppenCookies(url) {
  try {
    console.log('[Background] 开始获取Appen cookie，URL:', url);

    // 使用chrome.cookies API获取cookie
    const cookies = await chrome.cookies.getAll({
      url: url
    });

    console.log('[Background] 获取到的所有cookie:', cookies);

    // 过滤出我们需要的cookie
    const authCookies = {
      authorization: null,
      appenAuthSession: null
    };

    cookies.forEach(cookie => {
      if (cookie.name === 'Authorization' || cookie.name === 'authorization') {
        authCookies.authorization = cookie.value;
      } else if (cookie.name === '_appen_auth_session') {
        authCookies.appenAuthSession = cookie.value;
      }
    });

    console.log('[Background] 提取的认证cookie:', authCookies);

    return authCookies;
  } catch (error) {
    console.error('[Background] 获取Appen cookie时出错:', error);
    throw error;
  }
}

// COS图片代理获取函数 - 修复栈溢出版本
async function pushAppenDataProxy(endpoint, data) {
  try {
    if (LOG_VERBOSE) console.log('📤 代理推送Appen数据到:', endpoint);
    if (LOG_VERBOSE) console.log('📋 推送数据:', data);
    
    // 输出格式化的请求体
    console.log('=== 📤 Appen数据推送请求体 ===');
    console.log('目标地址:', endpoint);
    console.log('请求体JSON:', JSON.stringify(data, null, 2));
    console.log('请求体大小:', JSON.stringify(data).length, '字节');
    console.log('=== 请求体输出完成 ===');

    // 使用background script发送HTTP请求（无Mixed Content限制）
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `HTTP ${response.status}: ${response.statusText}${errorText ? ' - ' + errorText.substring(0, 200) : ''}`;
      console.error('❌ 服务器返回错误:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        requestData: data,
        endpoint: endpoint
      });
      throw new Error(errorMessage);
    }

    // 尝试解析JSON响应
    let result;
    try {
      result = await response.json();
    } catch (e) {
      // 如果响应不是JSON，直接返回状态
      result = {
        status: response.status,
        statusText: response.statusText,
        message: '数据推送成功'
      };
    }

    if (LOG_VERBOSE) {
      console.log('✅ Appen数据推送成功:', {
        status: response.status,
        data: result
      });
    }

    return result;

  } catch (error) {
    console.error('❌ Appen数据推送失败:', error);
    throw error;
  }
}

// COS图片代理获取函数 - 修复栈溢出版本
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

    // 检查文件大小，如果太大则拒绝处理
    if (blob.size > 50 * 1024 * 1024) { // 50MB限制
      throw new Error(`图片文件过大: ${Math.round(blob.size / 1024 / 1024)}MB，超过50MB限制`);
    }

    if (LOG_VERBOSE) {
      console.log('图片下载完成:', {
        size: blob.size,
        type: blob.type,
        sizeInMB: Math.round(blob.size / 1024 / 1024 * 100) / 100
      });
    }

    // 使用FileReader避免栈溢出
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const result = reader.result;
          resolve(result);
        } catch (error) {
          reject(new Error('FileReader结果处理失败: ' + error.message));
        }
      };

      reader.onerror = () => {
        reject(new Error('FileReader读取失败'));
      };

      reader.readAsDataURL(blob);
    });

    const result = {
      url: imageUrl,
      size: blob.size,
      type: blob.type,
      dataUrl: base64
    };

    if (LOG_VERBOSE) {
      console.log('✅ COS图片代理获取成功:', {
        url: imageUrl,
        size: blob.size,
        type: blob.type,
        dataUrlLength: base64.length
      });
    }

    return result;

  } catch (error) {
    console.error('❌ COS图片代理获取失败:', error);
    throw error;
  }
}


// 处理认证信息同步请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "syncAuthToServer") {
        syncAuthToServer(message.data, message.endpoint)
            .then(result => {
                sendResponse({ success: true, result: result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

async function syncAuthToServer(authData, endpoint) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(authData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('[Background] 认证信息同步成功:', result);
            return result;
        } else {
            const errorText = await response.text();
            console.error('[Background] 服务器响应:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText,
                requestBody: authData
            });
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
    } catch (error) {
        console.error('[Background] 认证信息同步失败:', error);
        throw error;
    }
}
