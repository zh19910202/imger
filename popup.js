// 默认设置
const defaultSettings = {
  autoOpen: true
};

// 加载设置
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (items) => {
    document.getElementById('autoOpen').checked = items.autoOpen;
  });
}

// 保存设置
function saveSettings() {
  const settings = {
    autoOpen: document.getElementById('autoOpen').checked
  };
  
  chrome.storage.sync.set(settings, () => {
    // 显示保存成功提示
    const saveBtn = document.getElementById('saveSettings');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '已保存！';
    saveBtn.style.background = '#45a049';
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '#4CAF50';
    }, 2000);
    
    console.log('设置已保存:', settings);
  });
}

// 重置设置
function resetSettings() {
  document.getElementById('autoOpen').checked = defaultSettings.autoOpen;
  
  chrome.storage.sync.set(defaultSettings, () => {
    console.log('设置已重置为默认值');
  });
}

// 路径选择功能已移除，使用固定路径

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();
  
  // 绑定事件
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('resetSettings').addEventListener('click', resetSettings);
  
  console.log('图片快捷下载器设置页面已加载');
});
