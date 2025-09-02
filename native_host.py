#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native Host for Chrome Extension
用于自动打开下载的图片文件
"""

import sys
import json
import struct
import subprocess
import os
import platform
from pathlib import Path

def send_message(message):
    """发送消息到Chrome扩展"""
    encoded_message = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('I', len(encoded_message)))
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()

def read_message():
    """从Chrome扩展读取消息"""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

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

def main():
    """主函数"""
    try:
        while True:
            message = read_message()
            if not message:
                break
                
            action = message.get('action')
            
            if action == 'open_file':
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
