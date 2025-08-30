// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "downloadImage",
    title: "快捷下载图片",
    contexts: ["image"]
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "downloadImage") {
    downloadImage(info.srcUrl, tab.url);
  }
});

// 下载图片函数
async function downloadImage(imageUrl, pageUrl) {
  try {
    console.log('开始下载图片:', imageUrl);
    
    // 获取用户设置
    const settings = await chrome.storage.sync.get({
      autoOpen: true
    });
    
    // 从URL中提取文件名
    const url = new URL(imageUrl);
    let filename = url.pathname.split('/').pop();
    
    // 如果没有文件名或扩展名，生成一个
    if (!filename || !filename.includes('.')) {
      const timestamp = new Date().getTime();
      filename = `image_${timestamp}.jpg`;
    }
    
    // 使用固定的下载路径
    const fixedPath = 'C:\\Users\\ADMIN\\Desktop\\ImageDownloader';
    const fullPath = `${fixedPath}\\${filename}`;
    
    console.log('文件名:', filename);
    console.log('下载路径:', fullPath);
    console.log('用户设置:', settings);
    
    // 开始下载
    const downloadId = await chrome.downloads.download({
      url: imageUrl,
      filename: fullPath,
      saveAs: false
    });
    
    console.log('下载ID:', downloadId);
    
    // 监听下载完成事件
    chrome.downloads.onChanged.addListener(function listener(delta) {
      console.log('下载状态变化:', delta);
      if (delta.id === downloadId && delta.state && delta.state.current === 'complete') {
        console.log('下载完成');
        
        // 根据用户设置决定是否尝试打开文件
        if (settings.autoOpen) {
          console.log('尝试打开文件');
          try {
            // 尝试使用Chrome的downloads.open API
            // 这会使用系统默认应用打开文件
            chrome.downloads.open(downloadId);
            console.log('文件打开请求已发送');
          } catch (error) {
            console.log('无法自动打开文件，用户需要手动打开:', error);
          }
        } else {
          console.log('用户设置不自动打开文件');
        }
        
        // 移除监听器
        chrome.downloads.onChanged.removeListener(listener);
      }
    });
    
  } catch (error) {
    console.error('下载图片失败:', error);
  }
}

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadImage") {
    downloadImage(request.imageUrl, sender.tab?.url || '');
    sendResponse({success: true});
  }
});
