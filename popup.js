// 默认设置
const defaultSettings = {
  autoOpenImages: true,
  soundEnabled: true
};

// 加载设置
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (items) => {
    document.getElementById('autoOpenToggle').checked = items.autoOpenImages;
    document.getElementById('soundToggle').checked = items.soundEnabled;
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();
  
  // 音效开关事件
  document.getElementById('soundToggle').addEventListener('change', (event) => {
    const soundEnabled = event.target.checked;
    chrome.storage.sync.set({ soundEnabled }, () => {
      console.log('音效设置已更新:', soundEnabled);
    });
  });
  
  // 自动打开图片开关事件
  document.getElementById('autoOpenToggle').addEventListener('change', (event) => {
    const autoOpenImages = event.target.checked;
    chrome.storage.sync.set({ autoOpenImages }, () => {
      console.log('自动打开图片设置已更新:', autoOpenImages);
    });
  });
  
  console.log('AnnotateFlow Assistant 设置页面已加载');
});
