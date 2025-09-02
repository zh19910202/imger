// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "downloadImage",
    title: "快捷下载图片",
    contexts: ["image"]
  });
  
  // 初始化下载监听器
  initializeDownloadListener();
  console.log('下载监听器已初始化');
  
  // 初始化Native Messaging
  initializeNativeMessaging();
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "downloadImage") {
    downloadImage(info.srcUrl, tab.url);
  } else if (info.menuItemId === "openLastDownloaded") {
    openLastDownloadedImage();
  }
});

// 全局下载监听器
let downloadListener = null;
let nativePort = null;

// 连接状态管理
let isConnecting = false;
let connectionPromise = null;

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
        console.log('Native Host响应:', response);
        
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
        console.log('Native Host连接断开');
        nativePort = null;
        isConnecting = false;
        connectionPromise = null;
      });
      
      nativePort = port;
      isConnecting = false;
      console.log('Native Messaging连接已建立');
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
    console.log('下载状态变化:', delta);
    
    // 检查下载是否完成
    if (delta.state && delta.state.current === 'complete') {
      console.log('下载完成，ID:', delta.id);
      
      // 获取下载项信息
      chrome.downloads.search({id: delta.id}, (downloads) => {
        if (downloads && downloads.length > 0) {
          const download = downloads[0];
          console.log('下载项信息:', download);
          
          // 检查是否是图片文件
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
          const filename = download.filename || '';
          const isImage = imageExtensions.some(ext => 
            filename.toLowerCase().endsWith(ext)
          );
          
          console.log('文件名:', filename);
          console.log('是否为图片:', isImage);
          
          if (isImage) {
            // 获取用户设置
            chrome.storage.sync.get({autoOpenImages: true}, (settings) => {
              console.log('自动打开设置:', settings.autoOpenImages);
              
              if (settings.autoOpenImages) {
                console.log('尝试自动打开图片');
                
                // 立即尝试打开图片，使用更智能的文件就绪检测
                openImageWithBestMethod(delta.id, download.filename);
              } else {
                console.log('用户设置不自动打开图片');
              }
            });
          } else {
            console.log('非图片文件，不自动打开');
          }
        }
      });
    }
  };
  
  chrome.downloads.onChanged.addListener(downloadListener);
}

// 通过多种方式打开图片 (不依赖用户手势) - 优化版本
function openImageWithBestMethod(downloadId, filePath) {
  console.log('尝试打开图片，下载ID:', downloadId, '文件路径:', filePath);
  
  // 简化的文件就绪检测 - 直接尝试打开，减少延迟
  if (nativePort) {
    console.log('使用现有Native Host连接');
    // 直接尝试打开，不进行复杂的文件检查
    setTimeout(() => {
      tryNativeHostOpen(filePath);
    }, 50); // 最小延迟确保文件写入完成
  } else {
    console.log('Native Host未连接，尝试连接');
    initializeNativeMessaging()
      .then(() => {
        console.log('Native Host连接成功，打开图片');
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
  console.log('使用Native Host打开图片');
  
  if (!nativePort) {
    console.error('Native Host未连接，无法打开图片');
    console.log('提示: 请运行install_native_host.bat安装Native Host支持');
    tryAlternativeOpen(filePath);
    return;
  }
  
  try {
    console.log('发送打开请求到Native Host:', filePath);
    
    // 创建唯一的打开请求ID
    const openId = `open_${Date.now()}`;
    
    nativePort.postMessage({
      action: 'open_file',
      file_path: filePath,
      open_id: openId
    });
    
    // 设置响应超时
    setTimeout(() => {
      console.log('Native Host打开请求超时，尝试备用方法');
      tryAlternativeOpen(filePath);
    }, 2000); // 2秒超时
    
  } catch (error) {
    console.error('Native Host方法失败:', error);
    tryAlternativeOpen(filePath);
  }
}

// 备用打开方法 (通过创建临时链接)
function tryAlternativeOpen(filePath) {
  console.log('尝试备用方法: 创建文件链接');
  
  try {
    // 创建一个临时的文件URL
    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
    console.log('创建文件URL:', fileUrl);
    
    // 尝试在新标签页中打开
    chrome.tabs.create({
      url: fileUrl,
      active: false
    }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('备用方法失败:', chrome.runtime.lastError.message);
        showOpenFileNotification(filePath);
      } else {
        console.log('备用方法成功: 在新标签页中打开图片');
        // 延迟关闭标签页，让系统有时间处理
        setTimeout(() => {
          chrome.tabs.remove(tab.id);
        }, 2000);
      }
    });
  } catch (error) {
    console.error('备用方法异常:', error);
    showOpenFileNotification(filePath);
  }
}

// 显示通知提示用户手动打开
function showOpenFileNotification(filePath) {
  console.log('显示打开文件通知');
  
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
    console.log('开始下载图片:', imageUrl);
    
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
    
    console.log('文件名:', filename);
    
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
  console.log('收到消息:', request);
  
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
  }
});
