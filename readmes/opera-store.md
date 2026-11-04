# Opera 商店渠道

Opera Add-ons 使用海外发行版渠道 `global-opera`，后端渠道号为 `7159`。
构建目标沿用 `chrome`（Manifest V3），以便向 Opera 以及从该商店安装扩展的 Yandex 分发同一个包。
浏览器功能继续由现有的侧栏和音频 API 能力检测处理。

## 打包

在仓库根目录执行：

```sh
node scripts/pack.mjs store --edition global --channel global-opera
```

产物为 `.output/translatebuff-<版本>-global-opera.zip`，解压后的构建目录为
`.output/chrome-mv3-global`。该目录会被后续其他海外 Chromium 渠道构建覆盖，上传时使用带渠道名的 ZIP。
海外全渠道命令 `node scripts/pack.mjs store --edition global --all` 也包含此渠道。

使用正式海外配置 `.env.global.production`，沿用生产域名、品牌及跨发行版校验。
安装包内部的原始渠道始终为 `7159`；请求和官网跳转优先使用当前官网 `aitrans_cid` Cookie，
Cookie 不可用时回退到 `7159`。海外启动事件的 `origin_cid` 保留 `7159`。

## 发布验收

在 Opera 和 Yandex 中分别加载解压后的构建目录，检查：

- popup、设置页、网页翻译和划词翻译。
- 登录及官网跳转的 `cid`，以及清除官网渠道 Cookie 后的 `7159` 回退。
- 启动上报的 `launch_channel_id`、`origin_cid` 和请求头渠道是否一致。
- 侧栏打开、关闭和不支持时的提示；朗读播放和停止。

在 Opera 开发者后台上传 ZIP 并提交审核。此命令仅打包，不会自动上传。
正式商店条目链接尚未配置；上线后再接入该条目的评价入口，不使用其他产品的条目代替。
