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
# 图片数据存储 - 按来源隔离
image_data_store = {
    "chrome_extension": {
        "original_image": None,      # 原图数据
        "instructions": None,        # 修改要求
        "metadata": {},              # 元数据
        "update_timestamp": 0        # 数据更新时间戳
    },
    "external_application": {
        "modified_image": None,      # 修改图数据（来自PS插件）
        "mask_image": None,          # 蒙版图数据（来自PS插件）
        "metadata": {},              # 元数据
        "update_timestamp": 0        # 数据更新时间戳
    },
    "current_source": "unknown"      # 当前活跃数据源
}
image_data_lock = threading.Lock()  # 图片数据锁

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

def get_cache_info(info_id=None):
    """获取缓存信息"""
    try:
        import json as json_module

        result = {"action": "get_cache_info_result"}
        if info_id:
            result["info_id"] = info_id

        # 获取缓存信息
        cache_info = {
            "image_data_store": {
                "chrome_extension": {
                    "has_original_image": image_data_store["chrome_extension"]["original_image"] is not None,
                    "instructions": image_data_store["chrome_extension"]["instructions"],
                    "metadata": image_data_store["chrome_extension"]["metadata"],
                    "update_timestamp": image_data_store["chrome_extension"]["update_timestamp"]
                },
                "external_application": {
                    "has_modified_image": image_data_store["external_application"]["modified_image"] is not None,
                    "has_mask_image": image_data_store["external_application"]["mask_image"] is not None,
                    "metadata": image_data_store["external_application"]["metadata"],
                    "update_timestamp": image_data_store["external_application"]["update_timestamp"]
                },
                "current_source": image_data_store.get("current_source", "unknown")
            },
            "pending_requests_count": len(pending_requests),
            "http_server_config": HTTP_SERVER_CONFIG
        }

        result.update({
            "success": True,
            "cache_info": cache_info
        })
        return result

    except Exception as e:
        result = {
            "action": "get_cache_info_result",
            "success": False,
            "error": str(e)
        }
        if info_id:
            result["info_id"] = info_id
        return result


def read_device_fingerprint(read_id=None):
    """读取设备指纹文件内容"""
    try:
        # 固定的设备指纹文件路径
        fingerprint_path = r"C:\Users\Administrator\AppData\Local\stai_cache\device_fingerprint.txt"
        
        result = {"action": "read_device_fingerprint_result"}
        if read_id:
            result["read_id"] = read_id
            
        # 检查文件是否存在
        if not os.path.exists(fingerprint_path):
            result.update({
                "success": False,
                "error": "Device fingerprint file not found",
                "file_path": fingerprint_path
            })
            return result
        
        # 检查文件是否可读
        if not os.access(fingerprint_path, os.R_OK):
            result.update({
                "success": False,
                "error": "Device fingerprint file is not readable",
                "file_path": fingerprint_path
            })
            return result
        
        # 读取文件内容 - 支持多种编码格式，优先处理 UTF-16
        content = None
        used_encoding = None
        encodings_to_try = ['utf-16', 'utf-16-le', 'utf-16-be', 'utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'ascii', 'latin1']
        
        for encoding in encodings_to_try:
            try:
                with open(fingerprint_path, 'r', encoding=encoding) as f:
                    raw_content = f.read().strip()
                    # 清理控制字符和空字符
                    content = ''.join(char for char in raw_content if char.isprintable() and char != '\x00')
                    used_encoding = encoding
                break
            except UnicodeDecodeError:
                continue
        
        # 如果所有编码都失败，尝试以二进制方式读取
        if content is None:
            try:
                with open(fingerprint_path, 'rb') as f:
                    raw_content = f.read()
                # 尝试解码为十六进制字符串
                content = raw_content.hex()
                result.update({
                    "success": True,
                    "content": content,
                    "file_path": fingerprint_path,
                    "file_size": os.path.getsize(fingerprint_path),
                    "encoding": "binary_hex",
                    "note": "文件以二进制格式读取并转换为十六进制"
                })
                return result
            except Exception as e:
                result.update({
                    "success": False,
                    "error": f"无法读取文件内容: {str(e)}",
                    "file_path": fingerprint_path
                })
                return result
        
        # 成功读取文件内容
        result.update({
            "success": True,
            "content": content,
            "file_path": fingerprint_path,
            "file_size": os.path.getsize(fingerprint_path),
            "encoding": used_encoding or "text",
            "note": f"使用 {used_encoding} 编码读取" if used_encoding else "文本格式读取"
        })
        return result
        
    except Exception as e:
        result = {
            "action": "read_device_fingerprint_result",
            "success": False,
            "error": str(e),
            "file_path": fingerprint_path if 'fingerprint_path' in locals() else "Unknown"
        }
        if read_id:
            result["read_id"] = read_id
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
    """处理来自PS插件和Chrome扩展的HTTP请求

    API端点设计：
    /api/chrome-data: 用于存放和获取来自谷歌插件的数据
        POST /api/chrome-data: 谷歌插件调用此接口，用于发送【原图】和【修改要求】
        GET /api/chrome-data: 外部应用调用此接口，用于获取【原图】和【修改要求】

    /api/external-data: 用于存放和获取来自外部应用（如PS插件）的数据
        POST /api/external-data: 外部应用调用此接口，用于发送【修改图】和【蒙版图】
        GET /api/external-data: 谷歌插件调用此接口，用于获取【修改图】和【蒙版图】

    /api/health: 健康检查端点
    """
    
    def do_POST(self):
        """处理POST请求"""
        try:
            # 读取请求数据
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > HTTP_SERVER_CONFIG["max_request_size"]:
                self.send_error(413, "Request too large")
                return

            post_data = self.rfile.read(content_length)

            # 处理谷歌插件数据端点 - 存放原图和修改要求
            if self.path == '/api/chrome-data':
                try:
                    # 解析JSON数据
                    request_data = json.loads(post_data.decode('utf-8'))

                    # 验证必需字段 - 谷歌插件发送原图和修改要求
                    original_image = request_data.get("original_image")
                    instructions = request_data.get("instructions")

                    if not original_image:
                        self.send_error(400, "Missing required image data: original_image")
                        return

                    # 获取当前时间戳
                    current_time = time.time()

                    # 存储Chrome扩展数据：原图 + 修改要求
                    with image_data_lock:
                        image_data_store["chrome_extension"]["original_image"] = original_image
                        image_data_store["chrome_extension"]["instructions"] = instructions
                        image_data_store["chrome_extension"]["metadata"] = {
                            "upload_time": current_time,
                            "source": "chrome_extension",
                            "format": request_data.get("format", "base64"),
                            **request_data.get("metadata", {})
                        }
                        image_data_store["chrome_extension"]["update_timestamp"] = current_time

                        # 更新当前活跃数据源
                        image_data_store["current_source"] = "chrome_extension"

                    # 发送成功响应
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()

                    response = {
                        "success": True,
                        "message": "Chrome extension data stored successfully",
                        "timestamp": time.time(),
                        "data_type": "chrome_extension"
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

                except json.JSONDecodeError:
                    self.send_error(400, "Invalid JSON")
                except Exception as e:
                    self.send_error(500, f"Failed to store chrome data: {str(e)}")

            # 处理外部应用数据端点 - 存放修改图和蒙版图
            elif self.path == '/api/external-data':
                try:
                    # 解析JSON数据
                    request_data = json.loads(post_data.decode('utf-8'))

                    # 验证必需字段 - 外部应用发送修改图和蒙版图
                    modified_image = request_data.get("modified_image")
                    mask_image = request_data.get("mask_image")

                    if not modified_image or not mask_image:
                        self.send_error(400, "Missing required image data: modified_image and mask_image")
                        return

                    # 获取当前时间戳
                    current_time = time.time()

                    # 存储外部应用数据：修改图 + 蒙版图
                    with image_data_lock:
                        image_data_store["external_application"]["modified_image"] = modified_image
                        image_data_store["external_application"]["mask_image"] = mask_image
                        image_data_store["external_application"]["metadata"] = {
                            "upload_time": current_time,
                            "source": "external_application",
                            "format": request_data.get("format", "base64"),
                            **request_data.get("metadata", {})
                        }
                        image_data_store["external_application"]["update_timestamp"] = current_time

                        # 更新当前活跃数据源
                        image_data_store["current_source"] = "external_application"

                    # 发送成功响应
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()

                    response = {
                        "success": True,
                        "message": "External application data stored successfully",
                        "timestamp": time.time(),
                        "data_type": "external_application"
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

                    # 通知Chrome扩展自动上传图片
                    try:
                        notification = {
                            "action": "auto_upload_notification",
                            "message": "External application data received, triggering auto upload",
                            "data_type": "external_application",
                            "timestamp": time.time()
                        }
                        send_message(notification)
                        # 打印日志确认通知已发送
                        print(f"Auto upload notification sent: {notification}", file=sys.stderr)
                        sys.stderr.flush()
                    except Exception as e:
                        # 记录错误但不中断程序
                        print(f"Failed to send auto upload notification: {e}", file=sys.stderr)
                        sys.stderr.flush()
                        pass

                except json.JSONDecodeError:
                    self.send_error(400, "Invalid JSON")
                except Exception as e:
                    self.send_error(500, f"Failed to store external data: {str(e)}")

            else:
                self.send_error(404, "Not Found")

        except Exception as e:
            self.send_error(500, f"Internal server error: {str(e)}")
    
    def do_GET(self):
        """处理GET请求 - 健康检查和图片获取"""
        # 健康检查端点
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

        # 谷歌插件获取数据端点 - 外部应用获取【原图】和【修改要求】
        elif self.path == '/api/chrome-data':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            # 获取当前时间戳
            current_time = time.time()

            # 外部应用调用此接口，获取Chrome扩展发送的原图和修改要求
            with image_data_lock:
                chrome_data = image_data_store["chrome_extension"]
                img_data = {
                    # 包含Chrome扩展的所有字段
                    **chrome_data,
                    "source_type": "chrome_extension",
                    "requester_type": "external_application",
                    "response_timestamp": current_time
                }
            self.wfile.write(json.dumps(img_data, ensure_ascii=False).encode('utf-8'))

        # 外部应用获取数据端点 - 谷歌插件获取【修改图】和【蒙版图】
        elif self.path == '/api/external-data':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            # 获取当前时间戳
            current_time = time.time()

            # Chrome扩展调用此接口，获取外部应用发送的修改图和蒙版图
            with image_data_lock:
                external_data = image_data_store["external_application"]
                img_data = {
                    # 包含外部应用的所有字段
                    **external_data,
                    "source_type": "external_application",
                    "requester_type": "chrome_extension",
                    "response_timestamp": current_time
                }
            self.wfile.write(json.dumps(img_data, ensure_ascii=False).encode('utf-8'))


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
        host = HTTP_SERVER_CONFIG["host"]
        port = HTTP_SERVER_CONFIG["port"]
        print(f"Attempting to start HTTP server on {host}:{port}", file=sys.stderr)
        server = HTTPServer((host, port), PSRequestHandler)
        print(f"HTTP server created successfully on {host}:{port}", file=sys.stderr)
        print(f"Server address info: {server.server_address}", file=sys.stderr)
        print(f"Request handler: {PSRequestHandler}", file=sys.stderr)
        print("About to call serve_forever()", file=sys.stderr)
        # 添加一个简单的响应来确认服务器启动
        print("HTTP server is now running and listening for connections", file=sys.stderr)
        # 启动服务器之前刷新stderr缓冲区
        sys.stderr.flush()
        server.serve_forever()
        print("serve_forever() returned", file=sys.stderr)
    except OSError as e:
        # 特别处理端口占用等OS错误
        print(f"OS Error starting HTTP server: {e} (errno: {e.errno})", file=sys.stderr)
        if "Address already in use" in str(e) or e.errno == 48:
            print(f"Port {HTTP_SERVER_CONFIG['port']} is already in use. Trying to find another port...", file=sys.stderr)
            # 尝试使用其他端口
            for port in range(8889, 8899):
                try:
                    server = HTTPServer((HTTP_SERVER_CONFIG["host"], port), PSRequestHandler)
                    print(f"HTTP server started successfully on {HTTP_SERVER_CONFIG['host']}:{port}", file=sys.stderr)
                    server.serve_forever()
                    break
                except OSError:
                    continue
            else:
                print("Failed to start HTTP server on any alternative port", file=sys.stderr)
        else:
            print(f"Failed to start HTTP server due to OS error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
    except Exception as e:
        # HTTP服务器启动失败，但不影响Native Messaging功能
        print(f"Exception starting HTTP server: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        print("Full traceback:", file=sys.stderr)
        traceback.print_exc(file=sys.stderr) 

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
    import sys  # 在函数开始处导入
    print("Native Host main function started", file=sys.stderr)
    try:
        # 启动HTTP服务器线程
        print("Starting HTTP server thread", file=sys.stderr)
        http_thread = threading.Thread(target=start_http_server, daemon=False)  # 改为非守护线程
        http_thread.start()
        print("HTTP server thread started", file=sys.stderr)
        print(f"HTTP thread is alive: {http_thread.is_alive()}", file=sys.stderr)

        # 启动清理线程
        def cleanup_thread():
            while True:
                time.sleep(10)  # 每10秒清理一次
                cleanup_expired_requests()

        cleanup_thread = threading.Thread(target=cleanup_thread, daemon=True)
        cleanup_thread.start()
        print("Cleanup thread started", file=sys.stderr)
        print(f"Cleanup thread is alive: {cleanup_thread.is_alive()}", file=sys.stderr)

        # 为了让HTTP服务器持续运行，我们需要保持主线程活跃
        # 除非是作为Chrome扩展的Native Host运行，否则保持服务器运行
        import select

        # 如果没有stdin或者不是交互模式，则运行HTTP服务器
        if not sys.stdin.isatty():
            print("Running as Chrome Native Host, processing messages", file=sys.stderr)
            # 主循环 - 处理Native Messaging
            print("Entering main loop", file=sys.stderr)
            loop_count = 0
            while True:
                loop_count += 1
                if loop_count % 10 == 0:  # Print every 10 iterations to avoid spam
                    print(f"Main loop iteration {loop_count}", file=sys.stderr)
                # 检查HTTP请求队列
                try:
                    while not http_request_queue.empty():
                        print("Processing HTTP request queue", file=sys.stderr)
                        http_message = http_request_queue.get_nowait()
                        send_message(http_message)
                except queue.Empty:
                    pass

                # 处理Chrome扩展消息
                print("About to read message from Chrome extension", file=sys.stderr)
                message = read_message()
                print(f"Message read: {message is not None}", file=sys.stderr)
                if not message:
                    print("No message received, breaking loop", file=sys.stderr)
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
                elif action == 'read_device_fingerprint':
                    read_id = message.get('read_id')
                    result = read_device_fingerprint(read_id)
                    send_message(result)
                elif action == 'get_cache_info':
                    info_id = message.get('info_id')
                    result = get_cache_info(info_id)
                    send_message(result)
                else:
                    send_message({
                        "success": False,
                        "error": "Unknown action"
                    })
        else:
            print("Running in standalone mode, keeping HTTP server alive", file=sys.stderr)
            # 在独立模式下，保持主线程运行以维持HTTP服务器
            try:
                while http_thread.is_alive():
                    time.sleep(1)
            except KeyboardInterrupt:
                print("Shutting down HTTP server", file=sys.stderr)

    except Exception as e:
        send_message({
            "success": False,
            "error": f"Native host error: {str(e)}"
        })

if __name__ == "__main__":
    main()