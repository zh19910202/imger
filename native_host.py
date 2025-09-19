#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced Native Host for Chrome Extension
支持文件操作和PS插件通信的双重功能
"""

import sys
import json
import struct
import subprocess
import os
import platform
import threading
import queue
import time
import uuid
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import base64

# 全局配置
HTTP_SERVER_CONFIG = {
    "host": "localhost",
    "port": 8888,
    "timeout": 30,  # 请求超时时间(秒)
    "max_request_size": 50 * 1024 * 1024,  # 50MB
}

# 全局变量
http_request_queue = queue.Queue()
pending_requests = {}  # 存储待处理的请求
request_lock = threading.Lock()

def send_message(message):
    """发送消息到Chrome扩展"""
    try:
        encoded_message = json.dumps(message).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('I', len(encoded_message)))
        sys.stdout.buffer.write(encoded_message)
        sys.stdout.buffer.flush()
    except Exception as e:
        # 记录错误但不中断程序
        pass

def read_message():
    """从Chrome扩展读取消息"""
    try:
        raw_length = sys.stdin.buffer.read(4)
        if not raw_length:
            return None
        message_length = struct.unpack('I', raw_length)[0]
        message = sys.stdin.buffer.read(message_length).decode('utf-8')
        return json.loads(message)
    except Exception:
        return None

def generate_request_id():
    """生成唯一请求ID"""
    return f"req_{int(time.time())}_{str(uuid.uuid4())[:8]}"

def check_file_ready(file_path, check_id=None):
    """检查文件是否存在且可读"""
    try:
        result = {"action": "check_file_result"}
        if check_id:
            result["check_id"] = check_id
            
        if not os.path.exists(file_path):
            result.update({"exists": False, "readable": False})
            return result
        
        # 检查文件是否可读且大小大于0
        if os.path.isfile(file_path) and os.access(file_path, os.R_OK):
            file_size = os.path.getsize(file_path)
            result.update({
                "exists": True, 
                "readable": True,
                "size": file_size
            })
        else:
            result.update({"exists": True, "readable": False, "size": 0})
            
        return result
            
    except Exception as e:
        result = {
            "action": "check_file_result", 
            "exists": False, 
            "readable": False, 
            "error": str(e)
        }
        if check_id:
            result["check_id"] = check_id
        return result

def open_file_with_default_app(file_path, open_id=None):
    """使用系统默认应用打开文件"""
    try:
        system = platform.system().lower()
        # 规范化路径，提升兼容性
        file_path = str(Path(file_path).expanduser().resolve())
        
        if system == "windows":
            os.startfile(file_path)
        elif system == "darwin":  # macOS
            subprocess.run(['open', file_path], check=True)
        elif system == "linux":
            subprocess.run(['xdg-open', file_path], check=True)
        else:
            raise Exception(f"Unsupported operating system: {system}")
            
        result = {"success": True, "message": f"Successfully opened {file_path}"}
        if open_id:
            result["open_id"] = open_id
        return result
    except Exception as e:
        result = {"success": False, "error": str(e)}
        if open_id:
            result["open_id"] = open_id
        return result

class PSRequestHandler(BaseHTTPRequestHandler):
    """处理来自PS插件的HTTP请求"""
    
    def do_POST(self):
        """处理POST请求"""
        try:
            # 检查路径
            if self.path != '/api/process':
                self.send_error(404, "Not Found")
                return
            
            # 读取请求数据
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > HTTP_SERVER_CONFIG["max_request_size"]:
                self.send_error(413, "Request too large")
                return
                
            post_data = self.rfile.read(content_length)
            
            # 解析JSON数据
            try:
                request_data = json.loads(post_data.decode('utf-8'))
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON")
                return
            
            # 生成请求ID
            request_id = generate_request_id()
            
            # 创建响应事件
            response_event = threading.Event()
            
            # 存储请求信息
            with request_lock:
                pending_requests[request_id] = {
                    "timestamp": time.time(),
                    "response_event": response_event,
                    "response_data": None
                }
            
            # 构造发送给Chrome扩展的消息
            chrome_message = {
                "action": "ps_request",
                "request_id": request_id,
                "text_data": request_data.get("text_data", ""),
                "image_data": request_data.get("image_data", ""),
                "metadata": request_data.get("metadata", {})
            }
            
            # 放入队列
            http_request_queue.put(chrome_message)
            
            # 等待响应
            timeout = HTTP_SERVER_CONFIG["timeout"]
            if response_event.wait(timeout):
                # 获取响应数据
                with request_lock:
                    response_data = pending_requests[request_id]["response_data"]
                    del pending_requests[request_id]
                
                # 发送响应
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
            else:
                # 超时处理
                with request_lock:
                    if request_id in pending_requests:
                        del pending_requests[request_id]
                
                self.send_error(408, "Request timeout")
                
        except Exception as e:
            self.send_error(500, f"Internal server error: {str(e)}")
    
    def do_GET(self):
        """处理GET请求 - 健康检查"""
        if self.path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            health_data = {
                "status": "healthy",
                "version": "2.0.0",
                "chrome_extension_connected": True,
                "pending_requests": len(pending_requests)
            }
            self.wfile.write(json.dumps(health_data).encode('utf-8'))
        else:
            self.send_error(404, "Not Found")
    
    def do_OPTIONS(self):
        """处理OPTIONS请求 - CORS预检"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """禁用默认日志输出"""
        pass

def start_http_server():
    """启动HTTP服务器"""
    try:
        server = HTTPServer((HTTP_SERVER_CONFIG["host"], HTTP_SERVER_CONFIG["port"]), PSRequestHandler)
        server.serve_forever()
    except Exception as e:
        # HTTP服务器启动失败，但不影响Native Messaging功能
        pass

def handle_ps_response(message):
    """处理来自Chrome扩展的PS响应"""
    request_id = message.get("request_id")
    if not request_id:
        return
    
    with request_lock:
        if request_id in pending_requests:
            # 存储响应数据
            pending_requests[request_id]["response_data"] = {
                "success": message.get("success", False),
                "result_data": message.get("result_data", ""),
                "processed_image": message.get("processed_image", ""),
                "metadata": message.get("metadata", {}),
                "error": message.get("error", "")
            }
            # 通知等待的HTTP请求
            pending_requests[request_id]["response_event"].set()

def cleanup_expired_requests():
    """清理过期的请求"""
    current_time = time.time()
    expired_requests = []
    
    with request_lock:
        for request_id, request_info in pending_requests.items():
            if current_time - request_info["timestamp"] > HTTP_SERVER_CONFIG["timeout"]:
                expired_requests.append(request_id)
        
        for request_id in expired_requests:
            if request_id in pending_requests:
                pending_requests[request_id]["response_event"].set()
                del pending_requests[request_id]

def main():
    """主函数 - 增强版支持HTTP服务器"""
    try:
        # 启动HTTP服务器线程
        http_thread = threading.Thread(target=start_http_server, daemon=True)
        http_thread.start()
        
        # 启动清理线程
        def cleanup_thread():
            while True:
                time.sleep(10)  # 每10秒清理一次
                cleanup_expired_requests()
        
        cleanup_thread = threading.Thread(target=cleanup_thread, daemon=True)
        cleanup_thread.start()
        
        # 主循环 - 处理Native Messaging
        while True:
            # 检查HTTP请求队列
            try:
                while not http_request_queue.empty():
                    http_message = http_request_queue.get_nowait()
                    send_message(http_message)
            except queue.Empty:
                pass
            
            # 处理Chrome扩展消息
            message = read_message()
            if not message:
                break
                
            action = message.get('action')
            
            # 处理PS响应
            if action == 'ps_response':
                handle_ps_response(message)
            # 原有的文件操作功能
            elif action == 'open_file':
                file_path = message.get('file_path')
                open_id = message.get('open_id')
                if file_path and os.path.exists(file_path):
                    result = open_file_with_default_app(file_path, open_id)
                    send_message(result)
                else:
                    result = {
                        "success": False, 
                        "error": f"File not found: {file_path}"
                    }
                    if open_id:
                        result["open_id"] = open_id
                    send_message(result)
            elif action == 'check_file':
                file_path = message.get('file_path')
                check_id = message.get('check_id')
                if file_path:
                    result = check_file_ready(file_path, check_id)
                    send_message(result)
                else:
                    result = {
                        "action": "check_file_result",
                        "exists": False, 
                        "readable": False,
                        "error": "No file path provided"
                    }
                    if check_id:
                        result["check_id"] = check_id
                    send_message(result)
            else:
                send_message({
                    "success": False, 
                    "error": "Unknown action"
                })
                
    except Exception as e:
        send_message({
            "success": False, 
            "error": f"Native host error: {str(e)}"
        })

if __name__ == "__main__":
    main()
