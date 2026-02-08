# 图标要求

## 托盘图标 (icon.png)
- 尺寸: 24x24 像素
- 格式: PNG (带透明度)
- 位置: src-tauri/icons/icon.png

## 应用图标
- 32x32.png (Windows/Linux)
- 128x128.png
- 128x128@2x.png (macOS Retina)
- icon.icns (macOS)
- icon.ico (Windows)

## 生成方式

```bash
# 使用 Homebrew 安装icotool
brew install imagemagick

# 转换为 PNG
convert your_icon.png -resize 24x24 src-tauri/icons/icon.png
convert your_icon.png -resize 32x32 src-tauri/icons/32x32.png
convert your_icon.png -resize 128x128 src-tauri/icons/128x128.png
convert your_icon.png -resize 256x256 src-tauri/icons/128x128@2x.png

# macOS icns
png2icns src-tauri/icons/icon.icns src-tauri/icons/128x128@2x.png

# Windows ico
convert your_icon.png src-tauri/icons/icon.ico
```
