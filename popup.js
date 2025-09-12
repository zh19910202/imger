// 默认设置
const defaultSettings = {
  autoOpenImages: true,
  soundEnabled: true,
  autoCompareEnabled: true,
  f1Interval: 800,
  f1MaxRuns: 0
};

 // 加载设置（增加DOM健壮性）
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (items) => {
    const autoOpenEl = document.getElementById('autoOpenToggle');
    const soundEl = document.getElementById('soundToggle');
    const autoCompareEl = document.getElementById('autoCompareToggle');
    const f1IntervalEl = document.getElementById('f1Interval');
    const f1MaxRunsEl = document.getElementById('f1MaxRuns');

    if (autoOpenEl) autoOpenEl.checked = !!items.autoOpenImages;
    if (soundEl) soundEl.checked = !!items.soundEnabled;
    if (autoCompareEl) autoCompareEl.checked = !!items.autoCompareEnabled;
    if (f1IntervalEl) f1IntervalEl.value = items.f1Interval ?? defaultSettings.f1Interval;
    if (f1MaxRunsEl) f1MaxRunsEl.value = items.f1MaxRuns ?? defaultSettings.f1MaxRuns;
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();
  
  // 音效开关事件
  const soundToggle = document.getElementById('soundToggle');
  if (soundToggle) soundToggle.addEventListener('change', (event) => {
    const soundEnabled = event.target.checked;
    chrome.storage.sync.set({ soundEnabled }, () => {
      console.log('音效设置已更新:', soundEnabled);
    });
  });
  
  // 自动打开图片开关事件
  const autoOpenToggle = document.getElementById('autoOpenToggle');
  if (autoOpenToggle) autoOpenToggle.addEventListener('change', (event) => {
    const autoOpenImages = event.target.checked;
    chrome.storage.sync.set({ autoOpenImages }, () => {
      console.log('自动打开图片设置已更新:', autoOpenImages);
    });
  });
  
  // 自动对比开关事件
  const autoCompareToggle = document.getElementById('autoCompareToggle');
  if (autoCompareToggle) autoCompareToggle.addEventListener('change', (event) => {
    const autoCompareEnabled = event.target.checked;
    chrome.storage.sync.set({ autoCompareEnabled }, () => {
      console.log('自动对比设置已更新:', autoCompareEnabled);
    });
  });
  
  // F1 间隔设置事件
  const f1IntervalInput = document.getElementById('f1Interval');
  if (f1IntervalInput) f1IntervalInput.addEventListener('change', (event) => {
    const v = Number.parseInt(event.target.value, 10);
    const f1Interval = Number.isFinite(v) && v >= 100 && v <= 5000 ? v : defaultSettings.f1Interval;
    event.target.value = f1Interval;
    chrome.storage.sync.set({ f1Interval }, () => {
      console.log('F1间隔设置已更新:', f1Interval);
    });
  });
  
  // F1 最大执行次数设置事件
  const f1MaxRunsInput = document.getElementById('f1MaxRuns');
  if (f1MaxRunsInput) f1MaxRunsInput.addEventListener('change', (event) => {
    const v = Number.parseInt(event.target.value, 10);
    const f1MaxRuns = Number.isFinite(v) && v >= 0 && v <= 1000 ? v : defaultSettings.f1MaxRuns;
    event.target.value = f1MaxRuns;
    chrome.storage.sync.set({ f1MaxRuns }, () => {
      console.log('F1最大执行次数设置已更新:', f1MaxRuns);
    });
  });
  
  console.log('AnnotateFlow Assistant 设置页面已加载');
});
