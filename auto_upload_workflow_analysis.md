# Auto-Upload Notification Workflow Analysis

## Overview
This document details the complete auto-upload notification workflow from external applications (like Photoshop plugins) to the Chrome extension for automatic image uploading to the Tencent QLabel annotation platform.

## Complete Workflow

### 1. External Application Integration
External applications (e.g., Photoshop plugins) communicate with the Native Host via HTTP API:

**Endpoint**: `POST /api/external-data`
**Required Data**:
- `modified_image`: Base64 encoded modified image
- `mask_image`: Base64 encoded mask image

### 2. Native Host Processing (native_host.py)
When external applications POST to `/api/external-data`:

1. Data is validated and stored in `image_data_store["external_application"]`
2. An auto-upload notification is generated:
   ```python
   notification = {
       "action": "auto_upload_notification",
       "message": "External application data received, triggering auto upload",
       "data_type": "external_application",
       "timestamp": time.time()
   }
   ```
3. Notification is placed in `native_messaging_send_queue`
4. Notification is sent to Chrome extension via Native Messaging

### 3. Background Script Handling (background.js)
The Chrome extension background script receives and processes the notification:

1. Listens for Native Host messages via `port.onMessage.addListener`
2. Detects `auto_upload_notification` action:
   ```javascript
   if (response.action === 'auto_upload_notification') {
       // Get current active tab
       chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
           if (tabs && tabs.length > 0) {
               const activeTab = tabs[0];
               // Check if tab is QLabel annotation page
               if (activeTab.url && activeTab.url.includes('qlabel.tencent.com')) {
                   // Send message to content script
                   chrome.tabs.sendMessage(activeTab.id, {
                       action: 'trigger_auto_upload',
                       data: response
                   });
               }
           }
       });
   }
   ```

### 4. Content Script Processing (content.js)
The content script on the QLabel page handles the upload trigger:

1. Listens for `trigger_auto_upload` messages:
   ```javascript
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
       if (message.action === 'trigger_auto_upload') {
           handleAutoUploadNotification(message.data);
       }
   });
   ```

2. Processes the auto-upload notification:
   ```javascript
   function handleAutoUploadNotification(data) {
       showNotification('收到PS处理完成通知，正在自动上传图片...', 2000);
       setTimeout(() => {
           uploadNativeHostImageToAnnotationPlatform()
               .then(() => {
                   showNotification('✅ 图片已自动上传完成', 3000);
               })
               .catch(error => {
                   showNotification(`❌ 自动上传失败: ${error.message}`, 3000);
               });
       }, 1000);
   }
   ```

3. Uploads images to annotation platform:
   - Retrieves image data from Native Host storage
   - Processes both modified and mask images
   - Uploads to current annotation task

## Key Components

### Native Host Key Functions
- HTTP server for external app communication
- Native Messaging for Chrome extension communication
- Data storage for image data from both sources
- Auto-upload notification generation

### Background Script Key Functions
- Native Messaging connection management
- Message routing from Native Host to content scripts
- Active tab detection and validation
- Security filtering (only QLabel pages)

### Content Script Key Functions
- Message handling from background script
- User notification display
- Image data retrieval from Native Host
- Automated upload to annotation platform

## Testing

### Manual Testing
1. Run external application that POSTs to `/api/external-data`
2. Observe Native Host console output
3. Check Chrome extension console for notification handling
4. Verify automatic upload occurs on QLabel page

### Script-based Testing
Use `test_native_messaging.py` to send test notifications:
```python
test_message = {
    "action": "auto_upload_notification",
    "message": "测试消息",
    "data_type": "test",
    "timestamp": time.time()
}
```

## Security Considerations
- Only QLabel pages can receive auto-upload notifications
- Native Messaging requires explicit user installation
- Data validation at each processing step
- Error handling for failed uploads

## Error Handling
- Connection failures between components
- Data validation errors
- Upload failures to annotation platform
- Notification display for success/failure states