#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试Native Host的Native Messaging功能
"""

import sys
import json
import struct
import time

def send_message(message):
    """发送消息到Chrome扩展"""
    try:
        encoded_message = json.dumps(message).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('I', len(encoded_message)))
        sys.stdout.buffer.write(encoded_message)
        sys.stdout.buffer.flush()
        print(f"消息已发送: {message}", file=sys.stderr)
    except Exception as e:
        print(f"发送消息失败: {e}", file=sys.stderr)

def main():
    print("测试Native Host Native Messaging功能", file=sys.stderr)

    # 发送测试消息
    test_message = {
        "action": "auto_upload_notification",
        "message": "测试消息",
        "data_type": "test",
        "timestamp": time.time()
    }

    send_message(test_message)

    print("测试完成", file=sys.stderr)

if __name__ == "__main__":
    main()