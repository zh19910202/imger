// 默认设置
const defaultSettings = {
  autoOpenImages: true,
  soundEnabled: true,
  autoCompareEnabled: true,
  f1Interval: 800,
  f1MaxRuns: 0,
  runninghubWorkflows: ['defaultWorkflow'],
  defaultWorkflow: 'defaultWorkflow'
};

// 加载设置（增加DOM健壮性）
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (items) => {
    const autoOpenEl = document.getElementById('autoOpenToggle');
    const soundEl = document.getElementById('soundToggle');
    const autoCompareEl = document.getElementById('autoCompareToggle');
    const f1IntervalEl = document.getElementById('f1Interval');
    const f1MaxRunsEl = document.getElementById('f1MaxRuns');
    const defaultWorkflowSelect = document.getElementById('defaultWorkflow');

    if (autoOpenEl) autoOpenEl.checked = !!items.autoOpenImages;
    if (soundEl) soundEl.checked = !!items.soundEnabled;
    if (autoCompareEl) autoCompareEl.checked = !!items.autoCompareEnabled;
    if (f1IntervalEl) f1IntervalEl.value = items.f1Interval ?? defaultSettings.f1Interval;
    if (f1MaxRunsEl) f1MaxRunsEl.value = items.f1MaxRuns ?? defaultSettings.f1MaxRuns;

    // 更新工作流选择列表
    if (defaultWorkflowSelect) {
      const workflows = items.runninghubWorkflows || ['defaultWorkflow'];
      updateWorkflowSelect(workflows, items.defaultWorkflow || 'defaultWorkflow');
    }
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

  // RunningHub 工作流配置导入事件
  const importConfigBtn = document.getElementById('importConfigBtn');
  const configFileInput = document.getElementById('configFileInput');
  const defaultWorkflowSelect = document.getElementById('defaultWorkflow');

  if (importConfigBtn && configFileInput) {
    importConfigBtn.addEventListener('click', () => {
      configFileInput.click();
    });

    configFileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file && file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const config = JSON.parse(e.target.result);
            const workflowName = file.name.replace('.json', '');

            // 保存配置到存储
            chrome.storage.sync.get(defaultSettings, (items) => {
              const workflows = items.runninghubWorkflows || ['defaultWorkflow'];
              if (!workflows.includes(workflowName)) {
                workflows.push(workflowName);
              }

              const update = {
                [`runninghubWorkflow_${workflowName}`]: config,
                runninghubWorkflows: workflows
              };

              chrome.storage.sync.set(update, () => {
                console.log('工作流配置已导入:', workflowName);
                updateWorkflowSelect(workflows, items.defaultWorkflow);
                showNotification('工作流配置导入成功！');
              });
            });
          } catch (error) {
            console.error('配置文件解析失败:', error);
            showNotification('配置文件格式错误！');
          }
        };
        reader.readAsText(file);
      }
    });
  }

  // 默认工作流选择事件
  if (defaultWorkflowSelect) {
    defaultWorkflowSelect.addEventListener('change', (event) => {
      const defaultWorkflow = event.target.value;
      chrome.storage.sync.set({ defaultWorkflow }, () => {
        console.log('默认工作流已更新:', defaultWorkflow);
      });
    });
  }

  console.log('AnnotateFlow Assistant 设置页面已加载');
});

// 更新工作流选择列表
function updateWorkflowSelect(workflows, defaultWorkflow) {
  const defaultWorkflowSelect = document.getElementById('defaultWorkflow');
  if (defaultWorkflowSelect) {
    defaultWorkflowSelect.innerHTML = '';
    workflows.forEach(workflow => {
      const option = document.createElement('option');
      option.value = workflow;
      option.textContent = workflow === 'defaultWorkflow' ? '默认工作流' : workflow;
      if (workflow === defaultWorkflow) {
        option.selected = true;
      }
      defaultWorkflowSelect.appendChild(option);
    });
  }
}

// 显示通知
function showNotification(message) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
  `;

  document.body.appendChild(notification);

  // 3秒后移除通知
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}
