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

// 初始化Native Messaging连接
function initializeNativeMessaging() {
  try {
    nativePort = chrome.runtime.connectNative('com.annotateflow.assistant');
    
    nativePort.onMessage.addListener((response) => {
      console.log('Native Host响应:', response);
      if (response.success) {
        console.log('图片已通过Native Host成功打开');
      } else {
        console.error('Native Host打开失败:', response.error);
      }
    });
    
    nativePort.onDisconnect.addListener(() => {
      console.log('Native Host连接断开');
      nativePort = null;
    });
    
    console.log('Native Messaging连接已建立');
  } catch (error) {
    console.error('Native Messaging连接失败:', error);
  }
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
                
                // 延迟确保文件完全写入
                setTimeout(() => {
                  openImageWithBestMethod(delta.id, download.filename);
                }, 1000);
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

// 通过多种方式打开图片 (不依赖用户手势)
function openImageWithBestMethod(downloadId, filePath) {
  console.log('尝试打开图片，下载ID:', downloadId, '文件路径:', filePath);
  
  // 方法1: 使用Native Host (主要方法，不需要用户手势)
  if (nativePort) {
    console.log('尝试方法1: Native Host');
    tryNativeHostOpen(filePath);
  } else {
    console.log('Native Host未连接，尝试重新连接');
    initializeNativeMessaging();
    
    // 等待连接建立后再尝试
    setTimeout(() => {
      if (nativePort) {
        tryNativeHostOpen(filePath);
      } else {
        console.error('Native Host连接失败，尝试备用方法');
        tryAlternativeOpen(filePath);
      }
    }, 1000);
  }
}

// 通过Native Host打开图片
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
    nativePort.postMessage({
      action: 'open_file',
      file_path: filePath
    });
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
