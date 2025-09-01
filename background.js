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
                console.log('尝试通过Native Host自动打开图片');
                
                // 延迟确保文件完全写入
                setTimeout(() => {
                  openImageWithNativeHost(download.filename);
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

// 通过Native Host打开图片
function openImageWithNativeHost(filePath) {
  if (!nativePort) {
    console.error('Native Host未连接');
    return;
  }
  
  try {
    console.log('发送打开请求到Native Host:', filePath);
    nativePort.postMessage({
      action: 'open_file',
      file_path: filePath
    });
  } catch (error) {
    console.error('发送Native Host消息失败:', error);
  }
}

// 下载图片函数
async function downloadImage(imageUrl, pageUrl) {
  try {
    console.log('开始下载图片:', imageUrl);
    
    // 从URL中提取文件名
    const url = new URL(imageUrl);
    let filename = url.pathname.split('/').pop();
    
    // 如果没有文件名或扩展名，生成一个
    if (!filename || !filename.includes('.')) {
      const timestamp = new Date().getTime();
      filename = `image_${timestamp}.jpg`;
    }
    
    console.log('文件名:', filename);
    
    // 开始下载
    const downloadId = await chrome.downloads.download({
      url: imageUrl,
      filename: filename,
      saveAs: false
    });
    
    console.log('下载ID:', downloadId);
    
  } catch (error) {
    console.error('下载图片失败:', error);
  }
}

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request);
  
  if (request.action === "downloadImage") {
    downloadImage(request.imageUrl, sender.tab?.url || '');
    sendResponse({success: true});
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
  }
});
