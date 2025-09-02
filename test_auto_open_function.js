// 测试自动打开功能的脚本
// 在Chrome扩展的background页面控制台中运行

console.log('=== 自动打开功能测试脚本 ===');

// 1. 检查权限和API可用性
function checkPermissions() {
  console.log('\n1. 检查权限和API:');
  console.log('- downloads权限:', chrome.downloads ? '✓ 可用' : '✗ 不可用');
  console.log('- storage权限:', chrome.storage ? '✓ 可用' : '✗ 不可用');
  console.log('- runtime权限:', chrome.runtime ? '✓ 可用' : '✗ 不可用');
}

// 2. 检查当前设置
function checkSettings() {
  console.log('\n2. 检查当前设置:');
  chrome.storage.sync.get({autoOpenImages: true}, (settings) => {
    console.log('- autoOpenImages:', settings.autoOpenImages);
  });
}

// 3. 测试Native Host连接
function testNativeHostConnection() {
  console.log('\n3. 测试Native Host连接:');
  
  try {
    const port = chrome.runtime.connectNative('com.annotateflow.assistant');
    
    port.onMessage.addListener((response) => {
      console.log('- Native Host响应:', response);
    });
    
    port.onDisconnect.addListener(() => {
      console.log('- Native Host连接状态: 断开');
      if (chrome.runtime.lastError) {
        console.error('- 连接错误:', chrome.runtime.lastError.message);
      }
    });
    
    // 发送测试消息
    port.postMessage({
      action: 'test_connection'
    });
    
    console.log('- Native Host连接状态: 已建立');
    
  } catch (error) {
    console.error('- Native Host连接失败:', error);
  }
}

// 4. 测试Chrome downloads.open API
function testChromeDownloadsOpen() {
  console.log('\n4. 测试Chrome downloads.open API:');
  
  // 检查API是否可用
  if (chrome.downloads && chrome.downloads.open) {
    console.log('- chrome.downloads.open API: ✓ 可用');
    
    // 获取最近的下载项进行测试
    chrome.downloads.search({limit: 1, orderBy: ['-startTime']}, (downloads) => {
      if (downloads && downloads.length > 0) {
        const lastDownload = downloads[0];
        console.log('- 最近下载项:', lastDownload.filename);
        console.log('- 下载状态:', lastDownload.state);
        
        if (lastDownload.state === 'complete') {
          console.log('- 尝试使用chrome.downloads.open打开文件...');
          chrome.downloads.open(lastDownload.id, () => {
            if (chrome.runtime.lastError) {
              console.error('- chrome.downloads.open失败:', chrome.runtime.lastError.message);
            } else {
              console.log('- chrome.downloads.open成功');
            }
          });
        }
      } else {
        console.log('- 没有找到下载项');
      }
    });
  } else {
    console.error('- chrome.downloads.open API: ✗ 不可用');
  }
}

// 5. 测试下载并自动打开
function testDownloadAndAutoOpen() {
  console.log('\n5. 测试下载并自动打开:');
  
  const testImageUrl = 'https://picsum.photos/400/300?random=' + Date.now();
  console.log('- 测试图片URL:', testImageUrl);
  
  chrome.downloads.download({
    url: testImageUrl,
    filename: 'test_auto_open_' + Date.now() + '.jpg',
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('- 下载失败:', chrome.runtime.lastError.message);
      return;
    }
    
    console.log('- 下载ID:', downloadId);
    
    // 监听下载完成
    const listener = (delta) => {
      if (delta.id === downloadId && delta.state && delta.state.current === 'complete') {
        console.log('- 下载完成，测试自动打开...');
        
        // 移除监听器
        chrome.downloads.onChanged.removeListener(listener);
        
        // 延迟后尝试打开
        setTimeout(() => {
          // 方法1: 使用chrome.downloads.open
          chrome.downloads.open(downloadId, () => {
            if (chrome.runtime.lastError) {
              console.error('- 方法1失败:', chrome.runtime.lastError.message);
              
              // 方法2: 使用chrome.downloads.show
              chrome.downloads.show(downloadId);
              console.log('- 已使用chrome.downloads.show显示文件位置');
            } else {
              console.log('- 方法1成功: chrome.downloads.open');
            }
          });
        }, 1000);
      }
    };
    
    chrome.downloads.onChanged.addListener(listener);
  });
}

// 运行所有测试
function runAllTests() {
  checkPermissions();
  checkSettings();
  testNativeHostConnection();
  
  setTimeout(() => {
    testChromeDownloadsOpen();
  }, 1000);
  
  setTimeout(() => {
    testDownloadAndAutoOpen();
  }, 2000);
}

// 导出测试函数
window.testAutoOpenFunction = {
  runAllTests,
  checkPermissions,
  checkSettings,
  testNativeHostConnection,
  testChromeDownloadsOpen,
  testDownloadAndAutoOpen
};

console.log('\n测试脚本已加载。运行 testAutoOpenFunction.runAllTests() 开始测试。');
console.log('或者单独运行各个测试函数。');