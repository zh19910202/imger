// 调试自动打开功能的脚本
// 在Chrome扩展的background页面控制台中运行

console.log('=== 自动打开功能调试脚本 ===');

// 1. 检查权限
console.log('1. 检查权限:');
console.log('- downloads权限:', chrome.downloads ? '✓ 可用' : '✗ 不可用');
console.log('- storage权限:', chrome.storage ? '✓ 可用' : '✗ 不可用');

// 2. 检查当前设置
chrome.storage.sync.get({autoOpenImages: true}, (settings) => {
  console.log('2. 当前设置:');
  console.log('- autoOpenImages:', settings.autoOpenImages);
});

// 3. 测试下载功能
async function testDownloadAndOpen() {
  console.log('3. 测试下载和自动打开功能:');
  
  const testImageUrl = 'https://picsum.photos/400/300?random=' + Date.now();
  console.log('- 测试图片URL:', testImageUrl);
  
  try {
    // 开始下载
    const downloadId = await chrome.downloads.download({
      url: testImageUrl,
      filename: 'test_image.jpg',
      saveAs: false
    });
    
    console.log('- 下载ID:', downloadId);
    
    // 监听下载状态
    const listener = (delta) => {
      console.log('- 下载状态变化:', delta);
      
      if (delta.id === downloadId && delta.state && delta.state.current === 'complete') {
        console.log('- 下载完成，准备打开文件...');
        
        // 延迟后尝试打开
        setTimeout(() => {
          chrome.downloads.open(downloadId, (result) => {
            if (chrome.runtime.lastError) {
              console.error('- 打开失败:', chrome.runtime.lastError);
            } else {
              console.log('- 打开成功');
            }
          });
        }, 1000);
        
        // 移除监听器
        chrome.downloads.onChanged.removeListener(listener);
      }
    };
    
    chrome.downloads.onChanged.addListener(listener);
    
  } catch (error) {
    console.error('- 下载失败:', error);
  }
}

// 4. 检查系统兼容性
function checkSystemCompatibility() {
  console.log('4. 系统兼容性检查:');
  
  // 检查操作系统
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Windows')) {
    console.log('- 操作系统: Windows');
  } else if (userAgent.includes('Mac')) {
    console.log('- 操作系统: macOS');
  } else if (userAgent.includes('Linux')) {
    console.log('- 操作系统: Linux');
  } else {
    console.log('- 操作系统: 未知');
  }
  
  // 检查Chrome版本
  const chromeVersion = userAgent.match(/Chrome\/(\d+)/);
  if (chromeVersion) {
    console.log('- Chrome版本:', chromeVersion[1]);
  }
}

// 5. 测试文件类型检测
function testFileTypeDetection() {
  console.log('5. 文件类型检测测试:');
  
  const testFiles = [
    'image.jpg',
    'photo.jpeg',
    'picture.png',
    'animation.gif',
    'web_image.webp',
    'bitmap.bmp',
    'document.pdf',
    'text.txt'
  ];
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
  
  testFiles.forEach(filename => {
    const isImage = imageExtensions.some(ext => 
      filename.toLowerCase().endsWith(ext)
    );
    console.log(`- ${filename}: ${isImage ? '图片' : '非图片'}`);
  });
}

// 运行所有测试
console.log('\n开始运行调试测试...\n');

checkSystemCompatibility();
testFileTypeDetection();

// 等待一下再运行下载测试
setTimeout(() => {
  testDownloadAndOpen();
}, 1000);

console.log('\n调试脚本运行完成。请查看控制台输出。');
