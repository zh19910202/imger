#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试Native Host功能
直接测试是否能打开指定路径的图片
"""

import sys
import os
import platform
import subprocess

def open_file_with_default_app(file_path):
    """使用系统默认应用打开文件"""
    try:
        print(f"尝试打开文件: {file_path}")
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            print(f"错误：文件不存在 - {file_path}")
            return False
            
        system = platform.system().lower()
        print(f"当前操作系统: {system}")
        
        if system == "windows":
            print("使用 os.startfile() 打开文件...")
            os.startfile(file_path)
        elif system == "darwin":  # macOS
            print("使用 subprocess.run(['open', file_path]) 打开文件...")
            subprocess.run(['open', file_path], check=True)
        elif system == "linux":
            print("使用 subprocess.run(['xdg-open', file_path]) 打开文件...")
            subprocess.run(['xdg-open', file_path], check=True)
        else:
            print(f"不支持的操作系统: {system}")
            return False
            
        print("文件打开成功！")
        return True
        
    except Exception as e:
        print(f"打开文件失败: {str(e)}")
        return False

def main():
    """主函数"""
    print("=== Native Host 功能测试 ===")
    
    # 测试路径
    test_path = r"C:\Users\ADMIN\Desktop\img\a"
    
    print(f"测试路径: {test_path}")
    
    # 检查路径是否存在
    if os.path.exists(test_path):
        print("✓ 路径存在")
        
        # 如果是目录，列出其中的图片文件
        if os.path.isdir(test_path):
            print("这是一个目录，查找其中的图片文件...")
            image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff']
            
            found_images = []
            for file in os.listdir(test_path):
                file_path = os.path.join(test_path, file)
                if os.path.isfile(file_path):
                    ext = os.path.splitext(file)[1].lower()
                    if ext in image_extensions:
                        found_images.append(file_path)
            
            if found_images:
                print(f"找到 {len(found_images)} 个图片文件:")
                for img in found_images:
                    print(f"  - {img}")
                
                # 测试打开第一个图片
                test_image = found_images[0]
                print(f"\n测试打开第一个图片: {test_image}")
                success = open_file_with_default_app(test_image)
                
                if success:
                    print("✓ 测试成功！图片应该已经打开")
                else:
                    print("✗ 测试失败")
            else:
                print("未找到图片文件")
        else:
            # 如果是文件，直接测试
            print("这是一个文件，直接测试打开...")
            success = open_file_with_default_app(test_path)
            
            if success:
                print("✓ 测试成功！图片应该已经打开")
            else:
                print("✗ 测试失败")
    else:
        print("✗ 路径不存在")
        print("请检查路径是否正确")
    
    print("\n测试完成")
    input("按回车键退出...")

if __name__ == "__main__":
    main()
