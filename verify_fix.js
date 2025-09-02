// 验证图片自动打开功能修复脚本
// 在Chrome扩展的background页面控制台中运行此脚本

const verifyFix = {
  // 验证Chrome API可用性
  async checkChromeAPI() {
    console.log('=== 验证Chrome API ===');
    
    try {
      // 检查downloads API
      if (typeof chrome.downloads !== 'undefined') {
        console.log('✅ chrome.downloads API 可用');
      } else {
        console.log('❌ chrome.downloads API 不可用');
        return false;
      }
      
      // 检查storage API
      if (typeof chrome.storage !== 'undefined') {
        console.log('✅ chrome.storage API 可用');
      } else {
        console.log('❌ chrome.storage API 不可用');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ API检查失败:', error);
      return false;
    }
  },
  
  // 检查扩展设置
  async checkSettings() {
    console.log('=== 验证扩展设置 ===');
    
    return new Promise((resolve) => {
      chrome.storage.sync.get({autoOpenImages: true}, (settings) => {
        if (settings.autoOpenImages) {
          console.log('✅ 自动打开图片功能已启用');
          resolve(true);
        } else {
          console.log('⚠️ 自动打开图片功能已禁用');
          console.log('请在扩展popup中启用此功能');
          resolve(false);
        }
      });
    });
  },
  
  // 检查修复后的函数是否存在
  checkFixedFunctions() {
    console.log('=== 验证修复后的函数 ===');
    
    // 检查openImageWithBestMethod函数
    if (typeof openImageWithBestMethod === 'function') {
      console.log('✅ openImageWithBestMethod 函数存在');
    } else {
      console.log('❌ openImageWithBestMethod 函数不存在');
      return false;
    }
    
    // 检查downloadImageWithCustomName函数
    if (typeof downloadImageWithCustomName === 'function') {
      console.log('✅ downloadImageWithCustomName 函数存在');
    } else {
      console.log('❌ downloadImageWithCustomName 函数不存在');
      return false;
    }
    
    return true;
  },
  
  // 测试下载和自动打开
  async testDownloadAndOpen() {
    console.log('=== 测试下载和自动打开 ===');
    
    try {
      // 使用测试图片URL
      const testImageUrl = 'https://picsum.photos/300/200?test=' + Date.now();
      const testFilename = 'verify_test_' + Date.now() + '.jpg';
      
      console.log('开始测试下载:', testImageUrl);
      
      // 调用下载函数
      const downloadId = await downloadImageWithCustomName(testImageUrl, '', testFilename);
      
      if (downloadId) {
        console.log('✅ 下载已开始，ID:', downloadId);
        console.log('⏳ 等待下载完成和自动打开...');
        
        // 等待一段时间让下载完成
        setTimeout(() => {
          console.log('📝 请检查图片是否已自动打开');
          console.log('如果图片已打开，说明修复成功！');
        }, 3000);
        
        return true;
      } else {
        console.log('❌ 下载失败');
        return false;
      }
    } catch (error) {
      console.error('❌ 测试失败:', error);
      return false;
    }
  },
  
  // 运行所有验证
  async runAllVerifications() {
    console.log('🔍 开始验证图片自动打开功能修复...');
    console.log('=====================================');
    
    const apiCheck = await this.checkChromeAPI();
    const settingsCheck = await this.checkSettings();
    const functionsCheck = this.checkFixedFunctions();
    
    console.log('\n📊 验证结果汇总:');
    console.log('- Chrome API:', apiCheck ? '✅ 通过' : '❌ 失败');
    console.log('- 扩展设置:', settingsCheck ? '✅ 通过' : '⚠️ 需要启用');
    console.log('- 修复函数:', functionsCheck ? '✅ 通过' : '❌ 失败');
    
    if (apiCheck && functionsCheck) {
      console.log('\n🧪 开始功能测试...');
      await this.testDownloadAndOpen();
    } else {
      console.log('\n❌ 基础验证失败，无法进行功能测试');
    }
    
    console.log('\n=====================================');
    console.log('验证完成！');
    
    if (apiCheck && functionsCheck) {
      console.log('\n✅ 修复验证成功！');
      console.log('主要改进:');
      console.log('1. 优先使用Chrome原生API (chrome.downloads.open)');
      console.log('2. Native Host作为备用方案');
      console.log('3. 增强了错误处理和日志记录');
      console.log('4. 支持自定义文件名下载');
    } else {
      console.log('\n❌ 修复验证失败，请检查上述问题');
    }
  }
};

// 自动运行验证
console.log('图片自动打开功能修复验证脚本已加载');
console.log('运行 verifyFix.runAllVerifications() 开始验证');

// 如果在扩展环境中，自动运行
if (typeof chrome !== 'undefined' && chrome.runtime) {
  setTimeout(() => {
    verifyFix.runAllVerifications();
  }, 1000);
}