#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试PS插件与Chrome扩展集成功能
"""

import requests
import json
import base64
import time
from pathlib import Path

def create_test_image_base64():
    """创建一个简单的测试图片的Base64编码"""
    # 这是一个1x1像素的透明PNG图片的Base64编码
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=="

def test_health_check():
    """测试健康检查端点"""
    try:
        response = requests.get('http://localhost:8888/api/health', timeout=5)
        print(f"健康检查状态: {response.status_code}")
        if response.status_code == 200:
            print(f"响应数据: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"健康检查失败: {e}")
        return False

def test_ps_request():
    """测试PS插件请求"""
    try:
        # 准备测试数据
        test_data = {
            "action": "process_data",
            "text_data": "这是来自PS插件的测试文本",
            "image_data": create_test_image_base64(),
            "metadata": {
                "image_format": "png",
                "image_width": 1,
                "image_height": 1,
                "timestamp": int(time.time()),
                "source": "photoshop_test"
            }
        }
        
        print("发送测试请求到Chrome扩展...")
        response = requests.post(
            'http://localhost:8888/api/process',
            json=test_data,
            timeout=35,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("请求成功!")
            print(f"响应数据: {json.dumps(result, indent=2, ensure_ascii=False)}")
            return True
        elif response.status_code == 408:
            print("请求超时 - Chrome扩展可能未响应")
        else:
            print(f"请求失败: {response.text}")
        
        return False
        
    except requests.exceptions.Timeout:
        print("请求超时")
        return False
    except Exception as e:
        print(f"测试请求失败: {e}")
        return False

def test_concurrent_requests():
    """测试并发请求"""
    import threading
    import concurrent.futures
    
    def send_request(request_id):
        test_data = {
            "action": "process_data",
            "text_data": f"并发测试请求 #{request_id}",
            "image_data": create_test_image_base64(),
            "metadata": {"request_id": request_id}
        }
        
        try:
            response = requests.post(
                'http://localhost:8888/api/process',
                json=test_data,
                timeout=35
            )
            return f"请求 #{request_id}: {response.status_code}"
        except Exception as e:
            return f"请求 #{request_id}: 失败 - {e}"
    
    print("测试并发请求...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(send_request, i) for i in range(3)]
        results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        for result in results:
            print(result)

def main():
    """主测试函数"""
    print("=== PS插件与Chrome扩展集成测试 ===\n")
    
    # 测试1: 健康检查
    print("1. 测试健康检查端点")
    if test_health_check():
        print("✓ 健康检查通过\n")
    else:
        print("✗ 健康检查失败 - 请确保native_host.py正在运行\n")
        return
    
    # 测试2: 基本请求
    print("2. 测试基本PS请求")
    if test_ps_request():
        print("✓ 基本请求测试通过\n")
    else:
        print("✗ 基本请求测试失败\n")
    
    # 测试3: 并发请求
    print("3. 测试并发请求")
    test_concurrent_requests()
    print("✓ 并发请求测试完成\n")
    
    print("=== 测试完成 ===")
    print("\n使用说明:")
    print("1. 确保native_host.py正在运行")
    print("2. 确保Chrome扩展已安装并能处理'ps_request'消息")
    print("3. Chrome扩展需要发送'ps_response'消息作为响应")

if __name__ == "__main__":
    main()