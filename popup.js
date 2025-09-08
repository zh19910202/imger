// 默认设置
const defaultSettings = {
  autoOpenImages: true,
  soundEnabled: true,
  f1Interval: 800,
  f1MaxRuns: 0
};

// 加载设置
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (items) => {
    document.getElementById('autoOpenToggle').checked = items.autoOpenImages;
    document.getElementById('soundToggle').checked = items.soundEnabled;
    document.getElementById('f1Interval').value = items.f1Interval;
    document.getElementById('f1MaxRuns').value = items.f1MaxRuns;
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
  
  // F1 间隔设置事件
  document.getElementById('f1Interval').addEventListener('change', (event) => {
    const f1Interval = parseInt(event.target.value) || 800;
    chrome.storage.sync.set({ f1Interval }, () => {
      console.log('F1间隔设置已更新:', f1Interval);
    });
  });
  
  // F1 最大执行次数设置事件
  document.getElementById('f1MaxRuns').addEventListener('change', (event) => {
    const f1MaxRuns = parseInt(event.target.value) || 0;
    chrome.storage.sync.set({ f1MaxRuns }, () => {
      console.log('F1最大执行次数设置已更新:', f1MaxRuns);
    });
  });
  
  console.log('AnnotateFlow Assistant 设置页面已加载');
});
