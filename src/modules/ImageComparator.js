// src/modules/ImageComparator.js
(function(window) {
    'use strict';

    if (!window.ImageComparator) {
        window.ImageComparator = {};
    }

    let selectedImages = [];
    let comparisonView = null;

    function handleImageSelection(image) {
        const index = selectedImages.findIndex(img => img.src === image.src);
        if (index > -1) {
            selectedImages.splice(index, 1);
            image.style.border = 'none';
        } else {
            if (selectedImages.length < 2) {
                selectedImages.push(image);
                image.style.border = '3px solid #007bff';
            }
        }
        updateComparisonView();
    }

    function updateComparisonView() {
        if (!comparisonView) return;

        comparisonView.innerHTML = ''; // 清空现有内容

        if (selectedImages.length === 0) {
            comparisonView.innerHTML = '<p>请选择1到2张图片进行对比。</p>';
            return;
        }

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.justifyContent = 'space-around';
        container.style.alignItems = 'center';
        container.style.height = '100%';

        selectedImages.forEach(img => {
            const wrapper = document.createElement('div');
            wrapper.style.maxWidth = '48%';
            wrapper.style.maxHeight = '100%';
            const newImg = document.createElement('img');
            newImg.src = img.src;
            newImg.style.maxWidth = '100%';
            newImg.style.maxHeight = '100%';
            newImg.style.objectFit = 'contain';
            wrapper.appendChild(newImg);
            container.appendChild(wrapper);
        });

        comparisonView.appendChild(container);
    }

    function init(modalBody) {
        comparisonView = modalBody;
        selectedImages = [];
        updateComparisonView();

        // 为页面上的所有图片添加点击事件监听器
        document.querySelectorAll('img').forEach(img => {
            img.addEventListener('click', () => handleImageSelection(img));
        });
    }

    function cleanup() {
        // 移除事件监听器
        document.querySelectorAll('img').forEach(img => {
            const newImg = img.cloneNode(true);
            img.parentNode.replaceChild(newImg, img);
            newImg.style.border = 'none'; // 清除边框
        });
        selectedImages = [];
        comparisonView = null;
    }

    window.ImageComparator.init = init;
    window.ImageComparator.cleanup = cleanup;

})(window);j