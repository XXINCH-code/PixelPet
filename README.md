# 像素小宠原型

这是桌宠礼物项目的 M0 + M1 原型，包含逐帧人物动画、随机行走、待机动作、多击互动、拖动和基础 PWA 能力。

## 环境要求

- Node.js 20.19+、22.12+ 或更新版本
- npm
- Linux、macOS 或 Windows 均可开发
- iPhone/iPad 与开发电脑处于同一个局域网时，可进行开发阶段真机测试

## 安装和运行

```bash
npm install
npm run dev
```

终端会显示本机局域网地址，例如：

```text
http://192.168.1.20:5173/
```

在同一 Wi-Fi 下，用 iPhone/iPad 的 Safari 打开该地址即可测试动画、点击和拖动。

> 局域网 `http://` 地址适合测试页面，但 iOS 不会把它当作完整安全 PWA。正式添加到主屏幕和测试离线缓存，需要部署到 HTTPS 静态网站。

## 检查和生产构建

```bash
npm run typecheck
npm run build
npm run preview
```

生产文件会输出到 `dist/`。

## 当前交互

- 不操作：宠物会随机待机、左右走动、遛狗、招手、跳舞、加油、卖萌、送花、赠送纪念礼物或耍帅，较长时间间隔会进入思考动作。
- 单击宠物：进入睡觉动作。
- 双击宠物：进入道歉动作。
- 三击宠物：进入示爱动作并显示爱心。
- 点击地面：宠物根据目标位置向左或向右行走，并停在点击位置。
- 长按宠物约 600ms：打开动作轮盘，可主动选择卖萌、招手、跳舞、加油、送花、纪念、耍帅或遛狗。
- 拖动宠物：可移动到场景内其他位置，松手后落回地面。
- 手机横竖屏变化：场景重新布局并约束宠物位置。

## 动画素材

运行时使用的透明逐帧文件保存在 `public/assets/actions/<动作名>/`。当前动作素材均为 540×540 RGBA PNG，每组包含 10 帧；待机素材目录名为 `idles`，代码会将它映射为内部的 `idle` 动作。

`scripts/process_sprites.py` 仅用于旧版合成大图的迁移处理，不应对当前 540×540 动作目录执行。

## 添加到 iPhone/iPad 主屏幕

项目已经包含 `.github/workflows/deploy-pages.yml`，推送到 GitHub 后可以自动编译并发布。

### 第一次推送代码

先在 GitHub 网页上创建一个空仓库，例如 `pixel-pet`，不要勾选自动创建 README。然后在本项目根目录执行：

```bash
git init
git add .
git commit -m "feat: add movable pixel pet prototype"
git branch -M main
git remote add origin https://github.com/你的用户名/pixel-pet.git
git push -u origin main
```

### 开启 GitHub Pages

1. 打开 GitHub 仓库的 `Settings`。
2. 进入左侧的 `Pages`。
3. 在 `Build and deployment` 下将 `Source` 选择为 `GitHub Actions`。
4. 打开仓库的 `Actions` 页面，等待部署流程变成绿色。
5. 部署完成后，Pages 页面会显示类似下面的 HTTPS 地址：

```text
https://你的用户名.github.io/pixel-pet/
```

### 安装到手机/平板

1. 确保使用 Safari 打开上述 HTTPS 地址。
2. 点击 Safari 工具栏中的“分享”按钮。
3. 向下找到并点击“添加到主屏幕”。
4. 确认名称后点击右上角“添加”。
5. 回到主屏幕，从“像素小宠”图标启动。

第一次完整打开后，主要脚本和图像会进入离线缓存。要验证离线能力，可先正常打开一次，再关闭网络并从主屏幕图标重新进入。

## 后续更新

修改代码并通过本地构建后：

```bash
npm run build
git add .
git commit -m "描述本次修改"
git push
```

GitHub Actions 会重新部署。PWA 可能因为缓存短暂显示旧版本，关闭后等待片刻再重新打开即可。
